// src/hooks/matches/useTravelData.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, Timestamp, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { type Travel, type Group } from '@/types';
import { type TravelFormValues } from './useTravelForm'; // Import form values type

export function useTravelData() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [myIndividualTravels, setMyIndividualTravels] = useState<Travel[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [loadingTravels, setLoadingTravels] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);

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
          where('groupId', '==', null)
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

  // --- Initial Data Fetch ---
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      fetchMyIndividualTravels();
      fetchMyGroups();
    }
  }, [user, isAuthenticated, authLoading, fetchMyIndividualTravels, fetchMyGroups]);

  // --- Function to Trigger Destination Matching (Placeholder/Disabled) ---
  const triggerDestinationMatching = useCallback(async (travelData: Travel) => {
    toast({ variant: 'destructive', title: 'Matching Disabled', description: 'Destination matching is temporarily disabled.' });
    // In the future, this would:
    // 1. Check if travelData has necessary info (departureCityIata, preferences, dates/duration)
    // 2. Get candidate destination IATAs (from properties collection or a predefined list)
    // 3. Call the findDestinationMatches flow
    // 4. Update the travel document in Firestore with the results/status
    console.log("Triggering matching for travel (disabled):", travelData.id);
    return;
  }, [toast]);

  // --- Function to Save Travel Plan ---
   const saveTravelPlan = useCallback(async (data: TravelFormValues, preferences: string[]): Promise<Travel> => {
      if (!user) {
          throw new Error('You must be logged in to add a travel plan.');
      }
      if (preferences.length === 0 && data.planningMode === 'guided') { // Check preferences only for guided mode initially
          throw new Error('Please set mood/activity preferences.');
      }

      console.log("Attempting to save travel plan with preferences:", preferences, "and data:", data);

      // Convert JS Date objects to Firestore Timestamps if they exist
      const tripDateStartTimestamp = data.tripDateStart ? Timestamp.fromDate(data.tripDateStart) : null;
      const tripDateEndTimestamp = data.tripDateEnd ? Timestamp.fromDate(data.tripDateEnd) : null;


      const travelToAdd: Omit<Travel, 'id'> = {
          userId: data.tripType === 'individual' ? user.uid : null,
          groupId: data.tripType === 'group' ? data.groupId! : null,
          departureCity: data.departureCity,
          departureCityIata: data.departureCityIata || null, // Add IATA if available
          preferences: preferences, // Use the explicitly passed preferences
          tripDateStart: tripDateStartTimestamp, // Use Timestamp or null
          tripDateEnd: tripDateEndTimestamp, // Use Timestamp or null
          places: [], // Initialize places as empty array
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
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
    saveTravelPlan,
    triggerDestinationMatching,
    fetchMyIndividualTravels, // Expose fetch function if needed for manual refresh
    fetchMyGroups,
  };
}
```