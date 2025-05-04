// src/ai/flows/find-destination-matches-flow.ts
'use server';
/**
 * @fileOverview An AI agent that finds and ranks travel destinations based on user preferences.
 * It uses server-side IATA lookup, calls Gemini for semantic matching, enriches with Skyscanner,
 * and calculates a final score. It also fetches available properties for candidate destinations.
 *
 * - findDestinationMatches - A function that handles the destination matching process.
 * - FindDestinationMatchesInput - The input type for the findDestinationMatches function.
 * - FindDestinationMatchesOutput - The return type for the findDestinationMatches function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import { getFlightIndicativeData, type FlightData } from '@/services/skyscannerAPI';
import { getIataCodeForCity } from '@/lib/iataUtils'; // Import server-side IATA lookup
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type Property } from '@/types'; // Import Property type


// --- Input Schema (Simplified) ---
const FindDestinationMatchesInputSchema = z.object({
  moodPreferences: z.array(z.string()).optional().describe("List of mood preferences, e.g., ['relaxed']"),
  activityPreferences: z.array(z.string()).optional().describe("List of activity preferences, e.g., ['beach']"),
  departureCityName: z.string().min(1).describe("Name of the departure city (e.g., 'Torino'). IATA code will be looked up."), // Use Name
  // departureCityIata removed - will be looked up
  preferredStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Preferred start date (YYYY-MM-DD)."),
  preferredEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Preferred end date (YYYY-MM-DD)."),
  // candidateDestinationCities removed - will be derived from properties
  // candidateDestinationIatas removed - will be derived from properties
});
export type FindDestinationMatchesInput = z.infer<typeof FindDestinationMatchesInputSchema>;

// --- Output Schema (Remains the same) ---
const EnrichedDestinationSchema = z.object({
  destinationCity: z.string().min(1).describe("Name of the destination city."),
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
  departureCityIata: z.string().min(3).max(3).optional().nullable().describe("The resolved IATA code for the departure city."), // Optionally return resolved IATA
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
    schema: z.object({
       rankedDestinations: z.array(
            z.object({
                destinationCity: z.string().min(1).describe("The name of the destination city."),
                score: z.number().min(0).max(1).describe("The affinity score (0-1)."),
            })
       ).describe("Array of destinations (by city name) ranked by thematic fit based ONLY on the provided candidate list."),
    }),
  },
  prompt: `{{{promptText}}}`,
});

// --- Internal Helper: Fetch All Properties from Firestore ---
async function fetchAllPropertiesInternal(): Promise<Property[]> {
    try {
        const propertiesCollection = collection(db, 'properties');
        const querySnapshot = await getDocs(propertiesCollection);
        const propertiesList = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                address: {
                    city: data.address?.city || '',
                    country: data.address?.country || '',
                    coordinates: data.address?.coordinates || { lat: null, lng: null },
                    nearestAirportIata: data.address?.nearestAirportIata || null,
                }
            } as Property;
        });
        console.log(`Fetched ${propertiesList.length} properties internally.`);
        return propertiesList;
    } catch (error) {
        console.error('Error fetching all properties within flow:', error);
        throw new Error('Could not load properties for matching.'); // Re-throw
    }
}


// --- Genkit Flow ---
const findDestinationMatchesFlow = ai.defineFlow<
  FindDestinationMatchesInput,
  FindDestinationMatchesOutput
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
      departureCityName, // Use name
      preferredStartDate,
      preferredEndDate,
    } = input;

    // --- Step 1: Server-side IATA Lookup for Departure City ---
    let departureCityIata: string | null;
    try {
      departureCityIata = getIataCodeForCity(departureCityName);
      if (!departureCityIata) {
        throw new Error(`Could not find IATA code for departure city: ${departureCityName}`);
      }
       console.log(`Resolved departure IATA: ${departureCityIata} for ${departureCityName}`);
    } catch (error) {
        console.error("Error during departure IATA lookup:", error);
        // Decide how to handle - maybe return error immediately or try to proceed without IATA?
        // For Skyscanner, IATA is crucial, so throw.
        throw error instanceof Error ? error : new Error("Failed to resolve departure city IATA.");
    }


    // --- Step 2: Fetch Properties and Derive Candidate Destinations ---
    const allProps = await fetchAllPropertiesInternal();
    const cityIataMap = new Map<string, string>();
    allProps.forEach(prop => {
        if (prop.address?.city && prop.address?.nearestAirportIata) {
            const cityLower = prop.address.city.toLowerCase();
            if (!cityIataMap.has(cityLower)) {
                cityIataMap.set(cityLower, prop.address.nearestAirportIata);
            }
        }
    });

    const candidateDestinationCities = Array.from(cityIataMap.keys());
    if (candidateDestinationCities.length === 0) {
        console.warn("No candidate destination cities found from properties.");
        return { rankedDestinations: [], departureCityIata: departureCityIata }; // Return empty if no candidates
    }
     console.log(`Derived ${candidateDestinationCities.length} candidate destination cities:`, candidateDestinationCities);


    // --- Step 3: Semantic Matching with Gemini (using city names) ---
    let affinityScores: { [city: string]: number } = {}; // Use city name (lowercase) as key
    try {
        const moodText = moodPreferences.length > 0 ? `Their mood preferences are: ${moodPreferences.join(', ')}.` : '';
        const activityText = activityPreferences.length > 0 ? `Activities they enjoy: ${activityPreferences.join(', ')}.` : '';
        const dateText = `Travel dates: ${preferredStartDate} to ${preferredEndDate}.`;
        const departureText = `Departing from: ${departureCityName}.`; // Use city name
        const candidateListString = JSON.stringify(candidateDestinationCities);

        const geminiPromptText = `User preferences:\n- ${dateText}\n- ${departureText}\n${moodText ? `- ${moodText}\n` : ''}${activityText ? `- ${activityText}\n` : ''}
Rank ONLY these candidate destination cities by best thematic and experiential fit: ${candidateListString}
These destinations represent locations where house swaps are potentially available.
Return ONLY a JSON array with scores (0 to 1) for each provided candidate destination city, like [{"destinationCity": "Barcelona", "score": 0.92}, ...]. Only include cities from the provided candidate list.`;

        console.log("Sending prompt to Gemini:", geminiPromptText);

        const { output } = await destinationRankingPrompt({ promptText: geminiPromptText });

        if (!output || !output.rankedDestinations) {
            console.warn("Gemini did not return ranked destinations in the expected format.");
            candidateDestinationCities.forEach(city => affinityScores[city.toLowerCase()] = 0.5); // Default score
        } else {
             console.log("Received ranking from Gemini:", output.rankedDestinations);
             output.rankedDestinations.forEach(item => {
                 const cityLower = item.destinationCity.toLowerCase();
                 if (cityIataMap.has(cityLower)) {
                     affinityScores[cityLower] = item.score;
                 } else {
                    console.warn(`Gemini returned score for non-candidate city: ${item.destinationCity}`);
                 }
             });
              candidateDestinationCities.forEach(city => {
                  const cityLower = city.toLowerCase();
                 if (!(cityLower in affinityScores)) {
                    console.warn(`Gemini did not return score for ${city}, assigning default 0.5`);
                    affinityScores[cityLower] = 0.5;
                 }
             });
        }

    } catch (error) {
      console.error("Error calling Gemini API:", error);
       candidateDestinationCities.forEach(city => affinityScores[city.toLowerCase()] = 0.5);
    }

    console.log("Affinity Scores after Gemini (by city):", affinityScores);


    // --- Step 4: Enrichment with Skyscanner API ---
    const enrichedDestinationsPromises = candidateDestinationCities.map(async (destCity): Promise<EnrichedDestination> => {
        const destCityLower = destCity.toLowerCase();
        const destIata = cityIataMap.get(destCityLower);
        let flightData: FlightData | null = null;
        let errorMessage: string | undefined = undefined;
        let affinityScore = affinityScores[destCityLower];

        if (!destIata) {
             console.error(`Could not find IATA code for destination city: ${destCity}`);
             errorMessage = `Internal error: IATA code not found for ${destCity}.`;
             affinityScore = 0;
        } else {
            try {
                flightData = await getFlightIndicativeData({
                    originPlace: { queryPlace: { iata: departureCityIata! } }, // Use resolved departure IATA
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
        }

        // --- Step 5: Calculate Final Score ---
        let finalScore = 0.4 * (affinityScore ?? 0);
        const price = flightData?.priceEur;
        const co2 = flightData?.co2Kg;
        const stops = flightData?.stops;

        if (price !== undefined && price !== null) {
            const normalizedPrice = Math.max(0, Math.min(1, price / 500));
            finalScore += 0.3 * (1 - normalizedPrice);
        }
        if (co2 !== undefined && co2 !== null) {
             const normalizedCo2 = Math.max(0, Math.min(1, co2 / 200));
            finalScore += 0.2 * (1 - normalizedCo2);
        }
         if (stops !== undefined && stops !== null) {
            finalScore += 0.1 * (stops === 0 ? 1 : 0.5);
         }

        return {
            destinationCity: destCity,
            destinationIata: destIata || "N/A",
            affinityScore: affinityScore,
            priceEur: price,
            co2Kg: co2,
            stops: stops,
            durationMinutes: flightData?.durationMinutes,
            finalScore: Math.max(0, Math.min(1, finalScore)),
            errorMessage: errorMessage,
        };
    });

    const enrichedDestinations = await Promise.all(enrichedDestinationsPromises);

    // --- Step 6: Rank and Return ---
     const rankedDestinations = enrichedDestinations.sort((a, b) => {
        if (a.errorMessage && !b.errorMessage) return 1;
        if (!a.errorMessage && b.errorMessage) return -1;
        if (a.errorMessage && b.errorMessage) return 0;
        return (b.finalScore ?? 0) - (a.finalScore ?? 0);
    });

    console.log("Final Ranked Destinations:", rankedDestinations);

    return { rankedDestinations, departureCityIata }; // Include resolved departure IATA in output
  }
);
