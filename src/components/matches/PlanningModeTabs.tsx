// src/components/matches/PlanningModeTabs.tsx
'use client';

import { useState, useEffect } from 'react'; // Added useEffect
import { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SlidersHorizontal, Wand2 } from 'lucide-react';
import { GuidedMode } from './GuidedMode';
import { AiChatMode } from './AiChatMode';
import { type TravelFormValues } from '@/hooks/matches/useTravelForm';
import { MOOD_OPTIONS, ACTIVITY_OPTIONS } from '@/config/matches'; // Import constants

interface PlanningModeTabsProps {
  form: UseFormReturn<TravelFormValues>;
  isSubmitting: boolean;
   onPreferencesExtracted: (prefs: string[]) => void; // Callback specifically for AI extracted prefs
}

export function PlanningModeTabs({ form, isSubmitting, onPreferencesExtracted }: PlanningModeTabsProps) {
   // Local state for slider values, passed down to GuidedMode
   const [moodSliderValue, setMoodSliderValue] = useState(() => {
       const initialMood = form.getValues('mood');
       const index = MOOD_OPTIONS.findIndex(opt => opt.value === initialMood);
       return index >= 0 ? index : 0;
   });
   const [activitySliderValue, setActivitySliderValue] = useState(() => {
        const initialActivity = form.getValues('activity');
        const index = ACTIVITY_OPTIONS.findIndex(opt => opt.value === initialActivity);
        return index >= 0 ? index : 0;
   });

   // Reset slider values if form values change externally (e.g., by AI)
   useEffect(() => {
        const subscription = form.watch((value, { name }) => {
            if (name === 'mood') {
                const index = MOOD_OPTIONS.findIndex(opt => opt.value === value.mood);
                setMoodSliderValue(index >= 0 ? index : 0);
            }
            if (name === 'activity') {
                 const index = ACTIVITY_OPTIONS.findIndex(opt => opt.value === value.activity);
                 setActivitySliderValue(index >= 0 ? index : 0);
            }
        });
        return () => subscription.unsubscribe();
   }, [form]);


  return (
    <FormField
      control={form.control}
      name="planningMode"
      render={({ field }) => (
        <FormItem className="mt-2 border-t pt-6">
          <FormLabel className="text-base font-semibold mb-3 block">
            Trip Preferences <span className='text-destructive'>*</span>
          </FormLabel>
          <FormControl>
            <Tabs value={field.value} onValueChange={field.onChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="guided">
                  <SlidersHorizontal className="mr-2 h-4 w-4" /> Guided
                </TabsTrigger>
                <TabsTrigger value="ai">
                  <Wand2 className="mr-2 h-4 w-4" /> AI Assistant
                </TabsTrigger>
              </TabsList>

              <TabsContent value="guided" className="mt-6 space-y-6">
                 <GuidedMode
                   form={form}
                   isSubmitting={isSubmitting}
                   moodSliderValue={moodSliderValue}
                   activitySliderValue={activitySliderValue}
                   setMoodSliderValue={setMoodSliderValue}
                   setActivitySliderValue={setActivitySliderValue}
                 />
              </TabsContent>

              <TabsContent value="ai">
                 <AiChatMode
                     form={form}
                     isSubmitting={isSubmitting}
                     setMoodSliderValue={setMoodSliderValue} // Pass slider setters to potentially update guided view
                     setActivitySliderValue={setActivitySliderValue}
                     onPreferencesExtracted={onPreferencesExtracted} // Pass callback only here
                 />
              </TabsContent>
            </Tabs>
          </FormControl>
        </FormItem>
      )}
    />
  );
}
