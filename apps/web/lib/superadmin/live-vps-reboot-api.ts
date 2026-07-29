export async function fetchLiveVpsRebootCooldown(): Promise<{
  cooldownMs: number;
  cooldownMinutes: number;
  error?: string;
}> {
  const res = await fetch("/api/superadmin/infra/reboot-vps", {
    method: "GET",
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    cooldownMs?: number;
    cooldownMinutes?: number;
    error?: string;
  };
  if (!res.ok) {
    return {
      cooldownMs: 0,
      cooldownMinutes: 0,
      error: body.error ?? `http_${res.status}`,
    };
  }
  return {
    cooldownMs: Number(body.cooldownMs) || 0,
    cooldownMinutes: Number(body.cooldownMinutes) || 0,
  };
}

/** Soft-Reboot des Live-VPS (Contabo). `confirm` muss exakt `REBOOT` sein. */
export async function triggerLiveVpsReboot(input: {
  confirm: string;
  reason?: string;
}): Promise<{ ok?: boolean; message?: string; error?: string }> {
  const res = await fetch("/api/superadmin/infra/reboot-vps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      confirm: input.confirm,
      reason: input.reason,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    return {
      error: body.error ?? `http_${res.status}`,
      message: body.message,
    };
  }
  return { ok: true, message: body.message };
}
