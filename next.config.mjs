/** @type {import('next').NextConfig} */
const nextConfig = {
  // رفع صور المنتجات من لوحة الإدارة يتم عبر Server Actions
  experimental: {
    serverActions: { bodySizeLimit: '12mb' },
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
