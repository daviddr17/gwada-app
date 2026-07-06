import { SkeletonCardFrame } from "@/components/ui/skeleton";

export function ReservationsProtocolTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCardFrame key={i} className="h-12 rounded-xl" />
      ))}
    </div>
  );
}
