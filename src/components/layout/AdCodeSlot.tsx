'use client';

import { useEffect, useRef } from 'react';
import type { AdCode } from '@/lib/adCodes';

/** يشغّل كود إعلان واحد حسب نوعه (بدون HTML خام: بنبني العناصر بنفسنا من الحقول المنظّمة) */
export default function AdCodeSlot({ code }: { code: Pick<AdCode, 'type' | 'src' | 'container_id' | 'ad_key' | 'width' | 'height' | 'link_url' | 'link_label'> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (code.type !== 'container' && code.type !== 'script') return;
    if (!code.src) return;
    const host = code.type === 'container' ? ref.current : document.body;
    if (!host || host.querySelector(`script[src="${code.src}"]`)) return;
    const s = document.createElement('script');
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    s.src = code.src;
    host.appendChild(s);
  }, [code]);

  if (code.type === 'container') return <div ref={ref} className="mx-auto max-w-full overflow-hidden text-center"><div id={code.container_id ?? undefined} /></div>;
  if (code.type === 'banner' && code.src && code.ad_key) {
    const doc = `<!doctype html><html><body style="margin:0;overflow:hidden"><script>atOptions={'key':'${code.ad_key}','format':'iframe','height':${code.height},'width':${code.width},'params':{}};</script><script src="${code.src}"></script></body></html>`;
    return (
      <div className={`${(code.width ?? 0) > 400 ? 'hidden md:flex' : (code.width ?? 0) === 320 ? 'flex md:hidden' : 'flex'} justify-center overflow-hidden`} aria-label="إعلان">
        <iframe title="إعلان" srcDoc={doc} width={code.width ?? 300} height={code.height ?? 250} scrolling="no" loading="lazy" className="max-w-full border-0" />
      </div>
    );
  }
  if (code.type === 'link' && code.link_url) {
    return <div className="text-center"><a href={code.link_url} target="_blank" rel="sponsored noopener noreferrer" className="inline-block rounded-lg border border-accent-400 bg-accent-400/10 px-4 py-2 text-sm font-bold text-accent-600 hover:bg-accent-400/20">{code.link_label || '🎁 عروض مميزة'} <span className="text-[10px] font-normal text-gray-500">(إعلان)</span></a></div>;
  }
  return null;
}
