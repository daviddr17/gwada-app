import { SkeletonCardFrame } from "@/components/ui/skeleton";

export function StaffDocumentsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <SkeletonCardFrame key={index} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}
