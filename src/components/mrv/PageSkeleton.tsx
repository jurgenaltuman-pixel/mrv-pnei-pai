import { Skeleton } from '@/components/ui/skeleton';

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3 max-w-lg mx-auto">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

export function MapSkeleton() {
  return <Skeleton className="h-[calc(100dvh-10rem)] min-h-[280px] w-full rounded-2xl" />;
}
