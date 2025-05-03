// src/ai/flows/plan-travel-assistant-flow.ts
'use server';
/**
 * @fileOverview An AI assistant that helps users plan their travel by engaging in a conversation.
 * It extracts key travel preferences like mood, activity, and duration from the chat.
 *
 * - planTravelAssistant - A function that handles the AI chat interaction.
 * - PlanTravelAssistantInput - The input type for the planTravelAssistant function.
 * - PlanTravelAssistantOutput - The return type for the planTravelAssistant function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

// Define the schema for a single chat message in the history
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'ai']).describe('The role of the sender (user or AI).'),
  text: z.string().describe('The content of the chat message.'),
});

// Define the schema for the extracted travel data
const ExtractedTravelDataSchema = z.object({
    mood: z.string().optional().describe('The desired mood for the trip (e.g., relaxed, adventurous, cultural).'),
    activity: z.string().optional().describe('The main activity planned (e.g., hiking, museums, beach).'),
    activityOther: z.string().optional().describe('Specific description if the activity is "other".'),
    durationDays: z.number().optional().describe('The approximate duration of the trip in days.'),
    startDate: z.string().optional().describe('The start date of the trip (YYYY-MM-DD format).'),
    endDate: z.string().optional().describe('The end date of the trip (YYYY-MM-DD format).'),
}).optional();


// Define the input schema for the flow
const PlanTravelAssistantInputSchema = z.object({
  currentChat: z.array(ChatMessageSchema).describe('The ongoing chat history between the user and the AI assistant.'),
  userPrompt: z.string().describe('The latest message/prompt from the user.'),
});
export type PlanTravelAssistantInput = z.infer<typeof PlanTravelAssistantInputSchema>;

// Define the output schema for the flow
const PlanTravelAssistantOutputSchema = z.object({
  response: z.string().describe('The AI assistant response to the user prompt based on the chat history.'),
  extractedData: ExtractedTravelDataSchema.describe('Structured data extracted from the conversation, if available.'),
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
    schema: PlanTravelAssistantOutputSchema,
  },
  // Use Handlebars templating for the prompt string
  prompt: `You are a friendly and slightly dreamy AI travel assistant for OnlyFly. Your goal is to help users plan their trips by having a natural conversation. Engage the user with evocative questions to understand their desired mood, activities, and duration, but keep the conversation flowing naturally.

Here are some examples of evocative questions you can adapt:
- Mood: "If your heart could take flight, where would it soar? Towards relaxation, adventure, or cultural discovery?"
- Activity: "Picture your perfect day on this trip. What fills the frame?" (If they say 'other', ask: "Could you capture that in a single word?")
- Duration: "For how many sunsets would you like to lose yourself?" or "Do you have specific dates whispering to you (DD/MM - DD/MM)?"

Based on the entire conversation history below, respond to the latest user message. Try to extract the user's preferences (mood, activity, duration/dates) as you chat.

Conversation History:
{{#each currentChat}}
{{role}}: {{{text}}}
{{/each}}
user: {{{userPrompt}}}

Your task:
1.  Generate a natural, friendly, and slightly evocative response to the user's latest message (userPrompt).
2.  Analyze the conversation (including the latest userPrompt) and extract the key travel preferences: mood, activity (and activityOther if applicable), durationDays, startDate, and endDate. If a preference isn't clear, leave the corresponding field empty in extractedData. Dates should be in YYYY-MM-DD format if possible to infer.`,
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
    // Call the prompt with the input data
    const {output} = await planTravelPrompt(input);

    // Return the structured output from the LLM
    // Ensure output is not null; provide a default or throw error if necessary
     if (!output) {
      throw new Error('AI failed to generate a response.');
    }
    return output;
  }
);
