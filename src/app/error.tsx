'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[page error]', error);
  }, [error]);
  return (
    <div className="mx-auto max-w-lg space-y-3 p-8 text-center">
      <h1 className="text-xl font-extrabold">الصفحة دي مش شغالة دلوقتي</h1>
      <p className="text-sm text-gray-600">جرّب إعادة المحاولة. لو لسه مش شغالة ابعت لنا الرسالة دي:</p>
      <p dir="ltr" className="break-words rounded-lg bg-gray-100 p-2 text-left text-xs text-gray-700">
        {error.message || 'unknown'} {error.digest ? `(digest: ${error.digest})` : ''}
      </p>
      <button type="button" onClick={reset} className="rounded-lg bg-brand-800 px-5 py-2 text-sm font-semibold text-white">إعادة المحاولة</button>
    </div>
  );
}
