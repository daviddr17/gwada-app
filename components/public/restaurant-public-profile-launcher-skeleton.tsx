/** Platzhalter für verzögert geladenen App-Launcher (kein Framer auf First Paint). */
export function RestaurantPublicProfileLauncherSkeleton() {
  return (
    <div
      className="mx-auto max-w-lg px-4 pb-28 pt-6 sm:px-6"
      aria-hidden
    >
      <div className="grid grid-cols-4 gap-x-4 gap-y-6 sm:gap-x-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="size-[3.75rem] rounded-[22%] bg-muted/60" />
            <div className="h-2.5 w-12 rounded-full bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
