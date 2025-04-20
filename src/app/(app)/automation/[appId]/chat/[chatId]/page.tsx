// import { loadChat } from '@/db/actions/Messages';
import { loadChat } from '@/tools/static/chat-store';
import Chat from '@/components/chat';

export default async function Page(props: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await props.params; // get the chat ID from the URL
  const messages = await loadChat(chatId); // load the chat messages
  return <Chat id={chatId} initialMessages={messages} />; // display the chat
}
