import { cn } from '../../utils/cn';
export default function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-stone-200', className)} />;
}
export function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card bg-white shadow-card" role="status" aria-label="Loading property">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full" /></div>
    </div>
  );
}
