// Service worker بسيط: الموقع بيشتغل أونلاين دايمًا، ولو النت قطع بتظهر صفحة بدل خطأ المتصفح.
const OFFLINE = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kama Store</title><body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;margin:0;background:#effafb;color:#10333d"><div><h1>مفيش اتصال بالإنترنت</h1><p>اتأكد من الشبكة وحاول تاني.</p><button onclick="location.reload()" style="padding:10px 20px;border:0;border-radius:10px;background:#fbbf24;font-weight:700">إعادة المحاولة</button></div></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
