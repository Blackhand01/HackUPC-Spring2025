// src/types/index.ts
import { Timestamp } from 'firebase/firestore';

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

// Travel Interface - Simplified
export interface Travel {
  id?: string; // Firestore document ID
  groupId: string | null;
  userId: string | null;
  departureCity: string;
  departureCityIata?: string | null; // IATA code for departure city (optional)
  preferences: string[]; // e.g., ["mood:relaxed", "activity:beach"]
  tripDateStart?: Timestamp | null; // Added start date
  tripDateEnd?: Timestamp | null; // Added end date
  places?: Place[]; // Candidate or selected places
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

// Property Interface
export interface Property {
  id?: string; // Firestore document ID
  hostId: string;
  title: string;
  address: {
    city: string;
    country: string;
    coordinates?: { lat: number | null; lng: number | null };
    // Potential addition: IATA code for the nearest airport
    nearestAirportIata?: string;
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
```