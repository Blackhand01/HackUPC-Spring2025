// src/hooks/matches/useTravelForm.ts
'use client';

import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MOOD_OPTIONS, ACTIVITY_OPTIONS } from '@/config/matches';
import { addDays } from 'date-fns';

// Define Zod schema for the new travel form validation
export const travelFormSchema = z.object({
  tripType: z.enum(['individual', 'group'], { required_error: "Please select a trip type."}),
  groupId: z.string().optional(), // Required if tripType is 'group'
  departureCity: z.string().min(2, "Departure city is required."),
  departureCityIata: z.string().min(3).max(3).optional().nullable().describe("IATA code needed for matching."), // Updated: Allow null

  // Date fields - Make them required for saving
  tripDateStart: z.date({ required_error: "Start date is required." }).describe("Start date of the trip."),
  tripDateEnd: z.date({ required_error: "End date is required." }).describe("End date of the trip."),

  // Mode 1: Guided Sliders
  mood: z.string().optional(),
  activity: z.string().optional(),
  activityOther: z.string().optional(),

  // Mode 2: AI
  aiPrompt: z.string().optional(), // Keep for potential initial trigger? Or remove? Let's keep for now.
  planningMode: z.enum(['guided', 'ai']).default('guided'),
}).refine(data => { // Refinement for groupId
    if (data.tripType === 'group') return !!data.groupId;
    return true;
}, { message: "Please select a group for a group trip.", path: ["groupId"]})
.refine(data => { // Refinement for activityOther
    if (data.activity === 'other') return !!data.activityOther && data.activityOther.trim().length > 0;
    return true;
}, { message: "Please specify the 'other' activity.", path: ["activityOther"]})
.refine(data => { // Refinement for date range (ensure end date is after start date)
    if (data.tripDateStart && data.tripDateEnd) {
        return data.tripDateEnd >= data.tripDateStart;
    }
    return true; // Allow validation if one or both are missing (handled by required)
}, { message: "End date must be on or after start date.", path: ["tripDateEnd"]})
.refine(data => { // Refinement for preferences (at least one preference needed)
    if (data.planningMode === 'guided') {
        return !!data.mood || !!data.activity; // In guided, either mood or activity must be set
    }
     // For AI mode, validation happens implicitly when checking extracted prefs before save
    return true;
}, { message: "Please select a mood or activity preference.", path: ["mood"] }); // Attach error to mood field


export type TravelFormValues = z.infer<typeof travelFormSchema>;

export function useTravelForm(): UseFormReturn<TravelFormValues> {
  const form = useForm<TravelFormValues>({
    resolver: zodResolver(travelFormSchema),
    defaultValues: {
      tripType: 'individual',
      groupId: undefined,
      departureCity: '',
      departureCityIata: null, // Initialize as null
      tripDateStart: new Date(), // Default to today
      tripDateEnd: addDays(new Date(), 7), // Default to 7 days from today
      mood: MOOD_OPTIONS[0].value,
      activity: ACTIVITY_OPTIONS[0].value,
      activityOther: '',
      aiPrompt: '', // Initialize AI prompt field
      planningMode: 'guided',
    },
    mode: 'onChange', // Validate on change for better feedback
  });

  return form;
}
