// src/hooks/matches/useTravelData.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, Timestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { type Travel, type Group, type Property } from '@/types';
import { type TravelFormValues } from './useTravelForm';
import { format } from 'date-fns';
import { findDestinationMatches, type FindDestinationMatchesInput, type EnrichedDestination } from '@/ai/flows/find-destination-matches-flow';
// Removed: import { getIataCodeForCity } from '@/lib/iataUtils'; // This causes build error as 'fs' is server-side

export function useTravelData() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [myIndividualTravels, setMyIndividualTravels] = useState<Travel[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [loadingTravels, setLoadingTravels] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);

  // --- Fetch Individual Travels ---
  const fetchMyIndividualTravels = useCallback(async () => {
    if (user?.uid) {
      setLoadingTravels(true);
      try {
        const travelsCollection = collection(db, 'travels');
        const q = query(
          travelsCollection,
          where('userId', '==', user.uid),
          where('groupId', '==', null),
          // where('status', '!=', 'archived') // Consider adding back if needed
        );
        const querySnapshot = await getDocs(q);
        const travelsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Travel[];
        setMyIndividualTravels(travelsList);
      } catch (error) {
        console.error('Error fetching user travels:', error);
        toast({
          variant: 'destructive',
          title: 'Error Fetching Travels',
          description: 'Could not load your travels. Please try again later.',
        });
      } finally {
        setLoadingTravels(false);
      }
    } else if (!authLoading) {
      setLoadingTravels(false);
    }
  }, [user, authLoading, toast]);

  // --- Fetch User's Groups ---
  const fetchMyGroups = useCallback(async () => {
    if (user?.uid) {
      setLoadingGroups(true);
      try {
        const groupsCollection = collection(db, 'groups');
        const q = query(groupsCollection, where('users', 'array-contains', user.uid));
        const querySnapshot = await getDocs(q);
        const groupsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          groupName: doc.data().groupName || `Group ${doc.id.substring(0, 5)}`,
           createBy: doc.data().createBy,
           createAt: doc.data().createAt,
           users: doc.data().users,
        })) as Group[];
        setMyGroups(groupsList);
      } catch (error) {
        console.error('Error fetching groups for selection:', error);
      } finally {
        setLoadingGroups(false);
      }
    } else if (!authLoading) {
      setLoadingGroups(false);
    }
  }, [user, authLoading]);

    // --- Fetch All Properties ---
    const fetchAllProperties = useCallback(async () => {
        setLoadingProperties(true);
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

            setAllProperties(propertiesList);
            console.log("Fetched all properties:", propertiesList.length);
        } catch (error) {
            console.error('Error fetching all properties:', error);
            toast({
                variant: 'destructive',
                title: 'Error Loading Properties',
                description: 'Could not load available properties for matching.',
            });
            setAllProperties([]);
        } finally {
            setLoadingProperties(false);
        }
    }, [toast]);

  // --- Initial Data Fetch ---
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      fetchMyIndividualTravels();
      fetchMyGroups();
      fetchAllProperties();
    }
  }, [user, isAuthenticated, authLoading, fetchMyIndividualTravels, fetchMyGroups, fetchAllProperties]);

  // --- NEW: Function to Initiate Matching Process ---
  const initiateMatchingProcess = useCallback(async (savedTravel: Travel) => {
        const travelId = savedTravel.id;
        console.log("Initiating matching process for travel:", travelId);

        if (!travelId) {
            console.error("Matching initiation failed: Travel ID is missing.");
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to start matching: Travel ID missing.' });
            return;
        }

         const travelData = savedTravel;

        // --- Validation ---
        if (!travelData.departureCity) {
            toast({ variant: 'destructive', title: 'Missing Info', description: 'Departure city is required for matching.' });
             await updateDoc(doc(db, 'travels', travelId), { status: 'error', errorDetails: 'Departure city missing.' });
            return;
        }
        if (!travelData.tripDateStart || !travelData.tripDateEnd) {
            toast({ variant: 'destructive', title: 'Missing Info', description: 'Trip start and end dates are required.' });
            await updateDoc(doc(db, 'travels', travelId), { status: 'error', errorDetails: 'Trip dates missing.' });
            return;
        }
        if (!travelData.preferences || travelData.preferences.length === 0) {
             toast({ variant: 'destructive', title: 'Missing Info', description: 'Preferences (mood/activity) are required.' });
             await updateDoc(doc(db, 'travels', travelId), { status: 'error', errorDetails: 'Preferences missing.' });
             return;
        }
        if (loadingProperties || allProperties.length === 0) {
             toast({ variant: 'destructive', title: 'Data Missing', description: 'Properties not loaded yet. Cannot match.' });
             // Don't set status to error immediately, maybe wait for properties
             return;
        }

        // Update status to 'matching' in Firestore
        const travelRef = doc(db, 'travels', travelId);
        try {
            await updateDoc(travelRef, {
                status: 'matching',
                // departureCityIata is no longer set here
                errorDetails: null,
                updatedAt: Timestamp.now(),
                matches: [],
            });
            // Update local state immediately
            setMyIndividualTravels(prev => prev.map(t => t.id === travelId ? { ...t, status: 'matching', matches: [], errorDetails: null } : t));
            toast({ title: 'Matching Started', description: 'Finding the best destinations...' });
        } catch (error) {
             console.error("Error updating travel status to 'matching':", error);
             toast({ variant: 'destructive', title: 'Error', description: 'Could not start matching.' });
             return;
        }

        // --- Call AI Flow (which now handles IATA lookup) ---
        try {
            // Prepare input for the AI flow
            // The AI flow will internally fetch properties and lookup IATA codes
            const moodPrefs = travelData.preferences.filter(p => p.startsWith('mood:')).map(p => p.substring(5));
            const activityPrefs = travelData.preferences.filter(p => p.startsWith('activity:')).map(p => p.substring(9));
            const startDateStr = format(travelData.tripDateStart.toDate(), 'yyyy-MM-dd');
            const endDateStr = format(travelData.tripDateEnd.toDate(), 'yyyy-MM-dd');

            // The FindDestinationMatchesInput now expects city names and the flow handles lookup
            const matchingInput = {
                moodPreferences: moodPrefs,
                activityPreferences: activityPrefs,
                departureCityName: travelData.departureCity, // Pass city name
                preferredStartDate: startDateStr,
                preferredEndDate: endDateStr,
            };

            console.log("Sending data to findDestinationMatches flow (server-side IATA lookup):", matchingInput);
            // Cast the input explicitly if needed, ensure the flow definition matches
            const result = await findDestinationMatches(matchingInput as FindDestinationMatchesInput);
            console.log("Received matching results:", result);

            // Update Firestore with results (including departure IATA potentially added by the flow)
            await updateDoc(travelRef, {
                status: 'matched',
                matches: result.rankedDestinations,
                 departureCityIata: result.departureCityIata, // Store the resolved departure IATA from the flow
                updatedAt: Timestamp.now(),
            });

            // Update local state
            setMyIndividualTravels(prev => prev.map(t => t.id === travelId ? { ...t, status: 'matched', matches: result.rankedDestinations, departureCityIata: result.departureCityIata } : t));
            toast({ title: 'Matching Complete!', description: 'Potential destinations found.' });

        } catch (error) {
            console.error("Error during destination matching flow:", error);
            const message = error instanceof Error ? error.message : "Unknown error during matching.";

            try {
                await updateDoc(travelRef, { status: 'error', errorDetails: message, updatedAt: Timestamp.now() });
            } catch (updateError) {
                 console.error("Error updating travel status to 'error':", updateError);
            }

            setMyIndividualTravels(prev => prev.map(t => t.id === travelId ? { ...t, status: 'error', errorDetails: message } : t));
            toast({ variant: 'destructive', title: 'Matching Failed', description: message });
        }

  }, [toast, allProperties, loadingProperties, user]); // Added user dependency


  // --- Function to Save Travel Plan ---
   const saveTravelPlan = useCallback(async (data: TravelFormValues, preferences: string[]): Promise<Travel | null> => {
      if (!user) {
          toast({ variant: 'destructive', title: 'Auth Error', description: 'You must be logged in.' });
          return null;
      }
       if (!data.departureCity?.trim()) {
           toast({ variant: 'destructive', title: 'Input Error', description: 'Departure city is required.' });
           return null;
      }
       if (!data.tripDateStart || !data.tripDateEnd) {
           toast({ variant: 'destructive', title: 'Input Error', description: 'Both start and end dates are required.' });
           return null;
       }
        if (preferences.length === 0) {
            toast({ variant: 'destructive', title: 'Input Error', description: 'Please set mood/activity preferences.' });
            return null;
       }

      console.log("Attempting to save travel plan with preferences:", preferences, "and data:", data);

      const tripDateStartTimestamp = Timestamp.fromDate(data.tripDateStart);
      const tripDateEndTimestamp = Timestamp.fromDate(data.tripDateEnd);

      const travelToAdd: Omit<Travel, 'id'> = {
          userId: data.tripType === 'individual' ? user.uid : null,
          groupId: data.tripType === 'group' ? data.groupId! : null,
          departureCity: data.departureCity.trim(),
          departureCityIata: null, // Set to null initially, flow will handle lookup
          preferences: preferences,
          tripDateStart: tripDateStartTimestamp,
          tripDateEnd: tripDateEndTimestamp,
          places: [],
          status: 'pending', // Initial status
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          matches: [],
          errorDetails: null,
      };

      console.log("Data being sent to Firestore:", travelToAdd);

      try {
          const docRef = await addDoc(collection(db, 'travels'), travelToAdd);
          console.log("Travel plan saved successfully with ID:", docRef.id);

           const newTravelData: Travel = {
              ...travelToAdd,
              id: docRef.id,
              createdAt: travelToAdd.createdAt,
              updatedAt: travelToAdd.updatedAt,
          };

           // Trigger matching process immediately after saving
           // No need to update local state here first, initiateMatchingProcess will handle it
           toast({
               title: "Travel Plan Saved",
               description: "Finding the best matches for your trip...",
           });

           await initiateMatchingProcess(newTravelData); // Await the matching process

           return newTravelData; // Return the saved data (might have updated status now)

      } catch (error) {
          console.error('Error adding travel plan:', error);
           const message = error instanceof Error ? error.message : 'An unknown error occurred.';
           toast({ variant: 'destructive', title: 'Save Failed', description: `Failed to save your travel plan: ${message}` });
           return null; // Return null on error
      }
  }, [user, toast, initiateMatchingProcess]);


  return {
    myIndividualTravels,
    myGroups,
    allProperties,
    loadingTravels,
    loadingGroups,
    loadingProperties,
    saveTravelPlan,
    fetchMyIndividualTravels, // Export for potential manual refresh
    // Removed initiateMatchingProcess from export as it's internal now
  };
}
