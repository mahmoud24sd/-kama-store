/** @type {import('next').NextConfig} */
const nextConfig = {
  // رفع صور المنتجات من لوحة الإدارة يتم عبر Server Actions
  experimental: {
    serverActions: { bodySizeLimit: '12mb' },
  },
  images: {
    // https من أي موقع: لأن الاستيراد بالجملة يستخدم روابط صور خارجية
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    // الصورة بعد تصغيرها تبقى محفوظة 30 يوم بدل إعادة معالجتها
    minimumCacheTTL: 60 * 60 * 24 * 30,
    formats: ['image/webp'],
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
