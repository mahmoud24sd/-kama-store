'use client';

import { useActionState } from 'react';
import { importProducts, type ImportState } from '@/app/actions/import';
import { ui } from '@/lib/ui';

export default function ImportForm() {
  const [state, action, pending] = useActionState(importProducts, {} as ImportState);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={ui.label} htmlFor="file">ارفع الملف: إكسل (xlsx) / CSV / JSON</label>
        <input id="file" type="file" name="file" required accept=".xlsx,.csv,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="mt-2 block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-800 file:px-4 file:py-2 file:text-white" />
      </div>
      <div>
        <label className={ui.label} htmlFor="mode">حالة المنتجات بعد الاستيراد</label>
        <select id="mode" name="mode" defaultValue="draft" className={ui.input}>
          <option value="draft">حفظ كمسودة (مخفية، أنت تنشرها بعدين)</option>
          <option value="public">إظهار للعلن فورًا</option>
          <option value="csv">حسب عمود publish في الملف</option>
        </select>
      </div>
      <button disabled={pending} className={`${ui.btnPrimary} px-8 py-2.5`}>{pending ? 'جارٍ الاستيراد... لا تغلق الصفحة' : 'استيراد المنتجات'}</button>
      {state.message && <p className={ui.alertError}>{state.message}</p>}
      {state.created !== undefined && (
        <div className="space-y-2">
          <p className={ui.alertOk}>تم استيراد <b>{state.created}</b> منتج{state.failed ? ` — وفشل ${state.failed}` : ''}.</p>
          {state.fileId && <p className="text-sm"><a href={`/admin/products/files/${state.fileId}`} className="font-bold text-brand-600 underline">افتح الملف وشوف المنتجات ←</a></p>}
          {!!state.noImages && <p className={ui.alertError}>{state.noImages} منتج من غير صور. اتأكد إن عمود الصور اسمه <b>image_urls</b> (أو images / الصور) وفيه روابط تبدأ بـ https. الصور اللي جوه خلايا إكسل نفسها (مش روابط) مش بتتقري.</p>}
          {state.errors && state.errors.length > 0 && (
            <ul className="max-h-60 list-disc space-y-1 overflow-y-auto rounded-lg bg-red-50 p-3 pe-6 text-sm text-red-700">
              {state.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
