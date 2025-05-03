// src/services/skyscannerAPI.ts
'use server'; // Mark this module for server-side execution

import { z } from 'zod';

// --- Zod Schemas for API Request/Response (subset) ---

const QueryPlaceSchema = z.object({
  iata: z.string().min(3).max(3),
});

const DateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),   // YYYY-MM-DD
});

const QueryLegSchema = z.object({
  originPlace: z.object({ queryPlace: QueryPlaceSchema }),
  destinationPlace: z.object({ queryPlace: QueryPlaceSchema }),
  date: z.object({ dateRange: DateRangeSchema }),
});

const IndicativeSearchQuerySchema = z.object({
  market: z.string().default("IT"),
  locale: z.string().default("en-GB"),
  currency: z.string().default("EUR"),
  queryLegs: z.array(QueryLegSchema).length(1), // Only support single leg for now
  cabinClass: z.string().default("CABIN_CLASS_ECONOMY"),
  adults: z.number().default(1),
});

const PriceSchema = z.object({
  raw: z.number().optional(), // Price in cents/lowest denomination
  formatted: z.string().optional(),
});

const CarbonEmissionsSchema = z.object({
  amountKg: z.number().optional(),
});

const SegmentSchema = z.object({
  durationMinutes: z.number().optional(),
  // Add other segment details if needed (e.g., operatingCarrier)
});

const ItinerarySchema = z.object({
  price: PriceSchema.optional(),
  carbonEmissions: CarbonEmissionsSchema.optional(),
  legSeparators: z.array(z.any()).optional(), // Used to infer stops
  segments: z.array(SegmentSchema).optional(),
});

const IndicativeSearchResponseSchema = z.object({
  status: z.string(),
  content: z.object({
    results: z.object({
      quotes: z.record(ItinerarySchema).optional(), // Use record for quotes
      // Add carriers, places if needed later
    }).optional(),
    sortingOptions: z.object({
      best: z.array(z.object({ score: z.number(), itineraryId: z.string() })).optional(),
      // cheapest, fastest...
    }).optional(),
    stats: z.object({
        quotes: z.object({
            minPrice: PriceSchema.optional(),
            // ... other stats
        }).optional(),
    }).optional(),
  }).optional(),
});

// --- Input Type for our Function ---
export type FlightSearchInput = {
    originPlace: { queryPlace: { iata: string } };
    destinationPlace: { queryPlace: { iata: string } };
    date: { dateRange: { startDate: string; endDate: string } };
    market?: string;
    locale?: string;
    currency?: string;
    adults?: number;
};

// --- Output Type for our Function ---
export type FlightData = {
    priceEur?: number;
    co2Kg?: number;
    stops?: number;
    durationMinutes?: number;
};

// --- API Interaction Function ---
const SKYSCANNER_API_URL = "https://partners.api.skyscanner.net/apiservices/v3/flights/indicative/search";
const SKYSCANNER_API_KEY = process.env.SKYSCANNER_API_KEY; // Ensure this is set in your .env file

export async function getFlightIndicativeData(input: FlightSearchInput): Promise<FlightData | null> {
  if (!SKYSCANNER_API_KEY) {
    console.error("Skyscanner API key is not configured.");
    throw new Error("Skyscanner API key is missing.");
  }

  const queryPayload = {
    query: {
      market: input.market || "IT",
      locale: input.locale || "en-GB",
      currency: input.currency || "EUR",
      queryLegs: [
        {
          originPlace: input.originPlace,
          destinationPlace: input.destinationPlace,
          date: input.date,
        },
      ],
      cabinClass: "CABIN_CLASS_ECONOMY",
      adults: input.adults || 1,
    },
  };

  try {
    const response = await fetch(SKYSCANNER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SKYSCANNER_API_KEY,
      },
      body: JSON.stringify(queryPayload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Skyscanner API Error (${response.status}): ${errorBody}`);
        throw new Error(`Skyscanner API request failed with status ${response.status}`);
    }

    const rawData = await response.json();
    console.log(`Raw Skyscanner Response for ${input.destinationPlace.queryPlace.iata}:`, JSON.stringify(rawData, null, 2)); // Log raw response


    // Validate the response structure (optional but recommended)
    const parsedData = IndicativeSearchResponseSchema.safeParse(rawData);

    if (!parsedData.success) {
        console.error("Failed to parse Skyscanner response:", parsedData.error.issues);
        throw new Error("Invalid response structure from Skyscanner API.");
    }

    const results = parsedData.data.content?.results;
    const sortingOptions = parsedData.data.content?.sortingOptions;

    if (!results || !results.quotes || !sortingOptions || !sortingOptions.best || sortingOptions.best.length === 0) {
      console.log(`No indicative flight results found for ${input.destinationPlace.queryPlace.iata}.`);
      return null; // No quotes or best option found
    }

    // Get the ID of the 'best' itinerary
    const bestItineraryId = sortingOptions.best[0].itineraryId;
    const bestItinerary = results.quotes[bestItineraryId];

    if (!bestItinerary) {
        console.log(`Best itinerary (${bestItineraryId}) not found in quotes for ${input.destinationPlace.queryPlace.iata}. Falling back to min price.`);
        // Fallback: Use minPrice from stats if available
        const minPriceRaw = parsedData.data.content?.stats?.quotes?.minPrice?.raw;
        if (minPriceRaw !== undefined) {
             return {
                priceEur: minPriceRaw / 100, // Assuming EUR, adjust if currency changes
                // CO2, stops, duration might be unavailable in this fallback
             };
        }
        return null; // No data available
    }


    const priceRaw = bestItinerary.price?.raw;
    const co2Kg = bestItinerary.carbonEmissions?.amountKg;
    // Infer stops: number of leg separators = number of stops + 1 (for round trip) or just number of stops (one way)
    // This is a simplification; a more robust way would analyze segments/legs if API provides them clearly.
    const stops = Math.max(0, (bestItinerary.legSeparators?.length ?? 1) - 1); // Simplistic stop count

    // Sum duration from segments if available
    let totalDurationMinutes : number | undefined = undefined;
    if (bestItinerary.segments && bestItinerary.segments.length > 0) {
        totalDurationMinutes = bestItinerary.segments.reduce((sum, segment) => sum + (segment.durationMinutes ?? 0), 0);
    }


    return {
        priceEur: priceRaw !== undefined ? priceRaw / 100 : undefined, // Assuming EUR, adjust needed
        co2Kg: co2Kg,
        stops: stops,
        durationMinutes: totalDurationMinutes,
    };

  } catch (error) {
    console.error(`Error calling Skyscanner API for ${input.destinationPlace.queryPlace.iata}:`, error);
    throw error; // Re-throw the error to be handled by the calling flow
  }
}
