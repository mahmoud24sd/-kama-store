'use client';

import { useActionState } from 'react';
import { importProducts, type ImportState } from '@/app/actions/import';
import { ui } from '@/lib/ui';

export default function ImportForm() {
  const [state, action, pending] = useActionState(importProducts, {} as ImportState);
  return (
    <form action={action} className="space-y-4">
      <input type="file" name="file" accept=".csv,text/csv" required className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-800 file:px-4 file:py-2 file:text-white" />
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
