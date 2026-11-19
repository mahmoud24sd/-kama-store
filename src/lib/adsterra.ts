/** إحصائيات إعلانات Adsterra عن طريق الـ API الرسمي. المفتاح في متغير بيئة ADSTERRA_API_KEY (مش في الكود) */
export type AdDay = { date: string; impressions: number; clicks: number; revenue: number };
export type AdStats = { days: AdDay[]; impressions: number; clicks: number; revenue: number; ctr: number; cpm: number };

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const adsterraEnabled = () => Boolean(process.env.ADSTERRA_API_KEY);

export async function getAdStats(daysBack: number): Promise<{ stats?: AdStats; error?: string }> {
  const key = process.env.ADSTERRA_API_KEY;
  if (!key) return { error: 'nokey' };
  const end = new Date();
  const start = new Date(Date.now() - (daysBack - 1) * 86400000);
  const url = `https://api3.adsterratools.com/publisher/stats.json?start_date=${iso(start)}&finish_date=${iso(end)}&group_by=date`;
  try {
    const res = await fetch(url, { headers: { 'X-API-Key': key, Accept: 'application/json' }, next: { revalidate: 300 } });
    if (!res.ok) return { error: res.status === 401 || res.status === 403 ? 'auth' : `http ${res.status}` };
    const json = (await res.json()) as { items?: Record<string, unknown>[] };
    const days = (json.items ?? []).map((r) => ({
      date: String(r.date ?? r.day ?? ''),
      impressions: num(r.impression ?? r.impressions),
      clicks: num(r.clicks ?? r.click),
      revenue: num(r.revenue),
    })).sort((a, b) => b.date.localeCompare(a.date));
    const impressions = days.reduce((n, d) => n + d.impressions, 0);
    const clicks = days.reduce((n, d) => n + d.clicks, 0);
    const revenue = days.reduce((n, d) => n + d.revenue, 0);
    return { stats: { days, impressions, clicks, revenue, ctr: impressions ? (clicks / impressions) * 100 : 0, cpm: impressions ? (revenue / impressions) * 1000 : 0 } };
  } catch {
    return { error: 'network' };
  }
}
