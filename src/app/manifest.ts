import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Kama Store — تسوق أونلاين',
    short_name: 'Kama Store',
    description: 'Kama Store: متجر إلكتروني لكل احتياجاتك بأسعار مميزة وشحن سريع.',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/?source=app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#154f5c',
    categories: ['shopping'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'كل المنتجات', url: '/products' },
      { name: 'السلة', url: '/cart' },
    ],
  };
}
