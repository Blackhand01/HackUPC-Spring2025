// src/components/matches/GuidedMode.tsx
'use client';

import * as React from 'react'; // Import React
import { UseFormReturn, Controller } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Smile, Mountain, Film, Users, Leaf, PlaneTakeoff, Utensils, Info, Heart, CalendarDays } from 'lucide-react'; // Import necessary icons
import { MOOD_OPTIONS, ACTIVITY_OPTIONS } from '@/config/matches'; // Import constants
import { type TravelFormValues } from '@/hooks/matches/useTravelForm'; // Import form type
import { DateRangePicker } from './DateRangePicker'; // Import DateRangePicker
import type { DateRange } from 'react-day-picker'; // Import DateRange type

interface GuidedModeProps {
  form: UseFormReturn<TravelFormValues>;
  isSubmitting: boolean;
  moodSliderValue: number;
  activitySliderValue: number;
  setMoodSliderValue: (value: number) => void;
  setActivitySliderValue: (value: number) => void;
}

// Helper function to get the correct icon based on the value
const getIconForValue = (type: 'mood' | 'activity', value: string | undefined): React.ReactNode => {
  if (!value) return null;

  if (type === 'mood') {
    switch (value) {
      case 'relaxed': return <Smile className="h-4 w-4" />;
      case 'adventurous': return <Mountain className="h-4 w-4" />;
      case 'cultural': return <Film className="h-4 w-4" />;
      case 'social': return <Users className="h-4 w-4" />;
      case 'nature': return <Leaf className="h-4 w-4" />;
      default: return <Heart className="h-4 w-4" />;
    }
  } else if (type === 'activity') {
    if (value.startsWith('other:')) return <Info className="h-4 w-4" />;
    switch (value) {
      case 'hiking': return <Mountain className="h-4 w-4" />;
      case 'museums': return <Film className="h-4 w-4" />;
      case 'beach': return <PlaneTakeoff className="h-4 w-4" />; // Using PlaneTakeoff as placeholder
      case 'nightlife': return <Users className="h-4 w-4" />;
      case 'foodie': return <Utensils className="h-4 w-4" />;
      case 'other': return <Info className="h-4 w-4" />;
      default: return <Heart className="h-4 w-4" />;
    }
  }
  return null;
};


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

  const selectedMoodValue = MOOD_OPTIONS[moodSliderValue]?.value;
  const selectedActivityValue = ACTIVITY_OPTIONS[activitySliderValue]?.value;


  return (
    <div className='space-y-6'>
       {/* Date Range Picker */}
       <FormField
        control={form.control}
        name="tripDateStart" // Use either start or end date field name for the picker control
        render={({ field }) => ( // `field` here is primarily for error reporting, value is handled by Controller
          <FormItem>
            <FormLabel className="flex items-center gap-1 text-base font-semibold">
                <CalendarDays className="h-5 w-5" /> Trip Dates <span className='text-destructive'>*</span>
            </FormLabel>
            <FormControl>
              <Controller
                control={form.control}
                name="tripDateStart" // We need Controller for complex inputs like date range
                render={({ field: { onChange, value: startDate } }) => (
                    <DateRangePicker
                        dateRange={{ from: startDate, to: form.watch('tripDateEnd') }}
                        onDateChange={(range) => {
                            form.setValue('tripDateStart', range?.from, { shouldValidate: true });
                            form.setValue('tripDateEnd', range?.to, { shouldValidate: true });
                        }}
                        disabled={isSubmitting}
                        className="mt-1"
                    />
                 )}
              />
            </FormControl>
             {/* Display validation errors for both start and end dates if they exist */}
             <FormMessage>{form.formState.errors.tripDateStart?.message}</FormMessage>
             <FormMessage>{form.formState.errors.tripDateEnd?.message}</FormMessage>
             <p className="text-xs text-muted-foreground pt-1">Select the start and end dates for your trip.</p>
          </FormItem>
        )}
      />


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
              {getIconForValue('mood', selectedMoodValue)} {MOOD_OPTIONS[moodSliderValue]?.label}
            </p>
            <FormMessage />
            <p className="text-xs text-muted-foreground pt-1 text-center">Slide to choose the overall vibe for your trip.</p>
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
              {getIconForValue('activity', selectedActivityValue)} {ACTIVITY_OPTIONS[activitySliderValue]?.label}
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
             <p className="text-xs text-muted-foreground pt-1 text-center">Slide to pick the main type of activity you're interested in.</p>
          </FormItem>
        )}
      />
    </div>
  );
}
