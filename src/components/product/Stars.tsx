import { Star } from 'lucide-react';

export default function Stars({ rating, count, size = 'sm' }: { rating: number; count?: number; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1" aria-label={`التقييم ${rating.toFixed(1)} من 5`}>
      <span className="flex" dir="ltr">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`${dim} ${i <= rounded ? 'fill-accent-500 text-accent-500' : i - 0.5 === rounded ? 'fill-accent-300 text-accent-500' : 'text-gray-300'}`}
          />
        ))}
      </span>
      {count !== undefined && <span className="text-xs text-gray-500">({count})</span>}
    </span>
  );
}
