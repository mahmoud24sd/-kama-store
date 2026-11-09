'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Provider = 'google' | 'facebook';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />
    </svg>
  );
}

export default function SocialButtons({ next }: { next: string }) {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState('');

  async function go(provider: Provider) {
    setError('');
    setLoading(provider);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) throw error;
      // عند النجاح يتم تحويل المتصفح إلى صفحة المزوّد
    } catch {
      setLoading(null);
      setError('تعذّر الدخول عبر هذه الخدمة الآن. جرّب بالبريد الإلكتروني أو حاول لاحقًا.');
    }
  }

  const btn =
    'flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60';

  return (
    <div className="space-y-3">
      <button type="button" className={btn} disabled={loading !== null} onClick={() => go('google')}>
        <GoogleIcon /> {loading === 'google' ? 'جارٍ التحويل...' : 'المتابعة باستخدام Google'}
      </button>
      <button type="button" className={btn} disabled={loading !== null} onClick={() => go('facebook')}>
        <FacebookIcon /> {loading === 'facebook' ? 'جارٍ التحويل...' : 'المتابعة باستخدام Facebook'}
      </button>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex items-center gap-3 pt-1 text-xs text-gray-500">
        <span className="h-px flex-1 bg-gray-200" /> أو بالبريد الإلكتروني <span className="h-px flex-1 bg-gray-200" />
      </div>
    </div>
  );
}
