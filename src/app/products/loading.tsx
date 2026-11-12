import { Bar, CardsSkeleton } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="جارٍ التحميل">
      <Bar className="h-8 w-48" />
      <CardsSkeleton count={12} />
    </div>
  );
}
