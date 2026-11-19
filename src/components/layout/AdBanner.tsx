'use client';

import { useEffect, useRef } from 'react';

const SRC = 'https://bauval.org/21/f26c277b56a180add6c7a07c55fa278d';
const ID = 'container-f26c277b56a180add6c7a07c55fa278d';
const POP_SRC = 'https://abscloud.org/1/ace67a975a55b3a1fa8964b47d3e47a8';

/** بانر إعلاني (Adsterra). حاوية واحدة بس في الصفحة لأن الكود بيدوّر على الـ id ده */
export default function AdBanner() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || host.dataset.loaded) return;
    host.dataset.loaded = '1';
    const s = document.createElement('script');
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    s.src = SRC;
    host.appendChild(s);
    if (!document.querySelector(`script[src="${POP_SRC}"]`)) {
      const p = document.createElement('script');
      p.setAttribute('data-cfasync', 'false');
      p.src = POP_SRC;
      document.body.appendChild(p);
    }
  }, []);
  return (
    <div className="mx-auto mt-8 max-w-7xl overflow-hidden px-4 text-center" aria-label="إعلان">
      <div ref={ref}>
        <div id={ID} />
      </div>
    </div>
  );
}
