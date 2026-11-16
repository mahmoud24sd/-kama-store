import type { Metadata } from 'next';
import FolderTree from '@/components/admin/FolderTree';
import { requirePermission } from '@/lib/auth';
import { loadFolders } from '@/lib/folders';
import { hasPermission } from '@/lib/permissions';
import { getAllCategories } from '@/lib/queries';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'الملفات' };

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ msg?: string; folder?: string; fp?: string }> }) {
  const { supabase, profile } = await requirePermission('files');
  const sp = await searchParams;
  const canPublish = (['products', 'bot_publish', 'published'] as const).some((k) => hasPermission(profile, k));
  const canTrash = (['products', 'files'] as const).some((k) => hasPermission(profile, k));
  const canEdit = (['drafts_edit', 'products'] as const).some((k) => hasPermission(profile, k));
  const [{ folders }, cats] = await Promise.all([loadFolders(supabase, 'bot', 1, 300, 12), getAllCategories()]);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold">📁 كل ملفات البوت</h1>
      <p className="text-sm text-gray-600">كل الملفات اللي جاية من بوت تليجرام (جديدة ومسودة ومنشورة) بتظهر هنا كفولدرات، وعلى كل واحد علامة بتقول هو فين. افتح الفولدر تشوف المنتجات وعدّل القسم والسعر، وقرّر: مسودة أو علن أو حذف.</p>
      {sp.msg && !sp.folder && <p className={ui.alertOk}>{sp.msg}</p>}
      {folders.length === 0 ? (
        <p className="py-8 text-center text-gray-500">مفيش ملفات من البوت لسه.</p>
      ) : (
        <FolderTree canMerge={hasPermission(profile, 'merge_files')} uploaded folders={folders} back="/admin/files" cats={cats} canEdit={canEdit} canPublish={canPublish} canDraft canTrash={canTrash} noticeFolder={sp.folder} notice={sp.msg} />
      )}
    </div>
  );
}
