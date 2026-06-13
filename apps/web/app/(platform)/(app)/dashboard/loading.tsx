/** Soft-Nav: kurzer Platzhalter statt leerem Content während RSC-Flight. */
export default function DashboardZoneLoading() {
  return <div className="min-h-[40vh] bg-background" aria-busy aria-hidden />;
}
