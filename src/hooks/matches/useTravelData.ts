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
import { getIataCodeForCity } from '@/lib/iataUtils'; // Use the utility function

export function useTravelData() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [myIndividualTravels, setMyIndividualTravels] = useState<Travel[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [loadingTravels, setLoadingTravels] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);
  // Removed matchingStatus state

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
        // No need to initialize matchingStatus anymore
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
            // Add nearestAirportIata to the type if needed, or handle potential missing field
            const querySnapshot = await getDocs(propertiesCollection);
            const propertiesList = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Ensure address exists and has coordinates/nearestAirportIata if needed
                    address: {
                        city: data.address?.city || '',
                        country: data.address?.country || '',
                        coordinates: data.address?.coordinates || { lat: null, lng: null },
                        nearestAirportIata: data.address?.nearestAirportIata || null, // Add nearestAirportIata
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

         // Ensure we have the latest travel data (optional, but good practice if updates happen frequently)
         // const currentTravelDoc = await getDoc(doc(db, 'travels', travelId));
         // const travelData = currentTravelDoc.exists() ? { id: currentTravelDoc.id, ...currentTravelDoc.data() } as Travel : savedTravel;
         const travelData = savedTravel; // Use the data passed in for now

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

        // --- Look up Departure IATA using the utility function ---
        const departureIata = await getIataCodeForCity(travelData.departureCity);
        if (!departureIata) {
             toast({ variant: 'destructive', title: 'IATA Not Found', description: `Could not find IATA code for departure city: ${travelData.departureCity}.` });
             await updateDoc(doc(db, 'travels', travelId), { status: 'error', errorDetails: `IATA not found for ${travelData.departureCity}` });
             return;
         }
          console.log(`Looked up IATA: ${departureIata} for city ${travelData.departureCity}`);

        // --- Prepare Candidate Destinations (from allProperties) ---
         const cityIataMap = new Map<string, string>();
         allProperties.forEach(prop => {
             // Ensure prop.address and prop.address.city exist before trying to access them
             if (prop.address?.city && prop.address?.nearestAirportIata) {
                 const cityLower = prop.address.city.toLowerCase();
                 if (!cityIataMap.has(cityLower)) {
                     cityIataMap.set(cityLower, prop.address.nearestAirportIata);
                 }
             } else {
                 // console.warn(`Property ${prop.id} missing city or nearestAirportIata.`);
             }
         });

         const candidateCities = Array.from(cityIataMap.keys());
         const candidateIatas = Array.from(cityIataMap.values());

         if (candidateCities.length === 0) {
            toast({ variant: 'destructive', title: 'No Destinations', description: 'No properties with cities/airports found.' });
            await updateDoc(doc(db, 'travels', travelId), { status: 'error', errorDetails: 'No candidate destinations found.' });
            return;
         }
         console.log(`Candidate destinations for matching (${candidateCities.length}):`, candidateCities);


        // Update status to 'matching' in Firestore
        const travelRef = doc(db, 'travels', travelId);
        try {
            await updateDoc(travelRef, {
                status: 'matching',
                departureCityIata: departureIata, // Save the looked-up IATA
                errorDetails: null,
                updatedAt: Timestamp.now(),
                matches: [], // Clear previous matches
            });
            // Update local state immediately
            setMyIndividualTravels(prev => prev.map(t => t.id === travelId ? { ...t, status: 'matching', departureCityIata: departureIata, matches: [], errorDetails: null } : t));
            toast({ title: 'Matching Started', description: 'Finding the best destinations...' });
        } catch (error) {
             console.error("Error updating travel status to 'matching':", error);
             toast({ variant: 'destructive', title: 'Error', description: 'Could not start matching.' });
             // Don't proceed if status update fails
             return;
        }

        // --- Call AI Flow ---
        try {
            const moodPrefs = travelData.preferences.filter(p => p.startsWith('mood:')).map(p => p.substring(5));
            const activityPrefs = travelData.preferences.filter(p => p.startsWith('activity:')).map(p => p.substring(9));
            const startDateStr = format(travelData.tripDateStart.toDate(), 'yyyy-MM-dd');
            const endDateStr = format(travelData.tripDateEnd.toDate(), 'yyyy-MM-dd');

            const matchingInput: FindDestinationMatchesInput = {
                moodPreferences: moodPrefs,
                activityPreferences: activityPrefs,
                departureCityIata: departureIata,
                departureCityName: travelData.departureCity,
                preferredStartDate: startDateStr,
                preferredEndDate: endDateStr,
                candidateDestinationCities: candidateCities,
                candidateDestinationIatas: candidateIatas,
            };

            console.log("Sending data to findDestinationMatches flow:", matchingInput);
            const result = await findDestinationMatches(matchingInput);
            console.log("Received matching results:", result);

            // Update Firestore with results
            await updateDoc(travelRef, {
                status: 'matched',
                matches: result.rankedDestinations, // Store the structured results
                updatedAt: Timestamp.now(),
            });

            // Update local state
            setMyIndividualTravels(prev => prev.map(t => t.id === travelId ? { ...t, status: 'matched', matches: result.rankedDestinations } : t));
            toast({ title: 'Matching Complete!', description: 'Potential destinations found.' });

            // --- TODO: Navigation Logic ---
            // Consider using router.push(`/my-travels/${travelId}/results`) or similar
            // This might be better handled in the component calling this hook after success
            console.log("Matching finished, results saved. Navigation needed.");


        } catch (error) {
            console.error("Error during destination matching flow:", error);
            const message = error instanceof Error ? error.message : "Unknown error during matching.";

            // Update Firestore status to 'error'
            try {
                await updateDoc(travelRef, { status: 'error', errorDetails: message, updatedAt: Timestamp.now() });
            } catch (updateError) {
                 console.error("Error updating travel status to 'error':", updateError);
            }

            // Update local state
            setMyIndividualTravels(prev => prev.map(t => t.id === travelId ? { ...t, status: 'error', errorDetails: message } : t));
            toast({ variant: 'destructive', title: 'Matching Failed', description: message });
        }

  }, [toast, allProperties, loadingProperties, user]); // Added user dependency


  // --- Function to Save Travel Plan (Modified) ---
   const saveTravelPlan = useCallback(async (data: TravelFormValues, preferences: string[]): Promise<Travel | null> => { // Return Travel or null on error
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
          departureCity: data.departureCity.trim(), // Trim whitespace
          departureCityIata: null, // Will be populated during matching
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

           // Update local state immediately
           if (newTravelData.userId) {
               setMyIndividualTravels(prev => [...prev, newTravelData]);
           } else if (newTravelData.groupId) {
                // Optionally, trigger a refetch of group travels if needed elsewhere
                // Or pass the new travel data back to the calling component
           }

           toast({
               title: "Travel Plan Saved",
               description: "Finding the best matches for your trip...",
           });

           // --- Initiate Matching Process Immediately After Saving ---
           initiateMatchingProcess(newTravelData); // Pass the newly created travel data

           return newTravelData;

      } catch (error) {
          console.error('Error adding travel plan:', error);
           const message = error instanceof Error ? error.message : 'An unknown error occurred.';
           toast({ variant: 'destructive', title: 'Save Failed', description: `Failed to save your travel plan: ${message}` });
           return null; // Indicate failure
      }
  }, [user, toast, initiateMatchingProcess]); // Added initiateMatchingProcess


  return {
    myIndividualTravels,
    myGroups,
    allProperties,
    loadingTravels,
    loadingGroups,
    loadingProperties,
    saveTravelPlan,
    // Removed triggerDestinationMatching and matchingStatus from return
    fetchMyIndividualTravels,
    fetchMyGroups,
  };
}
