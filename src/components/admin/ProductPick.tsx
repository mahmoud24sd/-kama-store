import Link from 'next/link';
import SelectAll from '@/components/admin/SelectAll';
import { formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

export type PickRow = { id: string; name: string; price: number; is_active: boolean; published_at: string | null; file_id: string | null; img?: string };

/** جدول منتجات بخانات تحديد، والأزرار (children) هي إجراءات التحديد */
export default function ProductPick({ rows, back, children, fileNames, panel, editable }: { rows: PickRow[]; back: string; children: React.ReactNode; fileNames?: Map<string, string>; panel?: React.ReactNode; editable?: boolean }) {
  if (rows.length === 0) return <p className="py-8 text-center text-gray-500">مفيش منتجات هنا.</p>;
  return (
    <form className="space-y-2">
      <input type="hidden" name="back" value={back} />
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2 text-sm">
        <span className="font-bold">المحدّد:</span>
        {children}
      </div>
      {panel}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className={ui.th}><SelectAll /></th><th className={ui.th}>الصورة</th><th className={ui.th}>المنتج</th>
              <th className={ui.th}>السعر</th><th className={ui.th}>الملف</th><th className={ui.th}>وقت النشر</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className={ui.td}><input type="checkbox" name="ids" value={p.id} aria-label="تحديد" /></td>
                <td className={ui.td}>{p.img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.img} alt="" className="h-12 w-12 rounded object-cover" /> : <span className="text-xs text-red-600">بدون صورة</span>}</td>
                <td className={ui.td}>{editable ? <Link href={`/admin/products/${p.id}`} className="font-semibold text-brand-600 hover:underline">{p.name}</Link> : p.name}</td>
                <td className={ui.td}>{formatPrice(p.price)}</td>
                <td className={`${ui.td} text-xs`}>{p.file_id && fileNames?.get(p.file_id) ? <Link href={`/admin/products/files/${p.file_id}`} className="text-brand-600 hover:underline">📄 {fileNames.get(p.file_id)}</Link> : '—'}</td>
                <td className={`${ui.td} text-xs text-gray-600`}>{p.published_at ? new Date(p.published_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
