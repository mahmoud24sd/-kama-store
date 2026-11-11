import type { Metadata } from 'next';
import TelegramImport from '@/components/admin/TelegramImport';
import { requireOwner } from '@/lib/auth';


export const metadata: Metadata = { title: 'استيراد من تليجرام' };

export default async function TelegramImportPage() {
  const { supabase } = await requireOwner();
  const { data } = await supabase.from('categories').select('name').order('name');
  const categories = (data ?? []).map((c) => c.name as string);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">استيراد منتجات من جروب أو قناة تليجرام</h1>
      <TelegramImport categories={categories} />
    </div>
  );
}
