'use client';

import { useState } from 'react';

/** معاينة بانر حقيقي داخل صفحة الأدمن (بتتحمّل عند الضغط فقط عشان ما تتحسبش مشاهدات كتير) */
export default function AdPreview({ adKey, src, width, height }: { adKey: string; src: string; width: number; height: number }) {
  const [on, setOn] = useState(false);
  const doc = `<!doctype html><html><body style="margin:0;overflow:hidden"><script>atOptions={'key':'${adKey}','format':'iframe','height':${height},'width':${width},'params':{}};</script><script src="${src}"></script></body></html>`;
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOn(!on)} className="rounded border border-gray-300 px-2 py-0.5 text-[11px] hover:bg-gray-50">{on ? 'إخفاء المعاينة' : '👁 معاينة الإعلان'}</button>
      {on && (
        <div className="mt-1 overflow-x-auto">
          <iframe title="معاينة" srcDoc={doc} width={width} height={height} scrolling="no" className="border border-gray-200 bg-white" />
          <p className="text-[10px] text-gray-500">لو فاضي: الشبكة ممكن ما تعرضش إعلان وقتها أو الـ AdBlock شغّال عندك.</p>
        </div>
      )}
    </div>
  );
}
