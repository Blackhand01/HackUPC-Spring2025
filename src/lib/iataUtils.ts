// src/lib/iataUtils.ts
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync'; // Using sync parse for simplicity

interface IataRecord {
    id: string;
    IATA: string;
    'en-GB': string; // City name
    latitude: string;
    longitude: string;
    vibes: string;
}

let iataData: IataRecord[] | null = null;

function loadIataData(): IataRecord[] {
    if (iataData) {
        return iataData;
    }

    try {
        // Resolve the path relative to the project root where the script is likely run from
        const csvFilePath = path.resolve(process.cwd(), 'src/lib/data/iata_airports_and_locations_with_vibes.csv');
        console.log(`Attempting to load IATA data from: ${csvFilePath}`); // Debug log

        if (!fs.existsSync(csvFilePath)) {
             console.error(`Error: IATA CSV file not found at ${csvFilePath}`);
             throw new Error(`IATA CSV file not found at path: ${csvFilePath}. Ensure the file exists and the path is correct relative to the project root.`);
        }

        const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });

        iataData = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        console.log(`Successfully loaded ${iataData?.length} IATA records.`); // Debug log
        return iataData!;
    } catch (error: any) {
        console.error("Error loading or parsing IATA CSV:", error);
        // Depending on the error, you might want to re-throw or return empty
        if (error.code === 'ENOENT') {
             throw new Error(`IATA data file not found. Checked path: ${path.resolve(process.cwd(), 'src/lib/data/iata_airports_and_locations_with_vibes.csv')}`);
        }
        throw new Error(`Failed to load or parse IATA data: ${error.message}`);
    }
}

/**
 * Finds the IATA code for a given city name (case-insensitive).
 * IMPORTANT: This function uses 'fs' and should only be called from server-side environments.
 * @param cityName The name of the city (e.g., "Turin").
 * @returns The IATA code (e.g., "TRN") or null if not found.
 */
export function getIataCodeForCity(cityName: string): string | null {
    if (!cityName) {
        console.warn("getIataCodeForCity called with empty cityName.");
        return null;
    }

    const data = loadIataData(); // Load data on demand
    if (!data) {
        console.error("IATA data is not loaded.");
        return null;
    }

    const searchTerm = cityName.trim().toLowerCase();
    const record = data.find(r => r['en-GB'].toLowerCase() === searchTerm);

    if (record) {
        console.log(`Found IATA ${record.IATA} for city ${cityName}`); // Debug log
        return record.IATA;
    } else {
        console.warn(`IATA code not found for city: ${cityName}`); // Debug log
        return null;
    }
}

/**
 * Finds the City name for a given IATA code (case-insensitive).
 * IMPORTANT: This function uses 'fs' and should only be called from server-side environments.
 * @param iataCode The IATA code (e.g., "TRN").
 * @returns The City name (e.g., "Turin") or null if not found.
 */
export function getCityNameForIata(iataCode: string): string | null {
    if (!iataCode) {
        console.warn("getCityNameForIata called with empty iataCode.");
        return null;
    }
    const data = loadIataData();
    if (!data) {
        console.error("IATA data is not loaded.");
        return null;
    }
    const searchTerm = iataCode.trim().toUpperCase();
    const record = data.find(r => r.IATA.toUpperCase() === searchTerm);
    return record ? record['en-GB'] : null;
}
