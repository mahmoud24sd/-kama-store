/** أزرار مشاركة المنتج + اطلب على واتساب (روابط عادية بدون جافاسكربت) */
export default function ShareButtons({ url, name, price, whatsapp }: { url: string; name: string; price: string; whatsapp: string }) {
  const text = `${name}\n${price}\n${url}`;
  const enc = encodeURIComponent;
  const btn = 'inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold transition hover:bg-gray-50';
  const waOrder = whatsapp ? `${whatsapp}${whatsapp.includes('?') ? '&' : '?'}text=${enc(`مرحبا، عايز أطلب: ${name}\n${price}\n${url}`)}` : '';
  return (
    <div className="space-y-2">
      {waOrder && (
        <a href={waOrder} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-base font-bold text-white hover:bg-green-700">
          💬 اطلب على واتساب
        </a>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-600">شارك المنتج:</span>
        <a href={`https://wa.me/?text=${enc(text)}`} target="_blank" rel="noopener noreferrer" className={`${btn} border-green-300 text-green-700`}>واتساب</a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener noreferrer" className={`${btn} border-blue-300 text-blue-700`}>فيسبوك</a>
        <a href={`https://t.me/share/url?url=${enc(url)}&text=${enc(`${name} — ${price}`)}`} target="_blank" rel="noopener noreferrer" className={`${btn} border-sky-300 text-sky-700`}>تليجرام</a>
      </div>
    </div>
  );
}
