import { redirect } from 'next/navigation';
import { createChat } from '@/tools/chat-store';

export default async function Page() {
  const id = await createChat(); // create a new chat
  redirect(`/automation/${id}`); // redirect to chat page, see below
}