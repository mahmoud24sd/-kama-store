import Link from 'next/link';

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`} aria-label="Kama Store">
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
        <rect width="40" height="40" rx="10" fill="#fbbf24" />
        <path d="M12 10v20M12 21l10-11M15.5 18l8.5 12" stroke="#0f1c33" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M27 14h2.5M27 20h2.5" stroke="#0f1c33" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-xl font-extrabold leading-none tracking-tight" dir="ltr">
        Kama<span className="text-accent-400">Store</span>
      </span>
    </Link>
  );
}
