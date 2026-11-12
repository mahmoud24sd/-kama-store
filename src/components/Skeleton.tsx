export function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} aria-hidden="true" />;
}

export function CardsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-gray-100 bg-white p-2">
          <Bar className="aspect-square w-full" />
          <Bar className="h-4 w-3/4" />
          <Bar className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
