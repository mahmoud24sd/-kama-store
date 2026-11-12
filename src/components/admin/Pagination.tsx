import Link from 'next/link';

export const PAGE_SIZE = 10;
export const pageNum = (v?: string) => Math.max(1, Math.min(10000, Math.floor(Number(v)) || 1));

/** ترقيم صفحات (10 في الصفحة) بروابط، مع الحفاظ على باقي بارامترات الصفحة */
export default function Pagination({ total, page, param, sp, base }: { total: number; page: number; param: string; sp: Record<string, string | undefined>; base: string }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  const href = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== param && k !== 'msg' && k !== 'folder' && k !== 'error') q.set(k, v);
    if (n > 1) q.set(param, String(n));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const nums = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const cell = 'min-w-9 rounded-lg border px-3 py-1.5 text-center text-sm';
  return (
    <nav aria-label="الصفحات" className="flex flex-wrap items-center justify-center gap-1 pt-2">
      {page > 1 && <Link href={href(page - 1)} className={`${cell} border-gray-300 hover:bg-gray-50`}>السابق</Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-gray-400">…</span>}
          {n === page ? <span className={`${cell} border-brand-600 bg-brand-600 font-bold text-white`} aria-current="page">{n}</span> : <Link href={href(n)} className={`${cell} border-gray-300 hover:bg-gray-50`}>{n}</Link>}
        </span>
      ))}
      {page < pages && <Link href={href(page + 1)} className={`${cell} border-gray-300 hover:bg-gray-50`}>التالي</Link>}
      <span className="w-full text-center text-xs text-gray-500">{total} عنصر · صفحة {page} من {pages}</span>
    </nav>
  );
}
