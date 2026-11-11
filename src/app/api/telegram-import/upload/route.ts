import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BUCKET = 'product-images';
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** رفع صورة واحدة من صفحة استيراد تليجرام. للمالك فقط */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!hasServiceRole) return NextResponse.json({ error: 'service role missing' }, { status: 500 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 });
    const ext = TYPES[file.type];
    if (!ext) return NextResponse.json({ error: 'type' }, { status: 415 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'size' }, { status: 413 });
    const db = createAdminClient();
    const path = `telegram/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
    const { error } = await db.storage.from(BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) return NextResponse.json({ error: 'upload' }, { status: 500 });
    return NextResponse.json({ url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl });
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
