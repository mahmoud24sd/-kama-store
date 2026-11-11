'use client';

import { useRef, useState } from 'react';
import { csvRow, parseCaption } from '@/lib/telegramParse';
import { ui } from '@/lib/ui';

type TgText = string | { text?: string }[];
type TgMessage = { id: number; type?: string; date?: string; date_unixtime?: string; from_id?: string | number; from?: string; photo?: string; text?: TgText };
type Item = { name: string; price: number | null; description: string; photos: string[]; date: number };

const HEADER = 'name,price,compare_at_price,stock,category,brand,shop_name,description,details,image_urls,publish,cost_price,supplier,private_notes,affiliate_url,asin';

const flat = (t: TgText | undefined) => (Array.isArray(t) ? t.map((p) => (typeof p === 'string' ? p : p.text ?? '')).join('') : t ?? '');
const ts = (m: TgMessage) => (m.date_unixtime ? Number(m.date_unixtime) * 1000 : m.date ? new Date(m.date).getTime() : 0);

export default function TelegramImport() {
  const [files, setFiles] = useState<File[]>([]);
  const [days, setDays] = useState(30);
  const [fixed, setFixed] = useState(50);
  const [percent, setPercent] = useState(0);
  const [category, setCategory] = useState('');
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('');
  const [error, setError] = useState('');
  const [csvUrl, setCsvUrl] = useState('');
  const abort = useRef(false);

  async function run() {
    setError('');
    setCsvUrl('');
    setLog('');
    abort.current = false;
    // نبني خريطة المسارات داخل المجلد المُصدَّر
    const byPath = new Map<string, File>();
    let jsonFile: File | undefined;
    for (const f of files) {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      const inner = rel.includes('/') ? rel.slice(rel.indexOf('/') + 1) : rel;
      byPath.set(inner, f);
      if (inner === 'result.json') jsonFile = f;
    }
    if (!jsonFile) return setError('ما لقيتش ملف result.json داخل المجلد. اختار مجلد التصدير نفسه (ChatExport...) وتأكد إن الصيغة JSON.');

    setBusy(true);
    try {
      const root = JSON.parse(await jsonFile.text()) as { name?: string; messages?: TgMessage[]; chats?: { list?: { name?: string; messages?: TgMessage[] }[] } };
      const chats = root.messages ? [{ name: root.name, messages: root.messages }] : (root.chats?.list ?? []);
      const since = Date.now() - days * 86400000;
      const items: (Item & { source: string })[] = [];

      for (const chat of chats) {
        const msgs = (chat.messages ?? []).filter((m) => m.type === 'message' && ts(m) >= since).sort((a, b) => ts(a) - ts(b));
        let cur: (Item & { source: string; from?: string | number }) | null = null;
        for (const m of msgs) {
          const text = flat(m.text);
          const hasPhoto = Boolean(m.photo && !m.photo.startsWith('('));
          // ألبوم: صور متتالية من نفس المرسل خلال ثواني بدون نص تُضم للمنتج السابق
          if (cur && hasPhoto && !text && cur.from === m.from_id && ts(m) - cur.date <= 5000) {
            cur.photos.push(m.photo as string);
            continue;
          }
          if (!hasPhoto && !text) continue;
          const p = parseCaption(text);
          cur = { name: p.name, price: p.price, description: p.description, photos: hasPhoto ? [m.photo as string] : [], date: ts(m), source: chat.name || root.name || 'تليجرام', from: m.from_id };
          items.push(cur);
        }
      }

      // نحتفظ فقط بما له اسم وسعر وصورة، ونمنع التكرار
      const seen = new Set<string>();
      const ready = items.filter((i) => {
        const k = `${i.name}|${i.price}`;
        if (!i.name || i.price == null || i.photos.length === 0 || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const skipped = items.length - ready.length;
      if (ready.length === 0) {
        setBusy(false);
        return setError(`ما لقيتش منتجات فيها اسم وسعر وصورة خلال آخر ${days} يوم (${items.length} رسالة اتفحصت). اتأكد إن التصدير فيه الصور (Photos) وإن الأسعار مكتوبة في الرسائل.`);
      }

      // رفع الصور (3 في نفس الوقت)
      const urls = new Map<string, string>();
      const queue = ready.flatMap((i) => i.photos.slice(0, 4));
      let done = 0;
      let failed = 0;
      async function worker() {
        while (queue.length > 0 && !abort.current) {
          const path = queue.shift() as string;
          const f = byPath.get(path);
          if (!f) { failed++; continue; }
          try {
            const fd = new FormData();
            fd.append('file', f);
            const res = await fetch('/api/telegram-import/upload', { method: 'POST', body: fd });
            const j = (await res.json()) as { url?: string };
            if (j.url) urls.set(path, j.url);
            else failed++;
          } catch {
            failed++;
          }
          done++;
          setLog(`جارٍ رفع الصور... ${done} من ${done + queue.length}${failed ? ` (فشل ${failed})` : ''}`);
        }
      }
      await Promise.all([worker(), worker(), worker()]);

      const rows: string[] = [];
      let noImg = 0;
      for (const i of ready) {
        const imgs = i.photos.slice(0, 4).map((p) => urls.get(p)).filter((u): u is string => Boolean(u));
        if (imgs.length === 0) { noImg++; continue; }
        const price = Math.round((i.price as number) * (1 + percent / 100) + fixed);
        const when = new Date(i.date).toLocaleDateString('en-GB');
        rows.push(csvRow([i.name, price, '', 10, category, '', '', i.description, '', imgs.join('|'), publish ? 'yes' : '', i.price, i.source, `السعر الأصلي: ${i.price} · المصدر: ${i.source} · تاريخ الرسالة: ${when}`, '', '']));
      }
      if (rows.length === 0) { setBusy(false); return setError('فشل رفع كل الصور. حاول تاني، وتأكد إنك داخل بحساب المالك.'); }
      const blob = new Blob(['﻿' + [HEADER, ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
      setCsvUrl(URL.createObjectURL(blob));
      setLog(`تم: ${rows.length} منتج في الملف${skipped ? ` · ${skipped} رسالة تخطيتها (بدون سعر أو صورة أو مكررة)` : ''}${noImg ? ` · ${noImg} بدون صورة بعد فشل الرفع` : ''}.`);
    } catch {
      setError('تعذّرت قراءة الملف. اتأكد إنك اخترت مجلد التصدير بصيغة JSON.');
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="font-bold">ليه بالتصدير وليس من اللينك؟</p>
        <p>
          تليجرام ما بيسمحش للبوتات بقراءة رسائل الجروب القديمة، وقراءتها من لينك محتاجة تسجيل دخول بحسابك الشخصي وده بيعرّض حسابك للإيقاف. فاستخدم أداة التصدير الرسمية المجانية في تطبيق تليجرام على الكمبيوتر، وبعدها الصفحة دي تعمل الباقي.
        </p>
      </section>

      <section className="space-y-2 rounded-xl border border-gray-200 p-4 text-sm">
        <h2 className="font-bold">الخطوات</h2>
        <ol className="list-decimal space-y-1 pr-5">
          <li>حمّل تليجرام للكمبيوتر: <a className="text-brand-600 underline" href="https://desktop.telegram.org" target="_blank" rel="noopener noreferrer">desktop.telegram.org</a> وسجّل دخول.</li>
          <li>افتح الجروب أو القناة، واضغط على النقط الثلاث (⋮) فوق ← <b>Export chat history</b>.</li>
          <li>علّم على <b>Photos</b> بس (ولغِ الباقي)، واختار الصيغة <b>JSON</b>، وحدد <b>تاريخ البداية</b> قبل 30 يوم، واضغط Export.</li>
          <li>لما يخلّص، ارجع هنا واختار المجلد اللي اتصدّر (اسمه ChatExport...).</li>
          <li>اكتب الزيادة واضغط «ابدأ»، ولما يخلّص حمّل ملف إكسل وارفعه من «استيراد المنتجات».</li>
        </ol>
      </section>

      <section className="grid gap-3 rounded-xl border border-gray-200 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={ui.label} htmlFor="folder">مجلد التصدير</label>
          <input
            id="folder"
            type="file"
            multiple
            ref={(el) => el?.setAttribute('webkitdirectory', '')}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className={ui.input}
          />
          {files.length > 0 && <p className="mt-1 text-xs text-gray-500">{files.length} ملف</p>}
        </div>
        <div><label className={ui.label} htmlFor="days">آخر كم يوم</label><input id="days" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value) || 30)} className={ui.input} /></div>
        <div><label className={ui.label} htmlFor="fixed">زيادة ثابتة على كل منتج (جنيه)</label><input id="fixed" type="number" min={0} value={fixed} onChange={(e) => setFixed(Number(e.target.value) || 0)} className={ui.input} /></div>
        <div><label className={ui.label} htmlFor="percent">زيادة نسبة % (اختياري)</label><input id="percent" type="number" min={0} max={1000} value={percent} onChange={(e) => setPercent(Number(e.target.value) || 0)} className={ui.input} /></div>
        <div><label className={ui.label} htmlFor="cat">القسم (نفس اسمه في موقعك)</label><input id="cat" value={category} onChange={(e) => setCategory(e.target.value)} className={ui.input} /></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> انشر المنتجات مباشرة عند الاستيراد (وإلا تدخل مخفية لحد ما تراجعها)</label>
        <p className="text-xs text-gray-500 sm:col-span-2">سعر البيع = (السعر الأصلي × (1 + النسبة)) + الزيادة الثابتة. السعر الأصلي والمصدر يتحفظوا كـ «سعر التكلفة» و«ملاحظات خاصة» (للمالك والأدمن فقط).</p>
        <div className="flex gap-2 sm:col-span-2">
          <button type="button" disabled={busy || files.length === 0} onClick={run} className={ui.btnPrimary}>{busy ? 'جارٍ العمل...' : 'ابدأ'}</button>
          {busy && <button type="button" onClick={() => { abort.current = true; }} className={ui.btnOutline}>إيقاف</button>}
        </div>
        {error && <p className={`${ui.alertError} sm:col-span-2`}>{error}</p>}
        {log && <p className="text-sm sm:col-span-2">{log}</p>}
        {csvUrl && (
          <a href={csvUrl} download={`telegram-products-${new Date().toISOString().slice(0, 10)}.csv`} className={`${ui.btnDark} sm:col-span-2`}>تحميل ملف الإكسل</a>
        )}
      </section>
    </div>
  );
}
