// src/ai/flows/plan-travel-assistant-flow.ts
'use server';
/**
 * @fileOverview An AI assistant that helps users plan their travel by engaging in a conversation.
 * It extracts key travel preferences like mood, activity, and dates from the chat.
 * Limits follow-up questions to a maximum of 3 after the initial prompt.
 *
 * - planTravelAssistant - A function that handles the AI chat interaction.
 * - PlanTravelAssistantInput - The input type for the planTravelAssistant function.
 * - PlanTravelAssistantOutput - The return type for the planTravelAssistant function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import { format } from 'date-fns';

// Define the schema for a single chat message in the history
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'ai']).describe('The role of the sender (user or AI).'),
  text: z.string().describe('The content of the chat message.'),
});

// Define the schema for the extracted travel data
const ExtractedTravelDataSchema = z.object({
    mood: z.string().optional().describe('The desired mood for the trip (e.g., relaxed, adventurous, cultural). Must be one of the allowed values if specified.'),
    activity: z.string().optional().describe('The main activity planned (e.g., hiking, museums, beach). Must be one of the allowed values or "other" if specified.'),
    activityOther: z.string().optional().describe('Specific description if the activity is "other".'),
    departureCity: z.string().optional().describe('The departure city for the trip.'), // Added departureCity
    tripDateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {message: "Date must be in YYYY-MM-DD format"}).optional().describe('The preferred start date (YYYY-MM-DD).'), // Added startDate
    tripDateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {message: "Date must be in YYYY-MM-DD format"}).optional().describe('The preferred end date (YYYY-MM-DD).'), // Added endDate
}).optional();


// Define the input schema for the flow
const PlanTravelAssistantInputSchema = z.object({
  currentChat: z.array(ChatMessageSchema).describe('The ongoing chat history between the user and the AI assistant.'),
  userPrompt: z.string().describe('The latest message/prompt from the user.'),
  followUpCount: z.number().min(0).default(0).describe('Internal counter for follow-up questions.'), // Added follow-up counter
});
export type PlanTravelAssistantInput = z.infer<typeof PlanTravelAssistantInputSchema>;

// Define the output schema for the flow
const PlanTravelAssistantOutputSchema = z.object({
  response: z.string().describe('The AI assistant response to the user prompt based on the chat history.'),
  extractedData: ExtractedTravelDataSchema.describe('Structured data extracted from the conversation, if available.'),
  nextFollowUpCount: z.number().describe('The updated follow-up count.'), // Added next follow-up count
});
export type PlanTravelAssistantOutput = z.infer<typeof PlanTravelAssistantOutputSchema>;

// Exported wrapper function to call the flow
export async function planTravelAssistant(input: PlanTravelAssistantInput): Promise<PlanTravelAssistantOutput> {
  return planTravelAssistantFlow(input);
}

// Define the Genkit prompt
const planTravelPrompt = ai.definePrompt({
  name: 'planTravelPrompt',
  input: {
    schema: PlanTravelAssistantInputSchema,
  },
  output: {
    // IMPORTANT: The output schema here defines what the *LLM should return*.
    // It includes the response, the extracted data structure, and the next follow-up count.
    schema: PlanTravelAssistantOutputSchema,
  },
  // Use Handlebars templating for the prompt string
  // Ensure the prompt explicitly lists the allowed values for mood and activity.
  // Incorporate follow-up limit and date extraction.
  prompt: `You are a friendly and slightly dreamy AI travel assistant for OnlyFly. Your goal is to help users plan their trips by having a natural conversation. Engage the user with evocative questions to understand their desired mood, activities, departure city, and travel dates (start and end), but keep the conversation flowing naturally.

Current Date: ${format(new Date(), 'yyyy-MM-dd')}

Allowed Moods: relaxed, adventurous, cultural, social, nature
Allowed Activities: hiking, museums, beach, nightlife, foodie, other

Here are some examples of evocative questions you can adapt:
- Mood: "If your heart could take flight, where would it soar? Towards relaxation, adventure, or cultural discovery?" (Ensure response matches allowed moods)
- Activity: "Picture your perfect day on this trip. What fills the frame?" (Ensure response matches allowed activities or 'other')
- If Activity is 'other': "Could you capture that in a single word or short phrase?" (This will populate activityOther)
- Departure City: "From which city will your journey begin its tale?"
- Dates: "And between which sunrises will this story unfold? (e.g., 'from 2025-07-10 to 2025-07-17')"

Based on the entire conversation history below, respond to the latest user message. Try to extract the user's preferences (mood, activity, activityOther if applicable, departureCity, tripDateStart, tripDateEnd) as you chat.

IMPORTANT: You have a maximum of 3 follow-up questions AFTER the initial interaction to gather all necessary information (Departure City, Start Date, End Date, Mood, Activity). The current follow-up count is {{followUpCount}}. If the count is 3 or more, DO NOT ask any more questions; simply summarize the plan or confirm. If essential information is still missing after 3 follow-ups, state what is missing and provide the summary anyway.

Conversation History:
{{#each currentChat}}
{{role}}: {{{text}}}
{{/each}}
user: {{{userPrompt}}}

Your task:
1. Analyze the conversation (including the latest userPrompt) and extract the key travel preferences: departureCity, tripDateStart (YYYY-MM-DD), tripDateEnd (YYYY-MM-DD), mood, activity (and activityOther if applicable).
   - The extracted 'mood' MUST be one of: relaxed, adventurous, cultural, social, nature.
   - The extracted 'activity' MUST be one of: hiking, museums, beach, nightlife, foodie, other.
   - If activity is 'other', also extract 'activityOther'.
   - Dates MUST be in YYYY-MM-DD format. If the user provides relative dates (e.g., "next week"), try to infer the absolute dates based on the current date. If unsure, leave the date fields empty.
   - If a preference isn't clearly stated or doesn't match the allowed values/format, leave the corresponding field empty in extractedData.
2. Based on the extracted data and the followUpCount (current count: {{followUpCount}}), decide if you need to ask a follow-up question (max 3 allowed).
3. Generate a natural, friendly, and slightly evocative response to the user's latest message. If asking a follow-up, increment the followUpCount. If summarizing, keep the followUpCount the same.
4. Return BOTH the response text, the extractedData object, and the nextFollowUpCount according to the output schema.`,
});


// Define the Genkit flow
const planTravelAssistantFlow = ai.defineFlow<
  typeof PlanTravelAssistantInputSchema,
  typeof PlanTravelAssistantOutputSchema
>(
  {
    name: 'planTravelAssistantFlow',
    inputSchema: PlanTravelAssistantInputSchema,
    outputSchema: PlanTravelAssistantOutputSchema,
  },
  async (input) => {
    try { // Add try-catch around the prompt call
      // Call the prompt with the input data
      const {output} = await planTravelPrompt(input);

       // Explicitly check if output is null or undefined
      if (!output) {
          console.error('AI prompt returned null or undefined output.');
          throw new Error('AI failed to generate a valid response structure.');
      }

      // Add validation/defaulting for critical fields if needed
      // Ensure response text is present (caller will handle empty string)
      // Ensure nextFollowUpCount is a number (Zod should handle this, but provide default just in case)
      output.nextFollowUpCount = output.nextFollowUpCount ?? input.followUpCount;

      // Log the extracted data for debugging
      console.log("AI Flow Extracted Data:", output.extractedData);
      console.log("Next Follow Up Count:", output.nextFollowUpCount);
      return output;

    } catch (error) {
        console.error("Error within planTravelAssistantFlow during prompt call:", error);
        // Re-throw the error to be handled by the calling function (useAiChat hook)
        throw error instanceof Error ? error : new Error('An unknown error occurred during AI processing.');
    }
  }
);
