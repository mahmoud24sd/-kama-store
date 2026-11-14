import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/cart', '/checkout', '/account', '/login'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
