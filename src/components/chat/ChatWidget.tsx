'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, Send, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { matchTopic, TOPICS, wantsHuman, type BotAnswer } from '@/lib/chatBot';

type BotMsg = { from: 'bot' | 'me'; text: string; link?: BotAnswer['link'] };
type Msg = { id: string; sender: 'customer' | 'staff'; sender_name: string | null; body: string; created_at: string };

const GREETING: BotMsg = { from: 'bot', text: 'أهلًا بك في Kama Store 👋 اختر سؤالًا أو اكتب سؤالك، ولو عايز تتكلم مع شخص اضغط «تحدث مع شخص».' };

export default function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'bot' | 'human'>('bot');
  const [botMsgs, setBotMsgs] = useState<BotMsg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [needLogin, setNeedLogin] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ block: 'end' }), [botMsgs, msgs, open, mode]);

  const load = useCallback(async (id: string) => {
    const supabase = createClient();
    const [{ data: m }, { data: c }] = await Promise.all([
      supabase.from('chat_messages').select('id,sender,sender_name,body,created_at').eq('conversation_id', id).order('created_at', { ascending: true }),
      supabase.from('chat_conversations').select('status').eq('id', id).maybeSingle(),
    ]);
    setMsgs((m ?? []) as Msg[]);
    setStatus((c?.status as string) ?? '');
  }, []);

  // تحديث دوري للمحادثة المفتوحة مع شخص
  useEffect(() => {
    if (!open || mode !== 'human' || !convId) return;
    void load(convId);
    const t = setInterval(() => void load(convId), 4000);
    return () => clearInterval(t);
  }, [open, mode, convId, load]);

  if (pathname.startsWith('/admin')) return null;

  function ask(text: string) {
    const t = text.trim();
    if (!t) return;
    setInput('');
    if (wantsHuman(t)) {
      setBotMsgs((p) => [...p, { from: 'me', text: t }]);
      void startHuman();
      return;
    }
    const topic = matchTopic(t);
    setBotMsgs((p) => [
      ...p,
      { from: 'me', text: t },
      topic
        ? { from: 'bot', text: topic.answer.text, link: topic.answer.link }
        : { from: 'bot', text: 'مش متأكد إني فهمت سؤالك. تقدر تختار من الأسئلة السريعة أو تضغط «تحدث مع شخص» وهيرد عليك فريقنا.' },
    ]);
  }

  async function startHuman() {
    setError('');
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNeedLogin(true);
        return;
      }
      // نستخدم آخر محادثة غير مغلقة، وإلا ننشئ واحدة جديدة
      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('user_id', user.id)
        .neq('status', 'closed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      let id = existing?.id as string | undefined;
      if (!id) {
        const name = String(user.user_metadata?.full_name ?? user.email ?? '').slice(0, 100);
        const { data, error: e } = await supabase
          .from('chat_conversations')
          .insert({ user_id: user.id, customer_name: name })
          .select('id')
          .single();
        if (e || !data) throw e ?? new Error('no row');
        id = data.id as string;
        await supabase.from('chat_messages').insert({ conversation_id: id, sender: 'customer', sender_name: name, body: 'أرغب في التحدث مع شخص من فريق الدعم.' });
      }
      setConvId(id);
      setMode('human');
    } catch {
      setError('تعذّر بدء المحادثة الآن. حاول مرة أخرى بعد قليل.');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const body = input.trim();
    if (!body || !convId || busy) return;
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const name = String(user?.user_metadata?.full_name ?? user?.email ?? '').slice(0, 100);
    const { error: e } = await supabase.from('chat_messages').insert({ conversation_id: convId, sender: 'customer', sender_name: name, body: body.slice(0, 2000) });
    setBusy(false);
    if (e) {
      setError('تعذّر إرسال الرسالة. حاول مرة أخرى.');
      return;
    }
    setInput('');
    void load(convId);
  }

  return (
    <div className="fixed bottom-4 start-4 z-50" dir="rtl">
      {open && (
        <div className="mb-3 flex h-[28rem] w-[19rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:w-80">
          <div className="flex items-center justify-between bg-brand-800 px-4 py-3 text-white">
            <span className="font-bold">{mode === 'bot' ? 'مساعد Kama Store' : 'الدعم'}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق"><X className="h-5 w-5" /></button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-3 text-sm">
            {mode === 'bot' ? (
              <>
                {botMsgs.map((m, i) => (
                  <div key={i} className={m.from === 'me' ? 'flex justify-start' : 'flex justify-end'}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.from === 'me' ? 'bg-accent-300 text-gray-900' : 'bg-white shadow-sm'}`}>
                      <p>{m.text}</p>
                      {m.link && <Link href={m.link.href} className="mt-1 block font-semibold text-brand-600 hover:underline">{m.link.label} ←</Link>}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {TOPICS.map((t) => (
                    <button key={t.id} type="button" onClick={() => ask(t.label)} className="rounded-full border border-brand-200 bg-white px-3 py-1 text-xs text-brand-700 hover:bg-brand-50">
                      {t.label}
                    </button>
                  ))}
                </div>
                {needLogin && (
                  <p className="rounded-lg bg-amber-50 p-2 text-amber-900">
                    للتحدث مع شخص يلزم تسجيل الدخول أولًا. <Link href="/auth/login?next=/" className="font-bold underline">سجّل الدخول</Link>
                  </p>
                )}
              </>
            ) : (
              <>
                {msgs.map((m) => (
                  <div key={m.id} className={m.sender === 'customer' ? 'flex justify-start' : 'flex justify-end'}>
                    <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${m.sender === 'customer' ? 'bg-accent-300 text-gray-900' : 'bg-white shadow-sm'}`}>
                      {m.sender === 'staff' && <p className="mb-0.5 text-xs font-bold text-brand-700">فريق الدعم</p>}
                      {m.body}
                    </div>
                  </div>
                ))}
                {status === 'waiting' && <p className="text-center text-xs text-gray-500">تم إبلاغ فريقنا، وسيرد عليك في أقرب وقت. اترك رسالتك هنا.</p>}
                {status === 'closed' && <p className="text-center text-xs text-gray-500">تم إغلاق هذه المحادثة. أرسل رسالة جديدة لإعادة فتحها.</p>}
              </>
            )}
            {error && <p className="rounded-lg bg-red-50 p-2 text-red-700">{error}</p>}
            <div ref={bottom} />
          </div>

          <div className="border-t border-gray-200 bg-white p-2">
            {mode === 'bot' && (
              <button type="button" disabled={busy} onClick={() => void startHuman()} className="mb-2 w-full rounded-lg border border-brand-300 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                👤 تحدث مع شخص
              </button>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (mode === 'bot') ask(input);
                else void send();
              }}
              className="flex gap-2"
            >
              <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder="اكتب رسالتك..." className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
              <button type="submit" disabled={busy} aria-label="إرسال" className="rounded-lg bg-brand-800 px-3 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
            </form>
          </div>
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="الدردشة" className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-400 text-gray-900 shadow-lg hover:bg-accent-500">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
