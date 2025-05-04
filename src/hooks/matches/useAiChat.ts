// src/hooks/matches/useAiChat.ts
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { planTravelAssistant, type PlanTravelAssistantInput, type PlanTravelAssistantOutput } from '@/ai/flows/plan-travel-assistant-flow';
import { type ChatMessage } from '@/types';
import { type UseFormReturn } from 'react-hook-form';
import { type TravelFormValues } from './useTravelForm';
import { MOOD_OPTIONS, ACTIVITY_OPTIONS } from '@/config/matches';

interface UseAiChatProps {
  form: UseFormReturn<TravelFormValues>; // Pass the form instance
  setMoodSliderValue: (value: number) => void; // Callback to update slider state
  setActivitySliderValue: (value: number) => void; // Callback to update slider state
}

export function useAiChat({ form, setMoodSliderValue, setActivitySliderValue }: UseAiChatProps) {
  const { toast } = useToast();
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentUserInput, setCurrentUserInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);

  const handleAiInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentUserInput(event.target.value);
    form.setValue('aiPrompt', event.target.value); // Update hidden aiPrompt field if needed for validation
  };

   // Function to update form and slider state based on AI output
   const updateFormFromAi = useCallback((data: PlanTravelAssistantOutput['extractedData']) => {
       if (!data) return;

       console.log("AI Extracted Data for Form Update:", data);
       const { mood, activity, activityOther } = data;

       if (mood) {
           const moodOption = MOOD_OPTIONS.find(opt => opt.value === mood);
           if (moodOption) {
               form.setValue('mood', moodOption.value, { shouldValidate: true });
               const index = MOOD_OPTIONS.findIndex(opt => opt.value === moodOption.value);
               setMoodSliderValue(index >= 0 ? index : 0);
           } else {
                console.warn(`AI suggested unknown mood: ${mood}`);
           }
       }

        if (activity) {
            const activityOption = ACTIVITY_OPTIONS.find(opt => opt.value === activity);
             if (activityOption && activityOption.value !== 'other') {
                form.setValue('activity', activityOption.value, { shouldValidate: true });
                const index = ACTIVITY_OPTIONS.findIndex(opt => opt.value === activityOption.value);
                setActivitySliderValue(index >= 0 ? index : 0);
                form.setValue('activityOther', '', { shouldValidate: true });
             } else if (activity === 'other' && activityOther) {
                form.setValue('activity', 'other', { shouldValidate: true });
                form.setValue('activityOther', activityOther, { shouldValidate: true });
                 const otherIndex = ACTIVITY_OPTIONS.findIndex(opt => opt.value === 'other');
                 setActivitySliderValue(otherIndex >= 0 ? otherIndex : 0);
             } else if (activity === 'other' && !activityOther) {
                  console.warn(`AI suggested 'other' activity but didn't provide details.`);
                  // Keep 'other' selected, prompt user? or clear? Let's keep it selected.
                   form.setValue('activity', 'other', { shouldValidate: true });
                    const otherIndex = ACTIVITY_OPTIONS.findIndex(opt => opt.value === 'other');
                   setActivitySliderValue(otherIndex >= 0 ? otherIndex : 0);
             } else {
                 console.warn(`AI suggested unknown activity: ${activity}`);
             }
        }

         // Only show toast if data was actually extracted and potentially updated
        if (mood || activity) {
            toast({ title: "AI Update", description: "Preferences updated based on chat. Review and save." });
            form.trigger(); // Re-validate after AI updates
        }

   }, [form, setMoodSliderValue, setActivitySliderValue, toast]);


  const handleAiSubmit = useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!currentUserInput.trim() || isAiLoading) return;

    const userMessage: ChatMessage = {
      sender: 'user',
      message: currentUserInput.trim(),
      timestamp: Date.now(),
    };
    setChatHistory(prev => [...prev, userMessage]);
    const currentInput = currentUserInput.trim(); // Capture before clearing
    setCurrentUserInput('');
    setIsAiLoading(true);

    try {
      const aiInput: PlanTravelAssistantInput = {
        currentChat: [...chatHistory, {role: 'user', text: currentInput}].map(m => ({ role: m.sender === 'user' ? 'user' : 'ai', text: m.message })), // Include latest message in history for context
        userPrompt: currentInput, // Pass the latest message explicitly
      };
      console.log("Sending to AI:", aiInput); // Log input to AI

      const aiOutput: PlanTravelAssistantOutput = await planTravelAssistant(aiInput);
      console.log("Received from AI:", aiOutput); // Log output from AI

      const aiMessage: ChatMessage = {
        sender: 'ai',
        message: aiOutput.response,
        timestamp: Date.now(),
      };
      setChatHistory(prev => [...prev, aiMessage]);

      // --- Update Form Values based on AI Output ---
      updateFormFromAi(aiOutput.extractedData);

    } catch (error) {
      console.error('Error calling AI assistant:', error);
      const errorMessage = error instanceof Error ? error.message : 'Could not get response from AI assistant.';
      toast({
        variant: 'destructive',
        title: 'AI Error',
        description: errorMessage + " Please try again.",
      });
      const errorChatMessage: ChatMessage = {
        sender: 'ai',
        message: "Sorry, I encountered an error trying to process that. Please try again.",
        timestamp: Date.now(),
      };
      setChatHistory(prev => [...prev, errorChatMessage]);
    } finally {
      setIsAiLoading(false);
    }
  }, [currentUserInput, isAiLoading, chatHistory, updateFormFromAi, toast]);

  // --- Scroll Chat Area ---
  useEffect(() => {
    if (chatScrollAreaRef.current) {
      const scrollViewport = chatScrollAreaRef.current.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [chatHistory]);

  // Function to get current preferences from AI state
  const getAiPreferences = useCallback((): string[] => {
    const preferences: string[] = [];
     const currentMood = form.getValues('mood');
     const currentActivity = form.getValues('activity');
     const currentActivityOther = form.getValues('activityOther');

    if (currentMood) {
      preferences.push(`mood:${currentMood}`);
    }
    if (currentActivity === 'other' && currentActivityOther) {
      preferences.push(`activity:other:${currentActivityOther.trim()}`);
    } else if (currentActivity && currentActivity !== 'other') {
      preferences.push(`activity:${currentActivity}`);
    }
     console.log("Preferences extracted from AI mode form state:", preferences);
    return preferences;
  }, [form]);


  return {
    chatHistory,
    currentUserInput,
    isAiLoading,
    chatScrollAreaRef,
    handleAiInputChange,
    handleAiSubmit,
    getAiPreferences,
    setChatHistory, // Expose if needed for resetting
  };
}
