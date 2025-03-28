'use client';

import { useChat } from '@ai-sdk/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Cat, Bot } from 'lucide-react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    maxSteps: 3,
  });

  return (
    <div className="flex flex-col w-full h-full p-8 px-20">
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {messages.map(m => (
            <div key={m.id} className={`flex items-center gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role !== 'user' && (
                <Avatar className="border">
                  <AvatarFallback><Bot /></AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[80%] rounded-lg px-3 py-2 ${m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
                }`}>
                {m.content.length > 0 ? (
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                ) : (
                  <p className="italic text-sm opacity-70">
                    {'Calling tool: ' + m?.toolInvocations?.[0].toolName}
                  </p>
                )}
              </div>
              {m.role === 'user' && (
                <Avatar className="border"> {/* Increased size with h-12 w-12 */}
                  <AvatarFallback><Cat /></AvatarFallback> {/* Increased icon size */}
                </Avatar>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-2 justify-center">
        <input
          className="w-2/3 p-2 px-4 rounded-full border border-gray-300"
          value={input}
          placeholder="Type a message..."
          onChange={handleInputChange}
        />
      </form>
    </div>
  );
}