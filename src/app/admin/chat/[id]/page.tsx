import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChatBoundary from '@/components/chat/ChatBoundary';
import StaffChatThread from '@/components/chat/StaffChatThread';
import { requirePermission } from '@/lib/auth';

export const metadata: Metadata = { title: 'محادثة' };

export default async function AdminChatThread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requirePermission('chat');
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: conv } = await supabase.from('chat_conversations').select('id,customer_name').eq('id', id).maybeSingle();
  if (!conv) notFound();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">محادثة: {(conv.customer_name as string) || 'عميل'}</h1>
        <Link href="/admin/chat" className="text-sm text-brand-600 hover:underline">← كل المحادثات</Link>
      </div>
      <ChatBoundary>
        <StaffChatThread conversationId={id} staffName={profile.full_name || 'الدعم'} />
      </ChatBoundary>
    </div>
  );
}
