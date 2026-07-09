export async function appendReservationDayNoteEntryClient(params: {
  restaurantId: string;
  serviceDate: string;
  body: string;
}): Promise<{ error?: string }> {
  const res = await fetch("/api/reservations/day-note", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const parsed = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { error: parsed.error ?? `day_note_${res.status}` };
  return {};
}

export async function updateReservationDayNoteEntryClient(params: {
  restaurantId: string;
  entryId: string;
  body: string;
}): Promise<{ error?: string }> {
  const res = await fetch("/api/reservations/day-note", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const parsed = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { error: parsed.error ?? `day_note_patch_${res.status}` };
  return {};
}

export async function deleteReservationDayNoteEntryClient(params: {
  restaurantId: string;
  entryId: string;
}): Promise<{ error?: string }> {
  const res = await fetch("/api/reservations/day-note", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const parsed = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { error: parsed.error ?? `day_note_delete_${res.status}` };
  return {};
}
