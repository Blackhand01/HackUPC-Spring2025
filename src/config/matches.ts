// src/config/matches.ts
import { Smile, Mountain, Film, Users, Leaf, PlaneTakeoff, Utensils, Info } from 'lucide-react';

export const MOOD_OPTIONS = [
    { value: "relaxed", label: "Relaxed", icon: <Smile className="h-4 w-4" /> },
    { value: "adventurous", label: "Adventurous", icon: <Mountain className="h-4 w-4" /> },
    { value: "cultural", label: "Cultural", icon: <Film className="h-4 w-4" /> },
    { value: "social", label: "Social", icon: <Users className="h-4 w-4" /> },
    { value: "nature", label: "Nature", icon: <Leaf className="h-4 w-4" /> },
];

export const ACTIVITY_OPTIONS = [
    { value: "hiking", label: "Hiking", icon: <Mountain className="h-4 w-4" /> },
    { value: "museums", label: "Museums", icon: <Film className="h-4 w-4" /> },
    { value: "beach", label: "Beach", icon: <PlaneTakeoff className="h-4 w-4" /> }, // Replace with better icon if available
    { value: "nightlife", label: "Nightlife", icon: <Users className="h-4 w-4" /> },
    { value: "foodie", label: "Foodie", icon: <Utensils className="h-4 w-4" /> },
    { value: "other", label: "Other...", icon: <Info className="h-4 w-4" /> },
];

// Candidate IATA codes (Example - Should be fetched dynamically ideally)
// export const CANDIDATE_DESTINATION_IATAS = ["BCN", "LIS", "DBV", "RAK", "VLC", "ATH", "NAP"]; // Example list
