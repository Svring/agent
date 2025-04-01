'use server'

import { generateId, Message } from 'ai';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { writeFile, readFile } from 'fs/promises';
import path from 'path';

interface ChatSession {
  id: string;
  name: string;
  createdAt: string;
}

export async function listChats(): Promise<ChatSession[]> {
  const chatDir = path.join(process.cwd(), '.chats');
  if (!existsSync(chatDir)) {
    return [];
  }

  try {
    const files = readdirSync(chatDir);
    const chatSessions: ChatSession[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const id = file.replace('.json', '');
        try {
          const messages = await loadChat(id);
          chatSessions.push({
            id,
            name: id,
            createdAt: messages[0]?.createdAt?.toString() || new Date().toISOString()
          });
        } catch (error) {
          console.error(`Error loading chat ${id}:`, error);
          // If we can't load the chat, still include it with current timestamp
          chatSessions.push({
            id,
            name: id,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    return chatSessions;
  } catch (error) {
    console.error('Error listing chat sessions:', error);
    return [];
  }
}

export async function createChat(): Promise<string> {
  const id = generateId(); // generate a unique chat ID
  await writeFile(getChatFile(id), '[]'); // create an empty chat file
  return id;
}

function getChatFile(id: string): string {
  const chatDir = path.join(process.cwd(), '.chats');
  if (!existsSync(chatDir)) mkdirSync(chatDir, { recursive: true });
  return path.join(chatDir, `${id}.json`);
}

export async function loadChat(id: string): Promise<Message[]> {
  const fileContent = await readFile(getChatFile(id), 'utf8');
  return JSON.parse(fileContent);
}

export async function saveChat({
  id,
  messages,
}: {
  id: string;
  messages: Message[];
}): Promise<void> {
  const content = JSON.stringify(messages, null, 2);
  await writeFile(getChatFile(id), content);
}

export async function deleteChat(id: string): Promise<boolean> {
  try {
    const filePath = getChatFile(id);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error deleting chat ${id}:`, error);
    return false;
  }
}