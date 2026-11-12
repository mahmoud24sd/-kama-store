import { Bar } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ التحميل">
      <Bar className="h-7 w-56" />
      <Bar className="h-24 w-full" />
      <Bar className="h-24 w-full" />
      <Bar className="h-24 w-full" />
    </div>
  );
}
