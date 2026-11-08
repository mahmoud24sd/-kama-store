'use client';

import { useActionState } from 'react';
import { createTempPassword, deleteUser, type TempPasswordState } from '@/app/actions/team';
import { ui } from '@/lib/ui';

const initial: TempPasswordState = {};

export default function UserActions({ id, canTemp, canDelete }: { id: string; canTemp: boolean; canDelete: boolean }) {
  const [state, action, pending] = useActionState(createTempPassword, initial);
  if (!canTemp && !canDelete) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canTemp && (
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={pending} className={ui.btnOutline}>
              {pending ? '...' : 'باسورد مؤقت'}
            </button>
          </form>
        )}
        {canDelete && (
          <form
            action={deleteUser}
            onSubmit={(e) => {
              if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم نهائيًا؟ لا يمكن التراجع.')) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={id} />
            <button type="submit" className={ui.btnDanger}>حذف</button>
          </form>
        )}
      </div>
      {state.error && <p className={ui.alertError}>{state.error}</p>}
      {state.password && (
        <p className={ui.alertOk}>
          كلمة المرور المؤقتة: <code dir="ltr" className="select-all font-bold">{state.password}</code>
          <span className="block text-xs">انسخها الآن وأرسلها للمستخدم، لن تظهر مرة أخرى.</span>
        </p>
      )}
    </div>
  );
}
