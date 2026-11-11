/** كود الشريك في أمازون. يمكن تغييره من Vercel بالمتغير AMAZON_ASSOCIATE_TAG */
const TAG = (process.env.AMAZON_ASSOCIATE_TAG ?? 'kama099-21').trim();

/** يضمن أن رابط أمازون يحمل كود الشريك الصحيح (الروابط المختصرة amzn.to تُترك كما هي لأنها تحمل كودها) */
export function affiliateHref(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (/(^|\.)amazon\.[a-z.]+$/i.test(u.hostname) && TAG) u.searchParams.set('tag', TAG);
    return u.toString();
  } catch {
    return url;
  }
}
