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
import { findDestinationMatches, type FindDestinationMatchesInput } from '@/ai/flows/find-destination-matches-flow';

export function useTravelData() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [myIndividualTravels, setMyIndividualTravels] = useState<Travel[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [loadingTravels, setLoadingTravels] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [matchingStatus, setMatchingStatus] = useState<{ [travelId: string]: 'idle' | 'matching' | 'matched' | 'error' }>({}); // Track matching status per travel plan


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
         // Initialize matching status for fetched travels
         const initialStatus: typeof matchingStatus = {};
         travelsList.forEach(t => {
             if (t.id) {
                 initialStatus[t.id] = t.status === 'matching' ? 'matching' : t.status === 'matched' ? 'matched' : t.status === 'error' ? 'error' : 'idle';
             }
         });
         setMatchingStatus(prev => ({ ...prev, ...initialStatus }));

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


  // --- Function to Trigger Destination Matching ---
    const triggerDestinationMatching = useCallback(async (travelData: Travel) => {
        console.log("Attempting to trigger matching for travel:", travelData.id);
        const travelId = travelData.id;

        if (!travelId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Travel ID is missing.' });
            return;
        }

        // Check if already matching
         if (matchingStatus[travelId] === 'matching') {
            toast({ title: 'Info', description: 'Matching is already in progress for this trip.' });
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

        // Extract candidate IATAs from properties
        const candidateIatas = [...new Set(
            allProperties
                .map(p => p.address.nearestAirportIata)
                .filter((iata): iata is string => !!iata && iata.length === 3)
        )];

         if (candidateIatas.length === 0) {
            toast({ variant: 'destructive', title: 'No Destinations', description: 'No properties with associated airport codes found.' });
            return;
         }
         console.log("Candidate destination IATAs for matching:", candidateIatas);


        // Update status locally and in Firestore
        setMatchingStatus(prev => ({ ...prev, [travelId]: 'matching' }));
        const travelRef = doc(db, 'travels', travelId);
        try {
            await updateDoc(travelRef, { status: 'matching', errorDetails: null, updatedAt: Timestamp.now() });
            toast({ title: 'Matching Started', description: 'Finding the best destinations for your trip...' });
        } catch (error) {
             console.error("Error updating travel status to 'matching':", error);
             toast({ variant: 'destructive', title: 'Error', description: 'Could not start the matching process.' });
             setMatchingStatus(prev => ({ ...prev, [travelId]: 'error' })); // Reset local status on Firestore error
             return;
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
                candidateDestinationIatas: candidateIatas,
            };

            console.log("Sending data to findDestinationMatches flow:", matchingInput);
            const result = await findDestinationMatches(matchingInput);
            console.log("Received matching results:", result);

            // Update Firestore with results
            await updateDoc(travelRef, {
                status: 'matched',
                matches: result.rankedDestinations,
                updatedAt: Timestamp.now(),
            });

            // Update local state (travel list and status)
            setMyIndividualTravels(prev => prev.map(t => t.id === travelId ? { ...t, status: 'matched', matches: result.rankedDestinations } : t));
            setMatchingStatus(prev => ({ ...prev, [travelId]: 'matched' }));
            toast({ title: 'Matching Complete!', description: 'Potential destinations found.' });

        } catch (error) {
            console.error("Error during destination matching flow:", error);
            const message = error instanceof Error ? error.message : "An unknown error occurred during matching.";

            // Update Firestore status to 'error'
            try {
                await updateDoc(travelRef, { status: 'error', errorDetails: message, updatedAt: Timestamp.now() });
            } catch (updateError) {
                 console.error("Error updating travel status to 'error':", updateError);
            }

            // Update local state
            setMyIndividualTravels(prev => prev.map(t => t.id === travelId ? { ...t, status: 'error', errorDetails: message } : t));
            setMatchingStatus(prev => ({ ...prev, [travelId]: 'error' }));
            toast({ variant: 'destructive', title: 'Matching Failed', description: message });
        }

    }, [toast, allProperties, matchingStatus]); // Include matchingStatus in dependencies


  // --- Function to Save Travel Plan ---
   const saveTravelPlan = useCallback(async (data: TravelFormValues, preferences: string[]): Promise<Travel> => {
      if (!user) {
          throw new Error('You must be logged in to add a travel plan.');
      }
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

        // Attempt to find IATA for the departure city from properties
        const departureProperty = allProperties.find(p => p.address.city.toLowerCase() === data.departureCity.toLowerCase());
        const departureIata = departureProperty?.address.nearestAirportIata || null;
        console.log(`Departure City: ${data.departureCity}, Found IATA: ${departureIata}`);


      const travelToAdd: Omit<Travel, 'id'> = {
          userId: data.tripType === 'individual' ? user.uid : null,
          groupId: data.tripType === 'group' ? data.groupId! : null,
          departureCity: data.departureCity,
          departureCityIata: departureIata, // Use found IATA or null
          preferences: preferences,
          tripDateStart: tripDateStartTimestamp,
          tripDateEnd: tripDateEndTimestamp,
          places: [],
          status: 'pending',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          matches: [],
          errorDetails: null, // Initialize errorDetails as null
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

           // Update local state immediately only for individual travels
           if (newTravelData.userId) {
               setMyIndividualTravels(prev => [...prev, newTravelData]);
               if (newTravelData.id) {
                 setMatchingStatus(prev => ({ ...prev, [newTravelData.id!]: 'idle' })); // Initialize matching status
               }
           }

          return newTravelData;
      } catch (error) {
          console.error('Error adding travel plan:', error);
           const message = error instanceof Error ? error.message : 'An unknown error occurred.';
          throw new Error(`Failed to save your travel plan: ${message}`);
      }
  }, [user, allProperties]); // Added allProperties


  return {
    myIndividualTravels,
    myGroups,
    loadingTravels,
    loadingGroups,
    loadingProperties,
    saveTravelPlan,
    triggerDestinationMatching,
    fetchMyIndividualTravels,
    fetchMyGroups,
    matchingStatus, // Expose matching status
  };
}
