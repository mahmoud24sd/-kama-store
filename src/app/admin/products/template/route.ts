import { requireAdmin } from '@/lib/auth';

export async function GET() {
  await requireAdmin();
  const csv =
    '﻿' +
    [
      'name,price,compare_at_price,stock,category,brand,shop_name,description,details,image_urls,publish,cost_price,supplier,private_notes',
      '"تيشيرت قطن",199,249,20,أزياء,Kama,محل كاما,"تيشيرت قطن مريح","الخامة: قطن 100%|المقاسات: S - M - L|بلد الصنع: مصر","https://example.com/1.jpg|https://example.com/2.jpg",yes,120,مصنع النور,"خصم 10% للكمية"',
      '"حقيبة ظهر",350,,10,أزياء,,,,,"https://example.com/bag.jpg",,200,,',
    ].join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="products-template.csv"',
    },
  });
}
