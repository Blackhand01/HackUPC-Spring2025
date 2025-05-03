// src/types/index.ts
import { Timestamp } from 'firebase/firestore';
import { type EnrichedDestination } from '@/ai/flows/find-destination-matches-flow'; // Import from flow

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

// Place Interface (Used within Travel)
export interface Place {
  name: string;
  coordinate?: { lat: number | null; lng: number | null };
  country: string;
}

// Travel Interface
export interface Travel {
  id?: string; // Firestore document ID
  groupId: string | null;
  userId: string | null;
  departureCity: string;
  preferences: string[]; // e.g., ["mood:relaxed", "activity:beach"]
  dateRange?: { start: Timestamp; end: Timestamp } | null;
  durationDays?: number;
  places?: Place[]; // Candidate or selected places
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  // --- Added fields for destination matching ---
  destinationMatches?: EnrichedDestination[]; // Store ranked results from find-destination-matches-flow
  destinationMatchesStatus?: 'pending' | 'processing' | 'completed' | 'error';
  destinationMatchesError?: string;
  lastMatchedAt?: Timestamp;
}

// Group Interface
export interface Group {
  id: string;
  groupName: string;
  createBy: string; // userId
  createAt: Timestamp;
  users: string[]; // Array of userIds
}

// Property Interface
export interface Property {
  id?: string; // Firestore document ID
  hostId: string;
  title: string;
  address: {
    city: string;
    country: string;
    coordinates?: { lat: number | null; lng: number | null };
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

// --- You can add more shared types here as needed ---
