'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertAdmin } from '@/lib/auth';
import { hasPermission, type Permission } from '@/lib/permissions';

const BUCKET = 'product-images';
const IDS = z.array(z.string().uuid()).max(1000);

async function ctx(perms: Permission[]) {
  const c = await assertAdmin();
  if (!perms.some((p) => hasPermission(c.profile, p))) throw new Error('FORBIDDEN');
  return c;
}
const canFiles: Permission[] = ['products', 'bot_publish', 'drafts', 'published'];
const canTrashMove: Permission[] = ['products', 'drafts', 'published'];
const canRestore: Permission[] = ['products', 'trash'];
const canPurge: Permission[] = ['trash_purge'];

function back(path: string, msg?: string): never {
  revalidatePath('/', 'layout');
  redirect(msg ? `${path}${path.includes('?') ? '&' : '?'}msg=${encodeURIComponent(msg)}` : path);
}
const fileId = (fd: FormData) => z.string().uuid().safeParse(fd.get('id'));
const where = (fd: FormData) => {
  const w = String(fd.get('back') ?? '/admin/products');
  return w.startsWith('/admin/') ? w : '/admin/products';
};

/** تعديل الزيادة (جنيه) على كل منتجات الملف: السعر = السعر الأصلي + الزيادة */
export async function saveFileMarkup(formData: FormData) {
  const { supabase } = await ctx(canFiles);
  const id = fileId(formData);
  const markup = z.coerce.number().min(0).max(1_000_000).safeParse(formData.get('markup'));
  if (!id.success || !markup.success) return back(where(formData), 'الزيادة لازم تكون رقم صحيح من 0 لفوق');
  const { error } = await supabase.rpc('apply_file_markup', { p_file: id.data, p_markup: markup.data });
  return back(where(formData), error ? 'تعذّر تعديل الزيادة. اتأكد إن ملف 020 اتشغّل.' : 'تم تعديل الزيادة على كل منتجات الملف');
}

/** نشر الملف للعلن (كمجموعة ومنتجات) أو إرجاعه مسودة */
async function setVisibility(formData: FormData, pub: boolean) {
  const { supabase, profile } = await ctx(canFiles);
  const id = fileId(formData);
  if (!id.success) return back(where(formData));
  await supabase.from('product_files').update({ is_public: pub }).eq('id', id.data);
  await supabase.from('products').update({ is_active: pub }).eq('file_id', id.data).is('deleted_at', null);
  if (pub) {
    const now = new Date().toISOString();
    await supabase.from('products').update({ published_by: profile.id, published_at: now }).eq('file_id', id.data).is('deleted_at', null);
  }
  return back(where(formData), pub ? 'الملف ظاهر للعلن دلوقتي' : 'الملف رجع مسودة (مخفي)');
}

export async function publishFile(formData: FormData) {
  return setVisibility(formData, true);
}
export async function draftFile(formData: FormData) {
  return setVisibility(formData, false);
}

/** حذف الملف كله = نقله للمهملات (يختفي من الموقع ويمكن استرجاعه) */
export async function trashFile(formData: FormData) {
  const { supabase } = await ctx(canTrashMove);
  const id = fileId(formData);
  if (!id.success) return back('/admin/products');
  const now = new Date().toISOString();
  await supabase.from('products').update({ deleted_at: now, is_active: false }).eq('file_id', id.data);
  await supabase.from('product_files').update({ deleted_at: now, is_public: false }).eq('id', id.data);
  return back('/admin/products', 'اتنقل الملف وكل منتجاته للمهملات');
}

export async function restoreFile(formData: FormData) {
  const { supabase } = await ctx(canRestore);
  const id = fileId(formData);
  if (!id.success) return back('/admin/trash');
  await supabase.from('products').update({ deleted_at: null }).eq('file_id', id.data);
  await supabase.from('product_files').update({ deleted_at: null }).eq('id', id.data);
  return back('/admin/trash', 'اترجع الملف كمسودة');
}

async function purgeProducts(supabase: Awaited<ReturnType<typeof ctx>>['supabase'], ids: string[]) {
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data: imgs } = await supabase.from('product_images').select('url').in('product_id', chunk);
    const paths = (imgs ?? []).map((x) => String(x.url)).map((u) => (u.includes(`/${BUCKET}/`) ? u.slice(u.indexOf(`/${BUCKET}/`) + BUCKET.length + 2) : null)).filter((x): x is string => Boolean(x));
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    await supabase.from('products').delete().in('id', chunk);
  }
}

/** حذف نهائي لملف من المهملات */
export async function purgeFile(formData: FormData) {
  const { supabase } = await ctx(canPurge);
  const id = fileId(formData);
  if (!id.success) return back('/admin/trash');
  const { data } = await supabase.from('products').select('id').eq('file_id', id.data);
  await purgeProducts(supabase, (data ?? []).map((p) => p.id as string));
  await supabase.from('product_files').delete().eq('id', id.data);
  return back('/admin/trash', 'اتحذف نهائيًا');
}

/** إجراء جماعي على منتجات محددة: publish | draft | trash | restore | purge */
async function runBulk(formData: FormData, op: string) {
  const need: Permission[] = op === 'publish' || op === 'draft' ? canFiles : op === 'trash' ? canTrashMove : op === 'restore' ? canRestore : canPurge;
  const { supabase, profile } = await ctx(need);
  const to = where(formData);
  const ids = IDS.safeParse(formData.getAll('ids').map(String));
  if (!ids.success || ids.data.length === 0) return back(to, 'حدّد منتج واحد على الأقل');
  const now = new Date().toISOString();
  if (op === 'publish') {
    await supabase.from('products').update({ is_active: true, published_by: profile.id, published_at: now }).in('id', ids.data).is('deleted_at', null);
    return back(to, `${ids.data.length} منتج ظاهر للعلن`);
  }
  if (op === 'draft') {
    await supabase.from('products').update({ is_active: false }).in('id', ids.data);
    return back(to, `${ids.data.length} منتج رجع مسودة`);
  }
  if (op === 'trash') {
    await supabase.from('products').update({ deleted_at: now, is_active: false }).in('id', ids.data);
    return back(to, `${ids.data.length} منتج اتنقل للمهملات`);
  }
  if (op === 'restore') {
    await supabase.from('products').update({ deleted_at: null, trash_reason: null }).in('id', ids.data);
    await supabase.from('products').update({ deleted_at: null }).in('id', ids.data);
    return back(to, `اترجع ${ids.data.length} منتج كمسودة`);
  }
  if (op === 'purge') {
    await purgeProducts(supabase, ids.data);
    return back(to, 'اتحذف نهائيًا');
  }
  return back(to);
}

export async function bulkPublish(formData: FormData) { return runBulk(formData, 'publish'); }
export async function bulkDraft(formData: FormData) { return runBulk(formData, 'draft'); }
export async function bulkTrash(formData: FormData) { return runBulk(formData, 'trash'); }
export async function bulkRestore(formData: FormData) { return runBulk(formData, 'restore'); }
export async function bulkPurge(formData: FormData) { return runBulk(formData, 'purge'); }

/** تفريغ المهملات بالكامل (حذف نهائي) */
export async function emptyTrash() {
  const { supabase } = await ctx(canPurge);
  const { data } = await supabase.from('products').select('id').not('deleted_at', 'is', null);
  await purgeProducts(supabase, (data ?? []).map((p) => p.id as string));
  await supabase.from('product_files').delete().not('deleted_at', 'is', null);
  return back('/admin/trash', 'المهملات اتفضّت');
}
