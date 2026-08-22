import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";

export function GenericModulePendingSkeleton() {
  return (
    <div aria-busy aria-label="Modul wird geladen" className="space-y-4 p-4">
      <Skeleton className="h-11 w-full rounded-xl" />
      <SkeletonCardFrame className="space-y-3 p-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </SkeletonCardFrame>
    </div>
  );
}
