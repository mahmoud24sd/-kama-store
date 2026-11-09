'use client';

import { useActionState } from 'react';
import { importProducts, type ImportState } from '@/app/actions/import';
import { ui } from '@/lib/ui';

export default function ImportForm() {
  const [state, action, pending] = useActionState(importProducts, {} as ImportState);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="text" className={ui.label}>الصق الجدول هنا (انسخه من Excel أو Google Sheets مع صف العناوين)</label>
        <textarea
          id="text"
          name="text"
          rows={10}
          dir="auto"
          placeholder={'name\tprice\tstock\tcategory\timage_urls\tpublish\nتيشيرت قطن\t199\t20\tأزياء\thttps://example.com/1.jpg\tyes'}
          className={`${ui.input} font-mono`}
        />
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600">أو ارفع ملف CSV بدل اللصق</summary>
        <input type="file" name="file" accept=".csv,text/csv" className="mt-2 block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-800 file:px-4 file:py-2 file:text-white" />
      </details>
      <button disabled={pending} className={`${ui.btnPrimary} px-8 py-2.5`}>{pending ? 'جارٍ الاستيراد... لا تغلق الصفحة' : 'استيراد المنتجات'}</button>
      {state.message && <p className={ui.alertError}>{state.message}</p>}
      {state.created !== undefined && (
        <div className="space-y-2">
          <p className={ui.alertOk}>تم استيراد <b>{state.created}</b> منتج{state.failed ? ` — وفشل ${state.failed}` : ''}.</p>
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
