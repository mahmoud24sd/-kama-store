export const dynamic = 'force-static';

/** ملف ads.txt لجوجل AdSense */
export function GET() {
  return new Response('google.com, pub-8189426632233417, DIRECT, f08c47fec0942fa0\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
