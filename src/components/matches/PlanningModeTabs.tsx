// src/components/matches/PlanningModeTabs.tsx
'use client';

import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SlidersHorizontal, Wand2 } from 'lucide-react';
import { GuidedMode } from './GuidedMode';
import { AiChatMode } from './AiChatMode';
import { type TravelFormValues } from '@/hooks/matches/useTravelForm';

interface PlanningModeTabsProps {
  form: UseFormReturn<TravelFormValues>;
  isSubmitting: boolean;
   onPreferencesExtracted: (prefs: string[]) => void; // Callback to pass extracted prefs up
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
                     setMoodSliderValue={setMoodSliderValue} // Pass slider setters
                     setActivitySliderValue={setActivitySliderValue}
                     onPreferencesExtracted={onPreferencesExtracted} // Pass callback
                 />
              </TabsContent>
            </Tabs>
          </FormControl>
        </FormItem>
      )}
    />
  );
}

// Need to import or define MOOD_OPTIONS and ACTIVITY_OPTIONS if not globally available
// For simplicity assuming they are available in this scope or imported
import { MOOD_OPTIONS, ACTIVITY_OPTIONS } from '@/config/matches';
