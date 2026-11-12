import type { Metadata } from 'next';
import { bulkRestore, bulkPurge, emptyTrash, purgeFile, restoreFile } from '@/app/actions/productFiles';
import SelectAll from '@/components/admin/SelectAll';
import { requirePermission } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'المهملات' };

export default async function TrashPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { supabase, profile } = await requirePermission('trash');
  const canPurge = hasPermission(profile, 'trash_purge');
  const sp = await searchParams;
  const { data: files, error } = await supabase.from('product_files').select('id,name,deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
  const { data: prods } = await supabase.from('products').select('id,name,price,deleted_at,file_id').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(500);
  const trashedFiles = new Set((files ?? []).map((f) => f.id as string));
  const loose = (prods ?? []).filter((p) => !p.file_id || !trashedFiles.has(p.file_id as string));
  const inFile = new Map<string, number>();
  for (const p of prods ?? []) if (p.file_id) inFile.set(p.file_id as string, (inFile.get(p.file_id as string) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">🗑 المهملات</h1>
        {canPurge && (files?.length || loose.length) ? (
          <form action={emptyTrash}><button className={ui.btnDanger}>تفريغ المهملات نهائيًا</button></form>
        ) : null}
      </div>
      <p className="text-sm text-gray-600">اللي بتحذفه بيجي هنا ويختفي من الموقع. تقدر ترجّعه كمسودة، أو تحذفه نهائيًا.</p>
      {sp.msg && <p className={ui.alertOk}>{sp.msg}</p>}
      {error && <p className={ui.alertError}>شغّل ملف supabase/migrations/020_product_files.sql في Supabase.</p>}

      {(files ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">ملفات محذوفة</h2>
          {(files ?? []).map((f) => (
            <div key={f.id as string} className={`${ui.card} flex flex-wrap items-center justify-between gap-2 p-3`}>
              <div>
                <p className="font-bold">📄 {f.name as string}</p>
                <p className="text-xs text-gray-500">{inFile.get(f.id as string) ?? 0} منتج · اتحذف {new Date(f.deleted_at as string).toLocaleDateString('ar-EG')}</p>
              </div>
              <div className="flex gap-2">
                <form action={restoreFile}><input type="hidden" name="id" value={f.id as string} /><button className={ui.btnOutline}>استرجاع</button></form>
                {canPurge && <form action={purgeFile}><input type="hidden" name="id" value={f.id as string} /><button className={ui.btnDanger}>حذف نهائي</button></form>}
              </div>
            </div>
          ))}
        </section>
      )}

      {loose.length > 0 && (
        <form className="space-y-2">
          <input type="hidden" name="back" value="/admin/trash" />
          <h2 className="font-bold">منتجات محذوفة</h2>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2 text-sm">
            <span className="font-bold">المحدّد:</span>
            <button formAction={bulkRestore} className={ui.btnOutline}>استرجاع</button>
            {canPurge && <button formAction={bulkPurge} className={ui.btnDanger}>حذف نهائي</button>}
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-gray-200"><th className={ui.th}><SelectAll /></th><th className={ui.th}>المنتج</th><th className={ui.th}>السعر</th><th className={ui.th}>اتحذف</th></tr></thead>
            <tbody>
              {loose.map((p) => (
                <tr key={p.id as string} className="border-b border-gray-100">
                  <td className={ui.td}><input type="checkbox" name="ids" value={p.id as string} aria-label="تحديد" /></td>
                  <td className={ui.td}>{p.name as string}</td>
                  <td className={ui.td}>{formatPrice(Number(p.price))}</td>
                  <td className={`${ui.td} text-xs text-gray-500`}>{new Date(p.deleted_at as string).toLocaleDateString('ar-EG')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </form>
      )}
      {!error && (files ?? []).length === 0 && loose.length === 0 && <p className="py-8 text-center text-gray-500">المهملات فاضية.</p>}
    </div>
  );
}
