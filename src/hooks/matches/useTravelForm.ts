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
  departureCityIata: z.string().min(3).max(3).optional().describe("IATA code needed for matching."), // Hidden field, potentially derived

  // Date fields
  tripDateStart: z.date().optional().describe("Start date of the trip."),
  tripDateEnd: z.date().optional().describe("End date of the trip."),

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
.refine(data => { // Refinement for date range
    if (data.tripDateStart && data.tripDateEnd) {
        return data.tripDateEnd >= data.tripDateStart;
    }
    return true; // Allow if one or both are missing
}, { message: "End date must be after start date.", path: ["tripDateEnd"]});


export type TravelFormValues = z.infer<typeof travelFormSchema>;

export function useTravelForm(): UseFormReturn<TravelFormValues> {
  const form = useForm<TravelFormValues>({
    resolver: zodResolver(travelFormSchema),
    defaultValues: {
      tripType: 'individual',
      groupId: undefined,
      departureCity: '',
      departureCityIata: '', // Initialize hidden field
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
```