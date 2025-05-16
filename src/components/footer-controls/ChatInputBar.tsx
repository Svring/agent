import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/ui/multi-select';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Square, Hammer, Loader2, LucideIcon } from 'lucide-react';
import { Dispatch, SetStateAction } from 'react';

interface ChatInputBarProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  status: string; // 'ready', 'generating', etc.
  stop: () => void;
  selectedModel: string;
  handleModelChange: (value: string) => void;
  availableModels: { key: string; label: string }[];
  selectedTools: string[];
  setSelectedTools: Dispatch<SetStateAction<string[]>>;
  availableTools: { key: string; label: string }[];
  isLoadingSettings: boolean;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  input,
  handleInputChange,
  handleSubmit,
  status,
  stop,
  selectedModel,
  handleModelChange,
  availableModels,
  selectedTools,
  setSelectedTools,
  availableTools,
  isLoadingSettings,
}) => {
  return (
    <form onSubmit={handleSubmit} className="flex flex-col w-full bg-background rounded-lg p-2">
      <Textarea
        className="flex-1 resize-none border-0 px-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-lg mb-2"
        placeholder="What's on your mind?"
        value={input}
        onChange={handleInputChange}
        rows={3}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>); // Cast to prevent type error
          }
        }}
      />
      <div className="flex items-center justify-between">
        <div className="flex space-x-2 items-center">
          <Select value={selectedModel} onValueChange={handleModelChange} disabled={isLoadingSettings}>
            <SelectTrigger size='sm' className="w-auto h-8 text-xs px-2 focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder={isLoadingSettings ? "Loading..." : "Select model"} />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map(model => (
                <SelectItem className="text-xs" key={model.key} value={model.key}>{model.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MultiSelect
            label={isLoadingSettings ? "Loading..." : "Tools"}
            icon={Hammer as LucideIcon}
            options={availableTools.map(tool => ({ label: tool.label, value: tool.key }))}
            selectedOptions={selectedTools}
            setSelectedOptions={setSelectedTools}
          />
        </div>
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              {status !== 'ready' && status !== 'idle' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={stop}
                  aria-label="Stop generating"
                  type="button" // Important: prevent form submission
                >
                  <Square />
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={!input.trim() || (status !== 'ready' && status !== 'idle')}
                  aria-label="Send message"
                >
                  <Send />
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent>
              {status !== 'ready' && status !== 'idle' ? 'Stop Generating' : 'Send Message'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </form>
  );
}; 