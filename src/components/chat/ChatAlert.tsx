'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/** إشعار داخل الموقع للموظفين الذين لديهم صلاحية الدردشة: عدد العملاء المنتظرين ردًا. يتحدث كل 10 ثوانٍ. */
export default function ChatAlert() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const tick = async () => {
      const { count: c } = await supabase.from('chat_conversations').select('id', { count: 'exact', head: true }).eq('status', 'waiting');
      if (alive) setCount(c ?? 0);
    };
    void tick();
    const t = setInterval(() => void tick(), 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [count]);

  if (count === 0) return null;
  return (
    <Link
      href="/admin/chat"
      className="mb-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
      role="status"
    >
      <Bell className="h-5 w-5 shrink-0" />
      {count === 1 ? 'عميل واحد ينتظر ردك في الدردشة' : `${count} عملاء ينتظرون ردك في الدردشة`} — افتح الدردشة ←
    </Link>
  );
}
