// src/hooks/matches/useTravelData.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, Timestamp, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { type Travel, type Group, type Property } from '@/types'; // Added Property
import { type TravelFormValues } from './useTravelForm'; // Import form values type
import { format } from 'date-fns'; // For date formatting
import { findDestinationMatches, type FindDestinationMatchesInput } from '@/ai/flows/find-destination-matches-flow'; // Import the matching flow

export function useTravelData() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [myIndividualTravels, setMyIndividualTravels] = useState<Travel[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]); // State for all properties
  const [loadingTravels, setLoadingTravels] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false); // Loading state for properties

  // --- Fetch Individual Travels ---
  const fetchMyIndividualTravels = useCallback(async () => {
    if (user?.uid) {
      setLoadingTravels(true);
      try {
        const travelsCollection = collection(db, 'travels');
        // Query for travels where userId matches and groupId is explicitly null
        const q = query(
          travelsCollection,
          where('userId', '==', user.uid),
          where('groupId', '==', null),
          where('status', '!=', 'archived') // Example: Exclude archived travels
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
           // Include all necessary fields from the Group type
           createBy: doc.data().createBy,
           createAt: doc.data().createAt,
           users: doc.data().users,
        })) as Group[];
        setMyGroups(groupsList);
      } catch (error) {
        console.error('Error fetching groups for selection:', error);
        // Optionally show a toast here as well
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
            const propertiesList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as Property[];
            setAllProperties(propertiesList);
            console.log("Fetched all properties:", propertiesList.length);
        } catch (error) {
            console.error('Error fetching all properties:', error);
            toast({
                variant: 'destructive',
                title: 'Error Loading Properties',
                description: 'Could not load available properties for matching.',
            });
            setAllProperties([]); // Reset on error
        } finally {
            setLoadingProperties(false);
        }
    }, [toast]);

  // --- Initial Data Fetch ---
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      fetchMyIndividualTravels();
      fetchMyGroups();
      fetchAllProperties(); // Fetch properties needed for matching
    }
     // Cleanup function or dependencies adjustment might be needed
     // if this effect should re-run under certain conditions.
  }, [user, isAuthenticated, authLoading, fetchMyIndividualTravels, fetchMyGroups, fetchAllProperties]); // Added fetchAllProperties


  // --- Function to Trigger Destination Matching ---
    const triggerDestinationMatching = useCallback(async (travelData: Travel) => {
        console.log("Attempting to trigger matching for travel:", travelData.id);
        if (!travelData.id) {
            toast({ variant: 'destructive', title: 'Error', description: 'Travel ID is missing.' });
            return;
        }
        if (!travelData.departureCityIata) {
            toast({ variant: 'destructive', title: 'Missing Info', description: 'Departure city IATA code is required for matching.' });
            return;
        }
         if (!travelData.tripDateStart || !travelData.tripDateEnd) {
            toast({ variant: 'destructive', title: 'Missing Info', description: 'Trip start and end dates are required for matching.' });
            return;
        }
        if (allProperties.length === 0) {
             toast({ variant: 'destructive', title: 'Data Missing', description: 'No properties available to match against. Please try again later.' });
             return;
        }

        // Extract candidate IATAs from properties (ensure uniqueness and validity)
         const candidateIatas = [
            ...new Set(
                allProperties
                .map(p => p.address.nearestAirportIata) // Assuming you add 'nearestAirportIata' to Property type/data
                .filter((iata): iata is string => !!iata && iata.length === 3) // Filter out null/undefined and ensure length 3
            )
        ];

         if (candidateIatas.length === 0) {
            toast({ variant: 'destructive', title: 'No Destinations', description: 'No properties with associated airport codes found.' });
            return;
         }

         console.log("Candidate destination IATAs for matching:", candidateIatas);


        // Update travel status to 'matching' in Firestore
        const travelRef = doc(db, 'travels', travelData.id);
        try {
            await updateDoc(travelRef, { status: 'matching', updatedAt: Timestamp.now() });
            // Update local state as well (optional, depends on UI needs)
            setMyIndividualTravels(prev => prev.map(t => t.id === travelData.id ? { ...t, status: 'matching' } : t));
            toast({ title: 'Matching Started', description: 'Finding the best destinations for your trip...' });
        } catch (error) {
             console.error("Error updating travel status to 'matching':", error);
             toast({ variant: 'destructive', title: 'Error', description: 'Could not start the matching process.' });
             return; // Stop if status update fails
        }


        try {
            // Prepare input for the AI flow
            const moodPrefs = travelData.preferences.filter(p => p.startsWith('mood:')).map(p => p.substring(5));
            const activityPrefs = travelData.preferences.filter(p => p.startsWith('activity:')).map(p => p.substring(9));
             const startDateStr = format(travelData.tripDateStart.toDate(), 'yyyy-MM-dd');
             const endDateStr = format(travelData.tripDateEnd.toDate(), 'yyyy-MM-dd');

            const matchingInput: FindDestinationMatchesInput = {
                moodPreferences: moodPrefs,
                activityPreferences: activityPrefs,
                departureCityIata: travelData.departureCityIata,
                preferredStartDate: startDateStr,
                preferredEndDate: endDateStr,
                candidateDestinationIatas: candidateIatas, // Pass the list of available property locations
                // durationDays is currently omitted as we have specific dates
            };

            console.log("Sending data to findDestinationMatches flow:", matchingInput);

            // Call the Genkit flow
            const result = await findDestinationMatches(matchingInput);

            console.log("Received matching results:", result);

            // Update travel status and results in Firestore
            await updateDoc(travelRef, {
                status: 'matched',
                matches: result.rankedDestinations, // Store the ranked results
                updatedAt: Timestamp.now(),
            });

            // Update local state
             setMyIndividualTravels(prev => prev.map(t => t.id === travelData.id ? { ...t, status: 'matched', matches: result.rankedDestinations } : t));

            toast({ title: 'Matching Complete!', description: 'Potential destinations found.' });

        } catch (error) {
            console.error("Error during destination matching flow:", error);
             const message = error instanceof Error ? error.message : "An unknown error occurred during matching.";
             // Update travel status to 'error' in Firestore
              try {
                await updateDoc(travelRef, { status: 'error', errorDetails: message, updatedAt: Timestamp.now() });
                 setMyIndividualTravels(prev => prev.map(t => t.id === travelData.id ? { ...t, status: 'error', errorDetails: message } : t));
              } catch (updateError) {
                 console.error("Error updating travel status to 'error':", updateError);
              }

            toast({ variant: 'destructive', title: 'Matching Failed', description: message });
        }

    }, [toast, allProperties]); // Dependencies


  // --- Function to Save Travel Plan ---
   const saveTravelPlan = useCallback(async (data: TravelFormValues, preferences: string[]): Promise<Travel> => {
      if (!user) {
          throw new Error('You must be logged in to add a travel plan.');
      }
       // Validate required fields explicitly before constructing the object
       if (!data.departureCity) {
           throw new Error("Departure city is required.");
       }
       if (!data.tripDateStart || !data.tripDateEnd) {
            throw new Error("Both start and end dates are required.");
       }
       if (preferences.length === 0) {
            throw new Error('Please set mood/activity preferences.');
       }


      console.log("Attempting to save travel plan with preferences:", preferences, "and data:", data);

      // Convert JS Date objects to Firestore Timestamps
      const tripDateStartTimestamp = Timestamp.fromDate(data.tripDateStart);
      const tripDateEndTimestamp = Timestamp.fromDate(data.tripDateEnd);


      const travelToAdd: Omit<Travel, 'id'> = {
          userId: data.tripType === 'individual' ? user.uid : null,
          groupId: data.tripType === 'group' ? data.groupId! : null,
          departureCity: data.departureCity,
          departureCityIata: data.departureCityIata || null, // Use IATA code or null
          preferences: preferences, // Use the explicitly passed preferences
          tripDateStart: tripDateStartTimestamp, // Use Timestamp
          tripDateEnd: tripDateEndTimestamp, // Use Timestamp
          places: [], // Initialize places as empty array
          status: 'pending', // Initial status
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          matches: [], // Initialize matches array
      };

      console.log("Data being sent to Firestore:", travelToAdd);

      try {
          const docRef = await addDoc(collection(db, 'travels'), travelToAdd);
          console.log("Travel plan saved successfully with ID:", docRef.id);

           const newTravelData: Travel = {
              ...travelToAdd,
              id: docRef.id,
              createdAt: travelToAdd.createdAt, // Ensure timestamps are correctly passed
              updatedAt: travelToAdd.updatedAt,
          };

           // Update local state immediately only for individual travels
           if (newTravelData.userId) {
               setMyIndividualTravels(prev => [...prev, newTravelData]);
           }


          return newTravelData; // Return the saved travel data with ID
      } catch (error) {
          console.error('Error adding travel plan:', error);
           const message = error instanceof Error ? error.message : 'An unknown error occurred.';
          throw new Error(`Failed to save your travel plan: ${message}`);
      }
  }, [user]); // Dependencies for the save function


  return {
    myIndividualTravels,
    myGroups,
    loadingTravels,
    loadingGroups,
    loadingProperties, // Expose loading state for properties
    saveTravelPlan,
    triggerDestinationMatching,
    fetchMyIndividualTravels, // Expose fetch function if needed for manual refresh
    fetchMyGroups,
    // fetchAllProperties is implicitly called, but can be exposed if needed
  };
}
