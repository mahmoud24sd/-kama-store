'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * إشعار للمالك/الأدمن (صلاحية chat) في أي صفحة من الموقع عند وجود عميل ينتظر ردًا:
 * شريط أعلى الشاشة + رقم في عنوان التبويب + إشعار متصفح اختياري. لا يظهر للعملاء.
 */
export default function StaffChatNotifier() {
  const pathname = usePathname();
  const [isStaff, setIsStaff] = useState(false);
  const [count, setCount] = useState(0);
  const [perm, setPerm] = useState<string>('unsupported');
  const prev = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !alive) return;
      const { data: p } = await supabase.from('profiles').select('role,permissions').eq('id', user.id).maybeSingle();
      const ok = p?.role === 'owner' || (p?.role === 'admin' && Array.isArray(p.permissions) && p.permissions.includes('chat'));
      if (!ok || !alive) return;
      setIsStaff(true);
      if (typeof Notification !== 'undefined') setPerm(Notification.permission);
      const tick = async () => {
        const { count: c } = await supabase.from('chat_conversations').select('id', { count: 'exact', head: true }).eq('status', 'waiting');
        if (!alive) return;
        const n = c ?? 0;
        if (n > prev.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Kama Store', { body: 'عميل ينتظر ردك في الدردشة' });
        }
        prev.current = n;
        setCount(n);
      };
      void tick();
      timer = setInterval(() => void tick(), 10000);
    })();
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isStaff) return;
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [count, isStaff, pathname]);

  // داخل لوحة الإدارة يظهر شريط ChatAlert الخاص بها
  if (!isStaff || count === 0 || pathname.startsWith('/admin')) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 bg-amber-400 px-3 py-2 text-sm font-bold text-gray-900 shadow" role="status">
      <Bell className="h-4 w-4 shrink-0" />
      <Link href="/admin/chat" className="underline">{count === 1 ? 'عميل ينتظر ردك في الدردشة' : `${count} عملاء ينتظرون ردك في الدردشة`}</Link>
      {perm === 'default' && (
        <button type="button" className="rounded bg-white/70 px-2 py-0.5 text-xs" onClick={() => void Notification.requestPermission().then(setPerm)}>
          فعّل إشعارات المتصفح
        </button>
      )}
    </div>
  );
}
