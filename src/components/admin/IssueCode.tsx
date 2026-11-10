'use client';

import { useActionState, useState } from 'react';
import { issueResetCode, type IssueState } from '@/app/actions/passwordRequests';
import { ui } from '@/lib/ui';

export default function IssueCode({ id, resend }: { id: string; resend?: boolean }) {
  const [state, action, pending] = useActionState<IssueState, FormData>(issueResetCode, {});
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(state.message ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* النسخ غير متاح */
    }
  }

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button disabled={pending} className={ui.btnPrimary}>
          {pending ? 'جارٍ الإنشاء...' : resend ? 'إنشاء رمز جديد وإرساله' : 'إنشاء رمز وإرساله'}
        </button>
      </form>
      {state.error && <p className={ui.alertError}>{state.error}</p>}
      {state.ok && (
        <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
          <p>
            الرمز: <strong dir="ltr" className="text-lg tracking-widest">{state.code}</strong> (صالح 3 أيام)
          </p>
          {state.autoSent ? (
            <p className="font-semibold text-green-700">تم إرسال الرمز تلقائيًا على واتساب العميل.</p>
          ) : (
            <>
              {state.autoError && <p className="text-amber-700">الإرسال التلقائي لم ينجح: {state.autoError}</p>}
              <div className="flex flex-wrap gap-2">
                {state.link && (
                  <a href={state.link} target="_blank" rel="noopener noreferrer" className={ui.btnPrimary}>
                    أرسل على واتساب
                  </a>
                )}
                <button type="button" onClick={copy} className={ui.btnOutline}>
                  {copied ? 'تم النسخ' : 'نسخ الرسالة'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
