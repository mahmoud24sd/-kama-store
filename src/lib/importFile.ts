import { parseCsv } from '@/lib/csv';
import { readXlsx } from '@/lib/xlsx';

const cellText = (v: unknown): string => {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(cellText).filter(Boolean).join('|');
  if (typeof v === 'boolean') return v ? 'yes' : '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** JSON: مصفوفة منتجات (أو { products: [...] }) → صفوف بنفس شكل CSV (الصف الأول عناوين) */
export function jsonToRows(text: string): string[][] {
  const data = JSON.parse(text.replace(/^﻿/, '')) as unknown;
  const list = Array.isArray(data) ? data : Array.isArray((data as { products?: unknown })?.products) ? ((data as { products: unknown[] }).products) : null;
  if (!list) throw new Error('ملف JSON لازم يكون قايمة منتجات');
  const objs = list.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x));
  const keys: string[] = [];
  for (const o of objs) for (const k of Object.keys(o)) if (!keys.includes(k)) keys.push(k);
  return [keys, ...objs.map((o) => keys.map((k) => cellText(o[k])))];
}

/** يقرأ ملف (xlsx أو json أو csv) أو نصًّا ملصوقًا ويرجع جدولًا. */
export async function readTable(input: File | string): Promise<{ rows: string[][]; kind: 'xlsx' | 'json' | 'csv' }> {
  if (typeof input === 'string') return textTable(input);
  const bytes = Buffer.from(await input.arrayBuffer());
  if (bytes.length > 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return { rows: readXlsx(bytes), kind: 'xlsx' };
  return textTable(bytes.toString('utf8'));
}

function textTable(text: string) {
  const t = text.replace(/^﻿/, '').trim();
  if (t.startsWith('[') || t.startsWith('{')) return { rows: jsonToRows(t), kind: 'json' as const };
  return { rows: parseCsv(text), kind: 'csv' as const };
}
