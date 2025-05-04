// src/ai/flows/plan-travel-assistant-flow.ts
'use server';
/**
 * @fileOverview An AI assistant that helps users plan their travel by engaging in a conversation.
 * It extracts key travel preferences like mood and activity from the chat.
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

// Define the schema for the extracted travel data - Simplified (No Dates/Duration)
const ExtractedTravelDataSchema = z.object({
    mood: z.string().optional().describe('The desired mood for the trip (e.g., relaxed, adventurous, cultural). Must be one of the allowed values if specified.'),
    activity: z.string().optional().describe('The main activity planned (e.g., hiking, museums, beach). Must be one of the allowed values or "other" if specified.'),
    activityOther: z.string().optional().describe('Specific description if the activity is "other".'),
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
    // IMPORTANT: The output schema here defines what the *LLM should return*.
    // It includes the response AND the extracted data structure.
    schema: PlanTravelAssistantOutputSchema,
  },
  // Use Handlebars templating for the prompt string - Simplified Prompt (No Dates/Duration)
  // Ensure the prompt explicitly lists the allowed values for mood and activity.
  prompt: `You are a friendly and slightly dreamy AI travel assistant for OnlyFly. Your goal is to help users plan their trips by having a natural conversation. Engage the user with evocative questions to understand their desired mood and activities, but keep the conversation flowing naturally. You do NOT need to ask about dates or duration.

Allowed Moods: relaxed, adventurous, cultural, social, nature
Allowed Activities: hiking, museums, beach, nightlife, foodie, other

Here are some examples of evocative questions you can adapt:
- Mood: "If your heart could take flight, where would it soar? Towards relaxation, adventure, or cultural discovery?" (Ensure response matches allowed moods)
- Activity: "Picture your perfect day on this trip. What fills the frame?" (Ensure response matches allowed activities or 'other')
- If Activity is 'other': "Could you capture that in a single word or short phrase?" (This will populate activityOther)

Based on the entire conversation history below, respond to the latest user message. Try to extract the user's preferences (mood, activity, activityOther if applicable) as you chat.

Conversation History:
{{#each currentChat}}
{{role}}: {{{text}}}
{{/each}}
user: {{{userPrompt}}}

Your task:
1. Generate a natural, friendly, and slightly evocative response to the user's latest message (userPrompt).
2. Analyze the conversation (including the latest userPrompt) and extract the key travel preferences: mood, activity (and activityOther if applicable).
   - The extracted 'mood' MUST be one of: relaxed, adventurous, cultural, social, nature.
   - The extracted 'activity' MUST be one of: hiking, museums, beach, nightlife, foodie, other.
   - If activity is 'other', also extract 'activityOther'.
   - If a preference isn't clearly stated or doesn't match the allowed values, leave the corresponding field empty in extractedData.
3. Return BOTH the response text and the extractedData object according to the output schema.`,
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
    // Log the extracted data for debugging
     console.log("AI Flow Extracted Data:", output.extractedData);
    return output;
  }
);
