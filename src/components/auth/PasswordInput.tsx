'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { ui } from '@/lib/ui';

type Props = {
  id: string;
  name: string;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
};

/** حقل كلمة مرور مع عين لإظهار/إخفاء ما كُتب */
export default function PasswordInput({ id, name, autoComplete, minLength }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        dir="ltr"
        className={`${ui.input} pe-10`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        aria-pressed={show}
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-gray-500 hover:text-gray-800"
      >
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}
