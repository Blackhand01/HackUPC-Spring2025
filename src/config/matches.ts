// src/config/matches.ts
// Removed icon properties to avoid JSX in TS config file

export const MOOD_OPTIONS = [
    { value: "relaxed", label: "Relaxed" },
    { value: "adventurous", label: "Adventurous" },
    { value: "cultural", label: "Cultural" },
    { value: "social", label: "Social" },
    { value: "nature", label: "Nature" },
];

export const ACTIVITY_OPTIONS = [
    { value: "hiking", label: "Hiking" },
    { value: "museums", label: "Museums" },
    { value: "beach", label: "Beach" },
    { value: "nightlife", label: "Nightlife" },
    { value: "foodie", label: "Foodie" },
    { value: "other", label: "Other..." },
];

// Candidate IATA codes (Example - Should be fetched dynamically ideally)
// export const CANDIDATE_DESTINATION_IATAS = ["BCN", "LIS", "DBV", "RAK", "VLC", "ATH", "NAP"]; // Example list

