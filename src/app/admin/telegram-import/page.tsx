import type { Metadata } from 'next';
import TelegramImport from '@/components/admin/TelegramImport';
import { requireOwner } from '@/lib/auth';

export const metadata: Metadata = { title: 'استيراد من تليجرام' };

export default async function TelegramImportPage() {
  await requireOwner();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">استيراد منتجات من جروب أو قناة تليجرام</h1>
      <TelegramImport />
    </div>
  );
}
