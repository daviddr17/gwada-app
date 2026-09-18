#!/usr/bin/env python3
"""Send the two PO sample mails with pre-rendered Gwada transactional HTML.

Never prints passwords or tokens. HTML/text come from the directory argument.
"""

from __future__ import annotations

import html
import json
import smtplib
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage
from pathlib import Path

TO = "dreyer@techlion.de"
TOKEN = "SENDER_NAME_TOKEN"

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
      select g.config from public.platform_integrations g where g.key = 'google_oauth'
    ),
    'microsoft', (
      select m.config from public.platform_integrations m where m.key = 'microsoft_oauth'
    )
  )::text
  from public.restaurants r
  left join public.restaurant_integrations ri
    on ri.restaurant_id = r.id and ri.integration_key = 'email'
  where r.slug = 'zurschlagd'
), '');
"""

JOBS = (
    ("ordered", "Hafengaststätte Zur Schlagd: Bestellung aufgegeben — Metro"),
    ("closed", "Hafengaststätte Zur Schlagd: Bestellung abgeschlossen — Metro"),
)


def redact(text: str, secrets: list[str]) -> str:
    out = text.replace("\n", " ")
    for secret in secrets:
        if secret and len(secret) >= 4:
            out = out.replace(secret, "***")
    return out[:240]


def db_container() -> str:
    names = subprocess.check_output(["docker", "ps", "--format", "{{.Names}}"], text=True)
    for name in names.splitlines():
        if "supabase-db" in name:
            return name.strip()
    raise SystemExit("db_container_missing")


def load_row() -> dict:
    proc = subprocess.run(
        [
            "docker", "exec", "-i", db_container(),
            "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1",
        ],
        input=SQL,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        err = (proc.stderr or "psql_failed").strip().splitlines()
        raise SystemExit(f"psql_failed:{(err[-1] if err else 'psql_failed')[:180]}")
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
    req = urllib.request.Request(url, data=urllib.parse.urlencode(form).encode())
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
                        "scope": "https://outlook.office.com/SMTP.Send offline_access",
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
        }

    source_cfg = cfg
    source = "zurschlagd_smtp"
    if status != "custom":
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
    }


def send_one(transport: dict, subject: str, text: str, html_body: str) -> None:
    msg = EmailMessage()
    msg["To"] = TO
    msg["From"] = f"{transport['from_name']} <{transport['user']}>"
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html_body, subtype="html")
    port = int(transport["port"])
    context = ssl.create_default_context()
    if port == 465:
        smtp: smtplib.SMTP = smtplib.SMTP_SSL(transport["host"], port, timeout=25, context=context)
    else:
        smtp = smtplib.SMTP(transport["host"], port, timeout=25)
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


def apply_sender(raw: str, sender: str, as_html: bool) -> str:
    value = html.escape(sender) if as_html else sender
    return raw.replace(TOKEN, value)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: send-zurschlagd-po-sample-mails.py <mail-dir>")
    mail_dir = Path(sys.argv[1])
    transport = resolve_transport(load_row())
    domain = transport["user"].split("@")[-1] if "@" in transport["user"] else "hidden"
    print(
        "ready"
        f" source={transport['source']}"
        f" smtp_host={transport['host']}"
        f" smtp_port={transport['port']}"
        f" from_domain={domain}"
    )
    secrets = [transport["password"], transport["oauth"], transport["user"]]
    for key, subject in JOBS:
        html_body = apply_sender((mail_dir / f"{key}.html").read_text(), transport["from_name"], True)
        text = apply_sender((mail_dir / f"{key}.txt").read_text(), transport["from_name"], False)
        try:
            send_one(transport, subject, text, html_body)
        except Exception as exc:
            print(f"{key}=fail {redact(f'{type(exc).__name__}:{exc}', secrets)}")
            raise SystemExit(1) from exc
        print(f"{key}=ok to={TO}")


if __name__ == "__main__":
    main()
