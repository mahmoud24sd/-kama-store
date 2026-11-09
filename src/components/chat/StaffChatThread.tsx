'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ui } from '@/lib/ui';

type Msg = { id: string; sender: 'customer' | 'staff'; sender_name: string | null; body: string; created_at: string };

export default function StaffChatThread({ conversationId, staffName }: { conversationId: string; staffName: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: m }, { data: c }] = await Promise.all([
      supabase.from('chat_messages').select('id,sender,sender_name,body,created_at').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
      supabase.from('chat_conversations').select('status').eq('id', conversationId).maybeSingle(),
    ]);
    setMsgs((m ?? []) as Msg[]);
    setStatus((c?.status as string) ?? '');
  }, [conversationId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => bottom.current?.scrollIntoView({ block: 'end' }), [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError('');
    const { error: err } = await createClient().from('chat_messages').insert({ conversation_id: conversationId, sender: 'staff', sender_name: staffName, body: body.slice(0, 2000) });
    setBusy(false);
    if (err) return setError('تعذّر الإرسال. تأكد أن لديك صلاحية الدردشة.');
    setText('');
    void load();
  }

  async function close() {
    const { error: err } = await createClient().from('chat_conversations').update({ status: 'closed' }).eq('id', conversationId);
    if (err) setError('تعذّر إغلاق المحادثة');
    else void load();
  }

  return (
    <div className="space-y-3">
      <div className="h-[26rem] space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
        {msgs.map((m) => (
          <div key={m.id} className={m.sender === 'customer' ? 'flex justify-start' : 'flex justify-end'}>
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${m.sender === 'customer' ? 'bg-white shadow-sm' : 'bg-brand-800 text-white'}`}>
              <p className="mb-0.5 text-xs opacity-70">{m.sender === 'customer' ? m.sender_name || 'العميل' : m.sender_name || 'الدعم'}</p>
              {m.body}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {error && <p className={ui.alertError}>{error}</p>}
      <form onSubmit={send} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب ردك..." maxLength={2000} className={ui.input} />
        <button disabled={busy} className={ui.btnDark}>إرسال</button>
        {status !== 'closed' && <button type="button" onClick={() => void close()} className={ui.btnOutline}>إغلاق المحادثة</button>}
      </form>
      {status === 'closed' && <p className="text-xs text-gray-500">المحادثة مغلقة. لو أرسل العميل رسالة جديدة ستُفتح تلقائيًا.</p>}
    </div>
  );
}
