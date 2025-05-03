// src/ai/flows/generate-travel-matches.ts
'use server';

/**
 * @fileOverview An AI agent that suggests potential house swaps based on user preferences, accommodation details, and travel dates, incorporating a 'green score' to promote sustainable travel options.
 *
 * - generateTravelMatches - A function that handles the generation of travel matches.
 * - GenerateTravelMatchesInput - The input type for the generateTravelMatches function.
 * - GenerateTravelMatchesOutput - The return type for the generateTravelMatches function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateTravelMatchesInputSchema = z.object({
  userPreferences: z
    .string()
    .describe('The preferences of the user, including preferred destinations, activities, and travel dates.'),
  accommodationDetails: z
    .string()
    .describe('Details about the user accommodation, including size, amenities, and location.'),
  travelDates: z.string().describe('The desired travel dates for the house swap.'),
  greenScorePreferences: z
    .string()
    .optional()
    .describe('The user preference for a green score. For example, the user wants accommodations with a high green score to promote sustainable travel options'),
});

export type GenerateTravelMatchesInput = z.infer<typeof GenerateTravelMatchesInputSchema>;

const GenerateTravelMatchesOutputSchema = z.object({
  matches: z
    .array(z.string())
    .describe(
      'A list of potential house swap matches based on the user preferences, accommodation details, and travel dates, incorporating a green score.'
    ),
});

export type GenerateTravelMatchesOutput = z.infer<typeof GenerateTravelMatchesOutputSchema>;

export async function generateTravelMatches(input: GenerateTravelMatchesInput): Promise<GenerateTravelMatchesOutput> {
  return generateTravelMatchesFlow(input);
}

const generateTravelMatchesPrompt = ai.definePrompt({
  name: 'generateTravelMatchesPrompt',
  input: {
    schema: z.object({
      userPreferences: z
        .string()
        .describe('The preferences of the user, including preferred destinations, activities, and travel dates.'),
      accommodationDetails: z
        .string()
        .describe('Details about the user accommodation, including size, amenities, and location.'),
      travelDates: z.string().describe('The desired travel dates for the house swap.'),
      greenScorePreferences: z
        .string()
        .optional()
        .describe('The user preference for a green score. For example, the user wants accommodations with a high green score to promote sustainable travel options'),
    }),
  },
  output: {
    schema: z.object({
      matches: z
        .array(z.string())
        .describe(
          'A list of potential house swap matches based on the user preferences, accommodation details, and travel dates, incorporating a green score.'
        ),
    }),
  },
  prompt: `You are an AI travel agent that suggests house swap matches based on user preferences, accommodation details, and travel dates.

Consider the following information to find the best matches:

User Preferences: {{{userPreferences}}}
Accommodation Details: {{{accommodationDetails}}}
Travel Dates: {{{travelDates}}}
Green Score Preferences: {{{greenScorePreferences}}}

Return a list of potential house swap matches that meet the user's criteria.`,
});

const generateTravelMatchesFlow = ai.defineFlow<
  typeof GenerateTravelMatchesInputSchema,
  typeof GenerateTravelMatchesOutputSchema
>(
  {
    name: 'generateTravelMatchesFlow',
    inputSchema: GenerateTravelMatchesInputSchema,
    outputSchema: GenerateTravelMatchesOutputSchema,
  },
  async input => {
    const {output} = await generateTravelMatchesPrompt(input);
    return output!;
  }
);
