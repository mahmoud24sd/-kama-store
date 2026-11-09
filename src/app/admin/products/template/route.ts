import { requireAdmin } from '@/lib/auth';

export async function GET() {
  await requireAdmin();
  const csv =
    '﻿' +
    [
      'name,price,compare_at_price,stock,category,brand,shop_name,description,image_urls,publish',
      '"تيشيرت قطن",199,249,20,أزياء,Kama,محل كاما,"تيشيرت قطن مريح","https://example.com/1.jpg|https://example.com/2.jpg",yes',
      '"حقيبة ظهر",350,,10,أزياء,,,,"https://example.com/bag.jpg",',
    ].join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="products-template.csv"',
    },
  });
}
