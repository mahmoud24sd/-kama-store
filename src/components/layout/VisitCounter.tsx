'use client';

import { useEffect } from 'react';

/** يسجّل زيارة هذا المتصفح (مرة كل 30 دقيقة). لا يعرض شيئًا للزوار */
export default function VisitTracker() {
  useEffect(() => {
    fetch('/api/visit', { method: 'POST' }).catch(() => {});
  }, []);
  return null;
}
