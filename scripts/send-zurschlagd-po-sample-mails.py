#!/usr/bin/env python3
"""Send two fictional Zur-Schlagd purchase-order sample mails.

Reads live SMTP from the VPS database and never prints passwords, tokens,
or mailbox passwords. Intended to run on the live VPS as root.
"""

from __future__ import annotations

import html
import json
import smtplib
import ssl
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage

TO = "dreyer@techlion.de"
HREF = "https://gwada.app/dashboard/inventory/bestellung"
NOTE = "Beispielmail mit fiktiven Positionen — keine echte Bestellung."

ORDERED = """Lieferant: Metro
Lieferdatum: 22.09.2026
Von: David
Positionen:
• Vollmilch 3,5% (Weihenstephan, Art. 10442) — 24 L
• Zucker (Art. 22018) — 10 kg
• Meersalz (Art. 33001) — 2 kg
• Butter — 8 kg"""

CLOSED = """Lieferant: Metro
Lieferdatum: 22.09.2026
Von: David
Fehlend / abweichend:
• Zucker (Art. 22018) — abweichend (bestellt 10 kg, geliefert 6 kg) · Rest kommt Donnerstag
• Meersalz (Art. 33001) — fehlend (bestellt 2 kg) · nicht auf dem Lieferschein
Positionen:
• Vollmilch 3,5% (Weihenstephan, Art. 10442) — 24 L
• Zucker (Art. 22018) — 10 kg
• Meersalz (Art. 33001) — 2 kg
• Butter — 8 kg"""

SQL = r"""
select coalesce((
  select json_build_object(
    'restaurant_name', r.name,
    'status', ri.status,
    'config', coalesce(ri.config, '{}'::jsonb),
    'platform', (
      select json_build_object('enabled', p.enabled, 'config', p.config)
      from public.platform_integrations p
      where p.key = 'email'
    ),
    'google', (
      select g.config
      from public.platform_integrations g
      where g.key = 'google_oauth'
    ),
    'microsoft', (
      select m.config
      from public.platform_integrations m
      where m.key = 'microsoft_oauth'
    )
  )::text
  from public.restaurants r
  left join public.restaurant_integrations ri
    on ri.restaurant_id = r.id
   and ri.integration_key = 'email'
  where r.slug = 'zurschlagd'
), '');
"""


def redact(text: str, secrets: list[str]) -> str:
    out = text.replace("\n", " ")
    for secret in secrets:
        if secret and len(secret) >= 4:
            out = out.replace(secret, "***")
    return out[:240]


def db_container() -> str:
    names = subprocess.check_output(
        ["docker", "ps", "--format", "{{.Names}}"],
        text=True,
    )
    for name in names.splitlines():
        if "supabase-db" in name:
            return name.strip()
    raise SystemExit("db_container_missing")


def load_row() -> dict:
    cid = db_container()
    proc = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            cid,
            "psql",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-t",
            "-A",
            "-v",
            "ON_ERROR_STOP=1",
        ],
        input=SQL,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        err = (proc.stderr or "psql_failed").strip().splitlines()
        tail = err[-1] if err else "psql_failed"
        raise SystemExit(f"psql_failed:{tail[:180]}")
    raw = proc.stdout.strip()
    if not raw:
        raise SystemExit("restaurant_missing")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise SystemExit("config_invalid")
    return data


def as_dict(value: object) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def pick_str(cfg: dict, *keys: str) -> str:
    for key in keys:
        value = cfg.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, (int, float)) and key.endswith("port"):
            return str(int(value))
    return ""


def refresh_token(url: str, form: dict) -> str:
    data = urllib.parse.urlencode(form).encode()
    req = urllib.request.Request(url, data=data)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            body = json.load(res)
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            payload = json.load(exc)
            if isinstance(payload, dict):
                detail = str(payload.get("error") or "")
        except Exception:
            detail = ""
        raise SystemExit(f"oauth_refresh_failed:{detail or exc.code}") from exc
    token = body.get("access_token") if isinstance(body, dict) else None
    if not isinstance(token, str) or not token:
        raise SystemExit("oauth_refresh_failed:no_token")
    return token


def resolve_transport(row: dict) -> dict:
    status = str(row.get("status") or "default")
    cfg = as_dict(row.get("config"))
    restaurant = pick_str({"name": row.get("restaurant_name")}, "name") or "Zur Schlagd"
    google = as_dict(row.get("google"))
    microsoft = as_dict(row.get("microsoft"))

    if status == "gmail":
        refresh = pick_str(cfg, "refresh_token")
        access = pick_str(cfg, "access_token")
        token = access
        if refresh and pick_str(google, "client_id") and pick_str(google, "client_secret"):
            try:
                token = refresh_token(
                    "https://oauth2.googleapis.com/token",
                    {
                        "client_id": pick_str(google, "client_id"),
                        "client_secret": pick_str(google, "client_secret"),
                        "refresh_token": refresh,
                        "grant_type": "refresh_token",
                    },
                )
            except SystemExit:
                if not access:
                    raise
                token = access
        email = pick_str(cfg, "email", "from_email")
        if not email or not token:
            raise SystemExit("gmail_incomplete")
        return {
            "source": "zurschlagd_gmail",
            "host": "smtp.gmail.com",
            "port": 465,
            "user": email,
            "password": "",
            "oauth": token,
            "from_name": pick_str(cfg, "from_name") or restaurant,
            "restaurant": restaurant,
        }

    if status == "outlook":
        refresh = pick_str(cfg, "refresh_token")
        access = pick_str(cfg, "access_token")
        token = access
        if refresh and pick_str(microsoft, "client_id") and pick_str(microsoft, "client_secret"):
            try:
                token = refresh_token(
                    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                    {
                        "client_id": pick_str(microsoft, "client_id"),
                        "client_secret": pick_str(microsoft, "client_secret"),
                        "refresh_token": refresh,
                        "grant_type": "refresh_token",
                        "scope": " ".join(
                            [
                                "https://outlook.office.com/IMAP.AccessAsUser.All",
                                "https://outlook.office.com/SMTP.Send",
                                "offline_access",
                                "openid",
                                "email",
                                "User.Read",
                            ]
                        ),
                    },
                )
            except SystemExit:
                if not access:
                    raise
                token = access
        email = pick_str(cfg, "email", "from_email")
        if not email or not token:
            raise SystemExit("outlook_incomplete")
        return {
            "source": "zurschlagd_outlook",
            "host": pick_str(cfg, "smtp_host") or "smtp.office365.com",
            "port": int(pick_str(cfg, "smtp_port") or "587"),
            "user": email,
            "password": "",
            "oauth": token,
            "from_name": pick_str(cfg, "from_name") or restaurant,
            "restaurant": restaurant,
        }

    use_platform = status != "custom"
    source_cfg = cfg
    source = "zurschlagd_smtp"
    if use_platform:
        platform = as_dict(row.get("platform"))
        if not platform.get("enabled"):
            raise SystemExit(f"email_not_configured:status={status}")
        source_cfg = as_dict(platform.get("config"))
        source = "platform_fallback"

    email = pick_str(source_cfg, "email", "from_email")
    password = pick_str(source_cfg, "password")
    host = pick_str(source_cfg, "smtp_host")
    port_raw = pick_str(source_cfg, "smtp_port")
    missing = [
        name
        for name, value in (
            ("email", email),
            ("password", password),
            ("smtp_host", host),
            ("smtp_port", port_raw),
        )
        if not value
    ]
    if missing:
        raise SystemExit(f"smtp_incomplete:{source}:missing={','.join(missing)}")
    return {
        "source": source,
        "host": host,
        "port": int(port_raw),
        "user": email,
        "password": password,
        "oauth": "",
        "from_name": pick_str(source_cfg, "from_name") or restaurant,
        "restaurant": restaurant,
    }


def send_one(transport: dict, subject: str, details: str) -> None:
    intro = "Du hast eine neue Benachrichtigung in gwada."
    text = f"{subject}\n\n{intro}\n\n{NOTE}\n\n{details}\n\n{HREF}"
    safe_details = "<br>\n".join(
        html.escape(line) for line in details.splitlines() if line.strip()
    )
    body_html = (
        "<p style=\"margin:0 0 12px;\">Du hast eine neue Benachrichtigung in gwada.</p>"
        f"<p style=\"margin:0 0 12px;color:#666;\">{html.escape(NOTE)}</p>"
        f"<p style=\"margin:0 0 14px;\">{safe_details}</p>"
        f"<p style=\"margin:0;\"><a href=\"{HREF}\">In Gwada öffnen</a></p>"
    )
    msg = EmailMessage()
    msg["To"] = TO
    msg["From"] = f"{transport['from_name']} <{transport['user']}>"
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(body_html, subtype="html")

    port = int(transport["port"])
    host = transport["host"]
    context = ssl.create_default_context()
    if port == 465:
        smtp: smtplib.SMTP = smtplib.SMTP_SSL(host, port, timeout=25, context=context)
    else:
        smtp = smtplib.SMTP(host, port, timeout=25)
        smtp.ehlo()
        if port == 587 or smtp.has_extn("starttls"):
            smtp.starttls(context=context)
            smtp.ehlo()
    try:
        if transport["oauth"]:
            token = transport["oauth"]
            user = transport["user"]

            def auth(_challenge: bytes | None = None, user: str = user, token: str = token) -> str:
                return f"user={user}\x01auth=Bearer {token}\x01\x01"

            smtp.auth("XOAUTH2", auth)
        else:
            smtp.login(transport["user"], transport["password"])
        smtp.send_message(msg)
    finally:
        try:
            smtp.quit()
        except Exception:
            smtp.close()


def main() -> None:
    row = load_row()
    transport = resolve_transport(row)
    domain = transport["user"].split("@")[-1] if "@" in transport["user"] else "hidden"
    print(
        "ready"
        f" source={transport['source']}"
        f" restaurant={transport['restaurant']}"
        f" smtp_host={transport['host']}"
        f" smtp_port={transport['port']}"
        f" from_domain={domain}"
    )
    secrets = [transport["password"], transport["oauth"], transport["user"]]
    prefix = f"{transport['restaurant']}: "
    jobs = [
        ("ordered", f"{prefix}Bestellung aufgegeben — Metro", ORDERED),
        ("closed", f"{prefix}Bestellung abgeschlossen — Metro", CLOSED),
    ]
    for key, subject, details in jobs:
        try:
            send_one(transport, subject, details)
        except Exception as exc:
            print(f"{key}=fail {redact(f'{type(exc).__name__}:{exc}', secrets)}")
            raise SystemExit(1) from exc
        print(f"{key}=ok to={TO}")


if __name__ == "__main__":
    main()
