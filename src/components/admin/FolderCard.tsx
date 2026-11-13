import Link from 'next/link';
import { bulkEditFile, draftFile, publishFile, saveFileMarkup, trashFile } from '@/app/actions/productFiles';
import type { Folder } from '@/lib/folders';
import { formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

type Cat = { id: string; name: string };

/** ملف = فولدر: عنوان (اسم، عدد، وقت الرفع، مين رفع)، أزرار، منتجاته جواه، وتعديل جماعي للقسم والسعر وغيره */
export default function FolderCard({ f, back, cats, canEdit, canPublish, canDraft, canTrash, notice }: { f: Folder; back: string; cats: Cat[]; canEdit: boolean; canPublish: boolean; canDraft: boolean; canTrash: boolean; notice?: string }) {
  const hidden = (
    <>
      <input type="hidden" name="id" value={f.id} />
      <input type="hidden" name="back" value={back} />
    </>
  );
  return (
    <div id={`f-${f.id}`} className={`${ui.card} space-y-1.5 p-2 text-sm`}>
      {notice && <p className={ui.alertOk}>{notice}</p>}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/admin/products/files/${f.id}`} className="text-sm font-extrabold text-brand-600 hover:underline">📁 {f.name}</Link>
          <p className="text-xs text-gray-600">
            {f.count} منتج · {f.source === 'bot' ? 'من بوت تليجرام' : 'ملف مرفوع'}
          </p>
          <p className="text-xs text-gray-600">
            🕒 {new Date(f.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })} · 👤 {f.by}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {!f.is_public && canPublish && <form action={publishFile}>{hidden}<button className="rounded border border-green-500 bg-green-50 px-2 py-1 text-xs font-bold text-green-800">للعلن</button></form>}
          {f.is_public && canDraft && <form action={draftFile}>{hidden}<button className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">للمسودة</button></form>}
          {!f.is_public && canDraft && f.source === 'bot' && back === '/admin/files' && <form action={draftFile}>{hidden}<button className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">للمسودة</button></form>}
          {canTrash && <form action={trashFile}>{hidden}<button className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">حذف</button></form>}
        </div>
      </div>

      <details open={Boolean(notice)} className="rounded-lg border border-gray-200">
        <summary className="cursor-pointer px-2 py-1 text-xs font-bold">📂 فتح الفولدر ({f.count} منتج)</summary>
        <div className="grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto p-1.5 sm:grid-cols-4 lg:grid-cols-5">
          {f.products.map((p) => (
            <div key={p.id} className="rounded-lg border border-gray-100 p-1 text-[11px]">
              {p.img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.img} alt="" loading="lazy" className="h-14 w-full rounded object-cover" /> : <div className="flex h-14 items-center justify-center rounded bg-gray-50 text-red-600">بدون صورة</div>}
              <p className="mt-1 line-clamp-2 font-semibold">{p.name}</p>
              <p className="text-gray-600">{formatPrice(p.price)}</p>
              <p className="text-[11px] text-gray-500">{[p.category ? `🏷 ${p.category}` : '🏷 بدون قسم', p.brand, p.shop ? `🏬 ${p.shop}` : ''].filter(Boolean).join(' · ')}</p>
            </div>
          ))}
        </div>
        {f.count > f.products.length && <p className="px-3 pb-2 text-xs text-gray-500">معروض {f.products.length} من {f.count}. <Link href={`/admin/products/files/${f.id}`} className="text-brand-600 underline">افتح الملف كله</Link></p>}
      </details>

      {canEdit && (
        <details className="rounded-lg border border-amber-300 bg-amber-50">
          <summary className="cursor-pointer px-2 py-1 text-xs font-bold">✏️ تعديل (القسم / الماركة / المحل / السعر) لكل منتجات الفولدر</summary>
          <form action={bulkEditFile} className="space-y-2 p-2">
            {hidden}
            <p className="text-xs text-gray-600">الخانة الفاضية ما بتتغيّرش.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className={ui.label}>القسم</label>
                <select name="category_id" defaultValue="" className={ui.input}>
                  <option value="">— من غير تغيير —</option>
                  <option value="__none">بدون قسم</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className={ui.label}>العلامة التجارية</label><input name="brand" className={ui.input} /></div>
              <div><label className={ui.label}>اسم المحل</label><input name="shop_name" className={ui.input} /></div>
              <div><label className={ui.label}>سعر ثابت جديد (جنيه)</label><input name="price" type="number" min={1} step="any" className={ui.input} /></div>
              <div><label className={ui.label}>زيادة / نقصان (جنيه)</label><input name="price_add" type="number" step="any" placeholder="مثلًا 20 أو -10" className={ui.input} /></div>
              <div><label className={ui.label}>المخزون</label><input name="stock" type="number" min={0} step="1" className={ui.input} /></div>
            </div>
            <button className={ui.btnPrimary}>تطبيق على كل الفولدر</button>
          </form>
          <form action={saveFileMarkup} className="flex flex-wrap items-end gap-2 border-t border-amber-200 p-3">
            {hidden}
            <div><label className={ui.label}>الزيادة على كل منتج (جنيه) — تحسب من السعر الأصلي</label><input name="markup" type="number" min={0} step="1" defaultValue={f.markup} className={`${ui.input} w-28`} /></div>
            <button className={ui.btnOutline}>تعديل الزيادة</button>
          </form>
        </details>
      )}
    </div>
  );
}
