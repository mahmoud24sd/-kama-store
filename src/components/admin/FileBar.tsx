import Link from 'next/link';
import { saveFileMarkup, publishFile, draftFile, trashFile } from '@/app/actions/productFiles';
import { ui } from '@/lib/ui';

export type FileRow = { id: string; name: string; source: string; markup: number; is_public: boolean; created_at: string; count: number };

/** صف ملف: الاسم والعدد وحالته، تعديل الزيادة، نشر/مسودة، حذف (للمهملات) */
export default function FileBar({ f, back, canTrash = true, detail = false }: { f: FileRow; back: string; canTrash?: boolean; detail?: boolean }) {
  return (
    <div className={`${ui.card} space-y-3 p-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {detail ? (
            <h2 className="text-lg font-extrabold">📄 {f.name}</h2>
          ) : (
            <Link href={`/admin/products/files/${f.id}`} className="font-extrabold text-brand-600 hover:underline">📄 {f.name}</Link>
          )}
          <p className="text-xs text-gray-500">
            {f.count} منتج · {f.source === 'bot' ? 'من بوت تليجرام' : 'ملف مرفوع'} · {new Date(f.created_at).toLocaleDateString('ar-EG')} ·{' '}
            {f.is_public ? <span className="font-bold text-green-700">ظاهر للعلن</span> : <span className="font-bold text-gray-500">مسودة</span>}
          </p>
        </div>
        {!detail && <Link href={`/admin/products/files/${f.id}`} className={ui.btnOutline}>فتح الملف</Link>}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <form action={saveFileMarkup} className="flex items-end gap-2">
          <input type="hidden" name="id" value={f.id} />
          <input type="hidden" name="back" value={back} />
          <div>
            <label className="block text-xs text-gray-600">الزيادة على كل منتج (جنيه)</label>
            <input name="markup" type="number" min={0} step="1" defaultValue={f.markup} className={`${ui.input} w-28`} />
          </div>
          <button className={ui.btnOutline}>تعديل</button>
        </form>
        <form action={f.is_public ? draftFile : publishFile}>
          <input type="hidden" name="id" value={f.id} />
          <input type="hidden" name="back" value={back} />
          <button className={f.is_public ? ui.btnOutline : ui.btnPrimary}>{f.is_public ? 'حفظ كمسودة' : 'نشر للعلن'}</button>
        </form>
        {canTrash && (
          <form action={trashFile}>
            <input type="hidden" name="id" value={f.id} />
            <button className={ui.btnDanger}>حذف الملف</button>
          </form>
        )}
      </div>
    </div>
  );
}
