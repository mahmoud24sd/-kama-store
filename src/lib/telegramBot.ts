export type BotInfo = { username: string; name: string } | null;

/** بيانات البوت من تليجرام (اسم المستخدم لعمل الرابط). ترجع null لو التوكن غير مضبوط أو غير صالح */
export async function getBotInfo(): Promise<BotInfo> {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
    const j = (await res.json()) as { ok?: boolean; result?: { username?: string; first_name?: string } };
    if (!j.ok || !j.result?.username) return null;
    return { username: j.result.username, name: j.result.first_name ?? j.result.username };
  } catch {
    return null;
  }
}
