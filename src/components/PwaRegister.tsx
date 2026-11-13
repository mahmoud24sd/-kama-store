'use client';

import { useEffect } from 'react';

/** يسجّل الـ service worker عشان الموقع يتثبّت كتطبيق */
export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => null);
    }
  }, []);
  return null;
}
