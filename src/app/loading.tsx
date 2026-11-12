import { Bar, CardsSkeleton } from '@/components/Skeleton';

// يظهر فورًا عند التنقل بين الصفحات بدل ما يبدو الموقع "واقف" لحد ما السيرفر يرد
export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="جارٍ التحميل">
      <Bar className="h-40 w-full" />
      <CardsSkeleton />
    </div>
  );
}
