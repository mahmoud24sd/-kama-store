'use client';

import { useState } from 'react';
import { ui } from '@/lib/ui';

type Cat = { id: string; name: string; parent_id?: string | null };

/** اختيار قسم على خطوتين: القسم الرئيسي، وبعده يظهر الأقسام الفرعية بتاعته تختار منها. القيمة الفاضية = من غير تغيير */
export default function CategoryPicker({ cats, name = 'category_id' }: { cats: Cat[]; name?: string }) {
  const [main, setMain] = useState('');
  const [sub, setSub] = useState('');
  const mains = cats.filter((c) => !c.parent_id);
  const kids = main && main !== '__none' ? cats.filter((c) => c.parent_id === main) : [];
  const value = sub || main;

  return (
    <div className="space-y-1.5">
      <input type="hidden" name={name} value={value} />
      <select value={main} onChange={(e) => { setMain(e.target.value); setSub(''); }} className={ui.input} aria-label="القسم">
        <option value="">— من غير تغيير —</option>
        <option value="__none">بدون قسم</option>
        {mains.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {kids.length > 0 && (
        <select value={sub} onChange={(e) => setSub(e.target.value)} className={ui.input} aria-label="القسم الفرعي">
          <option value="">كل {mains.find((m) => m.id === main)?.name} (من غير فرعي)</option>
          {kids.map((c) => <option key={c.id} value={c.id}>↳ {c.name}</option>)}
        </select>
      )}
    </div>
  );
}
