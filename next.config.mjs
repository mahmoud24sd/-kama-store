/** @type {import('next').NextConfig} */
const nextConfig = {
  // رفع صور المنتجات من لوحة الإدارة يتم عبر Server Actions
  experimental: {
    serverActions: { bodySizeLimit: '12mb' },
  },
  images: {
    // https من أي موقع: لأن الاستيراد بالجملة يستخدم روابط صور خارجية
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
