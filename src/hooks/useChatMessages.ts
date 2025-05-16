import { useChat, type Message as VercelMessage } from '@ai-sdk/react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { generateId } from 'ai';
import { getSessionMessagesForChat } from '@/db/actions/sessions-actions';
import { User } from '@/payload-types';
import { CounterMessagesSchema } from '@/models/chatSchemas';

interface UseChatMessagesProps {
  sessionId: string;
  projectId: string;
  apiRoute: string;
  currentUser: User | null;
  authLoading: boolean;
  selectedModel: string;
  selectedTools: string[];
  activeContextId: string;
  activePageId: string | null;
}

export function useChatMessages({
  sessionId,
  projectId,
  apiRoute,
  currentUser,
  authLoading,
  selectedModel,
  selectedTools,
  activeContextId,
  activePageId,
}: UseChatMessagesProps) {
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  const reloadMessagesFromDb = useCallback(async (currentSetMessages: (messages: VercelMessage[]) => void) => {
    if (!sessionId) return;
    setIsLoadingMessages(true);
    try {
      const messagesFromDb = await getSessionMessagesForChat(sessionId);
      currentSetMessages(messagesFromDb ? messagesFromDb as VercelMessage[] : []);
    } catch (error) {
      console.error('[useChatMessages] Error reloading messages from DB:', error);
      toast.error("Failed to reload messages.");
    } finally {
      setIsLoadingMessages(false);
    }
  }, [sessionId]);

  const { 
    messages: rawMessages, 
    data, 
    input, 
    handleInputChange, 
    handleSubmit: originalUseChatSubmit, 
    stop, 
    status, 
    setMessages, 
    reload 
  } = useChat({
    api: apiRoute,
    initialMessages: [], 
    body: { 
      projectId: projectId,
      sessionId: sessionId,
    },
    onFinish: async (message: VercelMessage, /* options: { usage: any; finishReason: any; } */ ) => {
      console.log("[useChatMessages] onFinish triggered. Last assistant message ID:", message?.id);
      if (apiRoute === '/api/opera/counterfeit') {
        if (Array.isArray(data) && data.length > 0) { 
          const latestCounterfeitState = data[data.length - 1];
          const validationResult = CounterMessagesSchema.safeParse(latestCounterfeitState);
          if (validationResult.success) {
            setMessages(validationResult.data.finalMessages as VercelMessage[]);
            await reloadMessagesFromDb(setMessages);
          } else {
            console.error("[useChatMessages] Counterfeit onFinish: Failed to parse finalMessages:", validationResult.error.flatten());
            await reloadMessagesFromDb(setMessages);
          }
        } else {
          console.error("[useChatMessages] Counterfeit onFinish: 'data' array is empty. Reloading from DB.");
          await reloadMessagesFromDb(setMessages);
        }
      } else { 
        await reloadMessagesFromDb(setMessages);
      }
    },
    onError: (error: Error) => {
      console.error("[useChatMessages] onError callback triggered:", error);
      toast.error(`Chat error: ${error.message}`);
    }
  });

  useEffect(() => {
    if (sessionId) {
      reloadMessagesFromDb(setMessages);
    }
  }, [sessionId, setMessages, reloadMessagesFromDb]);

  const validatedData = useMemo(() => {
    if (apiRoute === '/api/opera/counterfeit' && Array.isArray(data) && data.length > 0) {
      const latestCounterfeitState = data[data.length - 1];
      const validationResult = CounterMessagesSchema.safeParse(latestCounterfeitState);
      if (validationResult.success) {
        return { type: 'success' as const, data: validationResult.data };
      } else {
        return { type: 'error' as const, message: "Failed to process counterfeit data." };
      }
    }
    return null;
  }, [data, apiRoute]);

  const messagesToRender = useMemo(() => {
    if (apiRoute === '/api/opera/counterfeit' && validatedData && validatedData.type === 'success') {
      return validatedData.data.finalMessages as VercelMessage[];
    }
    return rawMessages; 
  }, [apiRoute, validatedData, rawMessages]);

  const customHandleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (authLoading || !currentUser) {
      toast.error("Please wait, authenticating user...");
      return;
    }
    const newUserMessage = { id: generateId(), role: 'user' as const, content: input, createdAt: new Date() } as VercelMessage;
    const allMessages = [...messagesToRender, newUserMessage];
    originalUseChatSubmit(e, { 
      body: { 
        messages: allMessages, model: selectedModel, tools: selectedTools, projectId: projectId, sessionId: sessionId, 
        customInfo: `ID: ${currentUser.id} | Page: ${activeContextId}/${activePageId || 'unknown'} | API: ${apiRoute}`
      }
    });
  };

  return {
    messages: messagesToRender,
    input,
    handleInputChange,
    handleSubmit: customHandleSubmit,
    stop,
    status,
    isLoadingMessages,
    data, 
    reload, 
  };
} 