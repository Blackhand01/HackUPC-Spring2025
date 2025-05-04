// src/components/matches/GuidedMode.tsx
'use client';

import { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Smile, Mountain } from 'lucide-react'; // Import necessary icons
import { MOOD_OPTIONS, ACTIVITY_OPTIONS } from '@/config/matches'; // Import constants
import { type TravelFormValues } from '@/hooks/matches/useTravelForm'; // Import form type

interface GuidedModeProps {
  form: UseFormReturn<TravelFormValues>;
  isSubmitting: boolean;
  moodSliderValue: number;
  activitySliderValue: number;
  setMoodSliderValue: (value: number) => void;
  setActivitySliderValue: (value: number) => void;
}

export function GuidedMode({
  form,
  isSubmitting,
  moodSliderValue,
  activitySliderValue,
  setMoodSliderValue,
  setActivitySliderValue,
}: GuidedModeProps) {

  // --- Handlers for slider changes ---
  const handleMoodSliderChange = (value: number[]) => {
    const index = value[0];
    setMoodSliderValue(index);
    form.setValue('mood', MOOD_OPTIONS[index]?.value, { shouldValidate: true });
  };

  const handleActivitySliderChange = (value: number[]) => {
    const index = value[0];
    setActivitySliderValue(index);
    const selectedActivity = ACTIVITY_OPTIONS[index]?.value;
    form.setValue('activity', selectedActivity, { shouldValidate: true });
    // Clear 'other' field if activity is not 'other'
    if (selectedActivity !== 'other') {
      form.setValue('activityOther', '', { shouldValidate: true });
    }
  };


  return (
    <>
      {/* Mood Slider */}
      <FormField
        control={form.control}
        name="mood"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-1 text-base font-semibold">
              <Smile className="h-5 w-5" /> Mood
            </FormLabel>
            <FormControl>
              <Slider
                id="mood-slider"
                min={0}
                max={MOOD_OPTIONS.length - 1}
                step={1}
                value={[moodSliderValue]}
                onValueChange={handleMoodSliderChange}
                className={cn("w-[95%] mx-auto pt-2")}
                disabled={isSubmitting}
                aria-label="Select Mood"
              />
            </FormControl>
            <div className="flex justify-between text-xs text-muted-foreground px-2">
              {MOOD_OPTIONS.map((opt, index) => (
                <span key={opt.value} className={cn(index === moodSliderValue && "font-bold text-primary")}>
                  {opt.label}
                </span>
              ))}
            </div>
            <p className="text-center text-lg font-medium mt-2 flex items-center justify-center gap-1">
              {MOOD_OPTIONS[moodSliderValue]?.icon} {MOOD_OPTIONS[moodSliderValue]?.label}
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Activity Slider */}
      <FormField
        control={form.control}
        name="activity"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-1 text-base font-semibold">
              <Mountain className="h-5 w-5" /> Activity
            </FormLabel>
            <FormControl>
              <Slider
                id="activity-slider"
                min={0}
                max={ACTIVITY_OPTIONS.length - 1}
                step={1}
                value={[activitySliderValue]}
                onValueChange={handleActivitySliderChange}
                className={cn("w-[95%] mx-auto pt-2")}
                disabled={isSubmitting}
                aria-label="Select Activity"
              />
            </FormControl>
            <div className="flex justify-between text-xs text-muted-foreground px-2">
              {ACTIVITY_OPTIONS.map((opt, index) => (
                <span key={opt.value} className={cn(index === activitySliderValue && "font-bold text-primary")}>
                  {opt.label}
                </span>
              ))}
            </div>
            <p className="text-center text-lg font-medium mt-2 flex items-center justify-center gap-1">
              {ACTIVITY_OPTIONS[activitySliderValue]?.icon} {ACTIVITY_OPTIONS[activitySliderValue]?.label}
            </p>
            {/* Conditional Input for "Other" Activity */}
            {form.watch('activity') === 'other' && (
              <FormField
                control={form.control}
                name="activityOther"
                render={({ field: otherField }) => (
                  <FormItem className="px-4 space-y-1 pt-2">
                    <FormLabel>Describe "Other" Activity</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Volunteering, Language course"
                        {...otherField}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormMessage /> {/* For the main activity field */}
          </FormItem>
        )}
      />
    </>
  );
}
