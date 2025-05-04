// src/components/matches/AiChatMode.tsx
'use client';

import { useEffect, useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiChat } from '@/hooks/matches/useAiChat';
import { type TravelFormValues } from '@/hooks/matches/useTravelForm';

interface AiChatModeProps {
  form: UseFormReturn<TravelFormValues>;
  isSubmitting: boolean;
  setMoodSliderValue: (value: number) => void; // Needed by useAiChat hook
  setActivitySliderValue: (value: number) => void; // Needed by useAiChat hook
  onPreferencesExtracted: (prefs: string[]) => void; // Callback to pass extracted preferences
}

export function AiChatMode({ form, isSubmitting, setMoodSliderValue, setActivitySliderValue, onPreferencesExtracted }: AiChatModeProps) {
  const {
    chatHistory,
    currentUserInput,
    isAiLoading,
    chatScrollAreaRef,
    handleAiInputChange,
    handleAiSubmit,
    getAiPreferences,
    setChatHistory, // Expose if needed
  } = useAiChat({ form, setMoodSliderValue, setActivitySliderValue });

    // Effect to pass preferences up whenever chat history changes
    useEffect(() => {
        const prefs = getAiPreferences();
        onPreferencesExtracted(prefs);
    }, [chatHistory, getAiPreferences, onPreferencesExtracted]);


  return (
    <div className="flex flex-col h-[50vh]">
      <Label className="text-base font-semibold mb-2 flex items-center gap-1">
        <Bot className="h-5 w-5" /> AI Travel Assistant
      </Label>
      <ScrollArea className="flex-grow border rounded-md p-4 mb-4 bg-muted/50" ref={chatScrollAreaRef}>
        {chatHistory.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Start chatting with the AI to plan your trip!</p>
        )}
        {chatHistory.map((chat) => (
          <div key={chat.timestamp} className={cn("mb-3 flex", chat.sender === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              "rounded-lg p-2 px-3 max-w-[80%] text-sm break-words",
              chat.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground border'
            )}>
              {chat.message}
            </div>
          </div>
        ))}
        {isAiLoading && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-lg p-2 px-3 max-w-[80%] text-sm bg-background text-foreground border italic flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
            </div>
          </div>
        )}
      </ScrollArea>
      <div className="flex items-center gap-2">
        <Textarea
          placeholder="Ask the AI about your trip preferences (e.g., 'I want a relaxing beach vacation from Rome')"
          value={currentUserInput}
          onChange={handleAiInputChange}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSubmit(); } }}
          className="flex-grow resize-none"
          rows={1}
          disabled={isSubmitting || isAiLoading}
        />
        <Button type="button" onClick={() => handleAiSubmit()} disabled={isSubmitting || isAiLoading || !currentUserInput.trim()} size="icon">
          <Send className="h-4 w-4" />
          <span className="sr-only">Send message</span>
        </Button>
      </div>
    </div>
  );
}
