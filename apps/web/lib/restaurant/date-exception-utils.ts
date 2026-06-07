/** YYYY-MM-DD — Standard bei neuen Ausnahmen: morgen (gültiges Datum ohne leere Inputs). */
export function defaultExceptionDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
