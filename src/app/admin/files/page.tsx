import type { Metadata } from 'next';
import Link from 'next/link';
import { draftFile, publishFile, trashFile } from '@/app/actions/productFiles';
import { requirePermission } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'الملفات' };

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { supabase, profile } = await requirePermission('files');
  const sp = await searchParams;
  const canPublish = (['products', 'bot_publish', 'published'] as const).some((k) => hasPermission(profile, k));
  const canTrash = (['products', 'files'] as const).some((k) => hasPermission(profile, k));

  const q = (byStage: boolean) => {
    const b = supabase.from('product_files').select('id,name,source,created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(200);
    return byStage ? b.eq('stage', 'inbox') : b.eq('source', 'bot').eq('is_public', false);
  };
  let res = await q(true);
  if (res.error) res = await q(false);
  const files = (res.data ?? []) as { id: string; name: string; source: string; created_at: string }[];
  const counts = new Map<string, number>();
  if (files.length) {
    const { data } = await supabase.from('products').select('file_id').in('file_id', files.map((f) => f.id)).is('deleted_at', null).limit(50000);
    for (const r of data ?? []) counts.set(r.file_id as string, (counts.get(r.file_id as string) ?? 0) + 1);
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold">📁 الملفات الجديدة</h1>
      <p className="text-sm text-gray-600">الملفات اللي جاية من بوت تليجرام. قرّر لكل ملف: ينتقل للمسودات، أو للعلن، أو يتحذف.</p>
      {sp.msg && <p className={ui.alertOk}>{sp.msg}</p>}
      {files.length === 0 ? (
        <p className="py-8 text-center text-gray-500">مفيش ملفات جديدة.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                <Link href={`/admin/products/files/${f.id}`} className="font-bold text-brand-600 hover:underline">📄 {f.name}</Link>
                <span className="mr-2 text-xs text-gray-500">{counts.get(f.id) ?? 0} منتج · {new Date(f.created_at).toLocaleDateString('ar-EG')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Link href={`/admin/products/files/${f.id}`} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">فتح</Link>
                <form action={draftFile}>
                  <input type="hidden" name="id" value={f.id} /><input type="hidden" name="back" value="/admin/files" />
                  <button className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">للمسودة</button>
                </form>
                {canPublish && (
                  <form action={publishFile}>
                    <input type="hidden" name="id" value={f.id} /><input type="hidden" name="back" value="/admin/files" />
                    <button className="rounded border border-green-500 bg-green-50 px-2 py-1 text-xs font-bold text-green-800">للعلن</button>
                  </form>
                )}
                {canTrash && (
                  <form action={trashFile}>
                    <input type="hidden" name="id" value={f.id} /><input type="hidden" name="back" value="/admin/files" />
                    <button className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">حذف</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
