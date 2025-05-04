// src/ai/flows/find-destination-matches-flow.ts
'use server';
/**
 * @fileOverview An AI agent that finds and ranks travel destinations based on user preferences and available property locations.
 * It uses Gemini for semantic matching of candidate destinations,
 * enriches the results with Skyscanner flight data (price, CO2, stops, duration),
 * and calculates a final weighted score.
 *
 * - findDestinationMatches - A function that handles the destination matching process.
 * - FindDestinationMatchesInput - The input type for the findDestinationMatches function.
 * - FindDestinationMatchesOutput - The return type for the findDestinationMatches function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import { getFlightIndicativeData, type FlightData } from '@/services/skyscannerAPI'; // Import Skyscanner service

// --- Input Schema ---
const FindDestinationMatchesInputSchema = z.object({
  moodPreferences: z.array(z.string()).optional().describe("List of mood preferences, e.g., ['relaxed']"),
  activityPreferences: z.array(z.string()).optional().describe("List of activity preferences, e.g., ['beach']"),
  departureCityIata: z.string().min(3).max(3).describe("IATA code of the departure city (e.g., 'TRN')."),
  preferredStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Preferred start date (YYYY-MM-DD)."),
  preferredEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Preferred end date (YYYY-MM-DD)."),
  candidateDestinationIatas: z.array(z.string().min(3).max(3)).min(1).describe("List of candidate destination IATA codes based on available properties (e.g., ['BCN', 'LIS'])."),
});
export type FindDestinationMatchesInput = z.infer<typeof FindDestinationMatchesInputSchema>;

// --- Output Schema ---
const EnrichedDestinationSchema = z.object({
  destinationIata: z.string().min(3).max(3),
  affinityScore: z.number().min(0).max(1).optional().describe("Thematic fit score from AI (0-1)."),
  priceEur: z.number().optional().describe("Estimated round-trip flight price in EUR."),
  co2Kg: z.number().optional().describe("Estimated round-trip CO2 emissions in kg."),
  stops: z.number().optional().describe("Number of stops for the cheapest/best flight option."),
  durationMinutes: z.number().optional().describe("Total flight duration in minutes."),
  finalScore: z.number().min(0).max(1).optional().describe("Calculated overall score for the destination (0-1)."),
  errorMessage: z.string().optional().describe("Error message if data fetching failed for this destination."),
});
export type EnrichedDestination = z.infer<typeof EnrichedDestinationSchema>;

const FindDestinationMatchesOutputSchema = z.object({
  rankedDestinations: z.array(EnrichedDestinationSchema).describe("List of candidate destinations ranked by final score."),
});
export type FindDestinationMatchesOutput = z.infer<typeof FindDestinationMatchesOutputSchema>;

// --- Exported Wrapper Function ---
export async function findDestinationMatches(input: FindDestinationMatchesInput): Promise<FindDestinationMatchesOutput> {
  console.log("Executing findDestinationMatchesFlow with input:", input);
  return findDestinationMatchesFlow(input);
}

// --- Gemini Prompt for Affinity Ranking ---
const destinationRankingPrompt = ai.definePrompt({
  name: 'destinationRankingPrompt',
  input: {
    schema: z.object({
        promptText: z.string().describe("The full prompt text sent to Gemini."),
    }),
  },
  output: {
    // Expecting an array of objects with destination IATA and score
    schema: z.object({
       rankedDestinations: z.array(
            z.object({
                destinationIata: z.string().min(3).max(3).describe("The IATA code of the destination."),
                score: z.number().min(0).max(1).describe("The affinity score (0-1)."),
            })
       ).describe("Array of destinations ranked by thematic fit based ONLY on the provided candidate list."),
    }),
  },
  prompt: `{{{promptText}}}`, // Use the dynamically generated prompt text
});

// --- Skyscanner Tool (Placeholder/Example - Using direct service call in flow) ---
// In a more complex scenario, this could be a Genkit tool, but for now, we'll call the service directly.
// const getSkyscannerDataTool = ai.defineTool( ... );

// --- Genkit Flow ---
const findDestinationMatchesFlow = ai.defineFlow<
  typeof FindDestinationMatchesInputSchema,
  typeof FindDestinationMatchesOutputSchema
>(
  {
    name: 'findDestinationMatchesFlow',
    inputSchema: FindDestinationMatchesInputSchema,
    outputSchema: FindDestinationMatchesOutputSchema,
  },
  async (input) => {
    console.log("findDestinationMatchesFlow started with input:", input);
    const {
      moodPreferences = [],
      activityPreferences = [],
      departureCityIata,
      preferredStartDate,
      preferredEndDate,
      candidateDestinationIatas, // Now explicitly receives candidates derived from properties
    } = input;

    // --- Step 2: Semantic Matching with Gemini ---
    let affinityScores: { [iata: string]: number } = {};
    try {
        // Construct the dynamic prompt for Gemini using the provided candidate list
        const moodText = moodPreferences.length > 0 ? `Their mood preferences are: ${moodPreferences.join(', ')}.` : '';
        const activityText = activityPreferences.length > 0 ? `Activities they enjoy: ${activityPreferences.join(', ')}.` : '';
        const dateText = `Travel dates: ${preferredStartDate} to ${preferredEndDate}.`;
        const departureText = `Departing from: ${departureCityIata}.`;
        const candidateListString = JSON.stringify(candidateDestinationIatas); // Use the list from input

        const geminiPromptText = `User preferences:\n- ${dateText}\n- ${departureText}\n${moodText ? `- ${moodText}\n` : ''}${activityText ? `- ${activityText}\n` : ''}
Rank ONLY these candidate destinations by best thematic and experiential fit: ${candidateListString}
These destinations represent locations where house swaps are potentially available.
Return ONLY a JSON array with scores (0 to 1) for each provided candidate destination, like [{"destinationIata": "BCN", "score": 0.92}, ...]. Only include destinations from the provided candidate list.`;

        console.log("Sending prompt to Gemini:", geminiPromptText);

        const { output } = await destinationRankingPrompt({ promptText: geminiPromptText });

        if (!output || !output.rankedDestinations) {
            console.warn("Gemini did not return ranked destinations in the expected format.");
            // Assign default score or handle error as needed
            candidateDestinationIatas.forEach(iata => affinityScores[iata] = 0.5); // Default score
        } else {
             console.log("Received ranking from Gemini:", output.rankedDestinations);
             output.rankedDestinations.forEach(item => {
                 // Ensure only candidate destinations are included
                 if (candidateDestinationIatas.includes(item.destinationIata)) {
                     affinityScores[item.destinationIata] = item.score;
                 } else {
                    console.warn(`Gemini returned score for non-candidate destination: ${item.destinationIata}`);
                 }
             });
             // Assign default score to any candidates missed by Gemini
              candidateDestinationIatas.forEach(iata => {
                 if (!(iata in affinityScores)) {
                    console.warn(`Gemini did not return score for ${iata}, assigning default 0.5`);
                    affinityScores[iata] = 0.5;
                 }
             });
        }

    } catch (error) {
      console.error("Error calling Gemini API:", error);
      // Handle error, e.g., assign default scores or throw
       candidateDestinationIatas.forEach(iata => affinityScores[iata] = 0.5); // Assign default score on error
    }

    console.log("Affinity Scores after Gemini:", affinityScores);


    // --- Step 3: Enrichment with Skyscanner API ---
    const enrichedDestinationsPromises = candidateDestinationIatas.map(async (destIata): Promise<EnrichedDestination> => {
        let flightData: FlightData | null = null;
        let errorMessage: string | undefined = undefined;
        try {
            flightData = await getFlightIndicativeData({
                originPlace: { queryPlace: { iata: departureCityIata } },
                destinationPlace: { queryPlace: { iata: destIata } },
                date: {
                    dateRange: {
                        startDate: preferredStartDate,
                        endDate: preferredEndDate,
                    },
                },
            });
             console.log(`Skyscanner data for ${departureCityIata} -> ${destIata}:`, flightData);
        } catch (error) {
            console.error(`Error fetching Skyscanner data for ${destIata}:`, error);
            errorMessage = error instanceof Error ? error.message : "Failed to fetch flight data.";
        }

        const affinityScore = affinityScores[destIata]; // Retrieve score calculated earlier

        // --- Step 4: Calculate Final Score ---
        let finalScore = 0.4 * (affinityScore ?? 0); // Start with affinity (default 0 if missing)
        const price = flightData?.priceEur;
        const co2 = flightData?.co2Kg;
        const stops = flightData?.stops;

        if (price !== undefined && price !== null) {
            // Normalize price (assuming max relevant price is 500 EUR)
            const normalizedPrice = Math.max(0, Math.min(1, price / 500));
            finalScore += 0.3 * (1 - normalizedPrice);
        }
        if (co2 !== undefined && co2 !== null) {
             // Normalize CO2 (assuming max relevant emission is 200 kg)
             const normalizedCo2 = Math.max(0, Math.min(1, co2 / 200));
            finalScore += 0.2 * (1 - normalizedCo2);
        }
         if (stops !== undefined && stops !== null) {
            // Score based on stops (1 for direct, 0.5 for 1+ stops)
            finalScore += 0.1 * (stops === 0 ? 1 : 0.5);
         }

        return {
            destinationIata: destIata,
            affinityScore: affinityScore,
            priceEur: price,
            co2Kg: co2,
            stops: stops,
            durationMinutes: flightData?.durationMinutes,
            finalScore: Math.max(0, Math.min(1, finalScore)), // Clamp score between 0 and 1
            errorMessage: errorMessage,
        };
    });

    const enrichedDestinations = await Promise.all(enrichedDestinationsPromises);

    // --- Step 5: Rank and Return ---
    // Sort by finalScore descending, put destinations with errors at the end
     const rankedDestinations = enrichedDestinations.sort((a, b) => {
        if (a.errorMessage && !b.errorMessage) return 1; // a has error, b doesn't -> b comes first
        if (!a.errorMessage && b.errorMessage) return -1; // a has no error, b does -> a comes first
        if (a.errorMessage && b.errorMessage) return 0; // both have errors, order doesn't matter much
        return (b.finalScore ?? 0) - (a.finalScore ?? 0); // Sort by score descending
    });

    console.log("Final Ranked Destinations:", rankedDestinations);

    return { rankedDestinations };
  }
);
