// src/types/index.ts
import { Timestamp } from 'firebase/firestore';
import type { EnrichedDestination } from '@/ai/flows/find-destination-matches-flow'; // Import match type

// Review Interface
export interface Review {
  id: string; // Firestore document ID
  reviewerId: string;
  reviewedUserId: string;
  tripId: string; // Link to the specific trip/swap
  rating: number; // 1-5
  co2Emissions: number; // kg CO2e associated with the trip
  description: string;
  createdAt: Timestamp;
}

// Place Interface (Used within Travel) - Coordinates are optional
export interface Place {
  name: string;
  coordinate?: { lat: number | null; lng: number | null }; // Make coordinates optional
  country: string;
}

// Travel Interface - Updated fields for matching clarity
export interface Travel {
  id?: string; // Firestore document ID
  groupId: string | null;
  userId: string | null;
  departureCity: string; // Required for matching
  departureCityIata: string | null; // Derived, nullable
  preferences: string[]; // Required, needs mood & activity for matching
  tripDateStart: Timestamp; // Required for matching
  tripDateEnd: Timestamp; // Required for matching
  places?: Place[]; // Candidate or selected places
  status: 'pending' | 'matching' | 'matched' | 'error' | 'booked' | 'archived';
  matches?: EnrichedDestination[]; // Array to store matching results from AI flow
  errorDetails?: string | null;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}


// Group Interface
export interface Group {
  id: string;
  groupName: string;
  createBy: string; // userId
  createAt: Timestamp;
  users: string[]; // Array of userIds
}

// Property Interface - Added nearestAirportIata
export interface Property {
  id?: string; // Firestore document ID
  hostId: string;
  title: string;
  address: {
    city: string; // City name is crucial for matching
    country: string;
    coordinates?: { lat: number | null; lng: number | null };
    nearestAirportIata: string | null; // IATA code (allow null)
  };
  description: string;
  amenities: string[];
  rules: string[];
  greenScore: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  images: {
    imageId: string;
    description: string;
    order: number;
    storagePath: string | null; // Store Firebase Storage path here
  }[];
}

// Chat Message Interface (for AI Chat)
export interface ChatMessage {
  sender: 'user' | 'ai';
  message: string;
  timestamp: number;
}

// --- You can add more shared types here as needed ---
