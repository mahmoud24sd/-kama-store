const AR = '٠١٢٣٤٥٦٧٨٩';
const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR.indexOf(d))).replace(/[٬,]/g, ',');

const CUR = '(?:جنيه|جنية|ج\\.?\\s?م\\.?|ج|egp|le|l\\.e\\.?|£)';
const NUM = '(\\d{1,3}(?:,\\d{3})+|\\d{2,6})(?:\\.\\d{1,2})?';

/** يستخرج الاسم والسعر والوصف من نص الرسالة. السعر: رقم بجوار «جنيه/ج/EGP» أو بعد كلمة «سعر» */
export function parseCaption(raw: string): { name: string; price: number | null; description: string } {
  const text = toLatin(raw ?? '').replace(/\r/g, '');
  let price: number | null = null;
  let matched = '';
  const patterns = [new RegExp(`${NUM}\\s*${CUR}(?![\\p{L}])`, 'iu'), new RegExp(`(?:السعر|سعر|بسعر|price)\\s*[:：=\\-]?\\s*${NUM}`, 'iu'), new RegExp(`${CUR}\\s*[:：]?\\s*${NUM}`, 'iu')];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number((m[1] ?? '').replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) {
        price = n;
        matched = m[0];
        break;
      }
    }
  }
  const cleaned = matched ? text.replace(matched, ' ') : text;
  const lines = cleaned
    .split('\n')
    .map((l) => l.replace(/https?:\/\/\S+/g, '').replace(/[ \t]+/g, ' ').trim())
    .filter((l) => /[\p{L}\d]/u.test(l) && !/^(?:السعر|سعر|بسعر|price)\s*[:：=\-]?$/iu.test(l));
  const name = (lines[0] ?? '').replace(/^[^\p{L}\d]+/u, '').slice(0, 150);
  const description = lines.slice(1).join('\n').slice(0, 3000);
  return { name, price, description };
}

/** زيادة نسبة مئوية على السعر مع تقريب لأقرب جنيه */
export const withMarkup = (price: number, percent: number) => Math.round(price * (1 + percent / 100));

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export const csvRow = (cols: unknown[]) => cols.map(esc).join(',');
