// src/app/matches/page.tsx - Refactored for "My Travels / Plan Trip"
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, SubmitHandler, Controller, ControllerRenderProps, useWatch } from 'react-hook-form'; // Added useWatch
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, getDocs, addDoc, Timestamp, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore'; // Added updateDoc, setDoc
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, PlusCircle, PlaneTakeoff, Calendar, MapPin, Heart, User, List, SlidersHorizontal, Wand2, Smile, Mountain, Film, Users as UsersIcon, Utensils, Info, CalendarDays, Leaf, UserPlus, Group, Bot, Send, LocateFixed, Search, BarChart, Euro, Thermometer, Clock, XCircle, Timer } from 'lucide-react'; // Added Timer icon
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar as ShadCalendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { planTravelAssistant, type PlanTravelAssistantInput, type PlanTravelAssistantOutput } from '@/ai/flows/plan-travel-assistant-flow';
import { findDestinationMatches, type FindDestinationMatchesInput, type FindDestinationMatchesOutput, type EnrichedDestination } from '@/ai/flows/find-destination-matches-flow'; // Import destination matching flow
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { type Travel, type Group, type Place } from '@/types'; // Import shared types
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Added Tooltip

// --- Emotional Planning Constants ---
const MOOD_OPTIONS = [
    { value: "relaxed", label: "Relaxed", icon: <Smile className="h-4 w-4" /> },
    { value: "adventurous", label: "Adventurous", icon: <Mountain className="h-4 w-4" /> },
    { value: "cultural", label: "Cultural", icon: <Film className="h-4 w-4" /> },
    { value: "social", label: "Social", icon: <UsersIcon className="h-4 w-4" /> },
    { value: "nature", label: "Nature", icon: <Leaf className="h-4 w-4" /> },
];
const ACTIVITY_OPTIONS = [
    { value: "hiking", label: "Hiking", icon: <Mountain className="h-4 w-4" /> },
    { value: "museums", label: "Museums", icon: <Film className="h-4 w-4" /> },
    { value: "beach", label: "Beach", icon: <PlaneTakeoff className="h-4 w-4" /> }, // Replace with better icon if available
    { value: "nightlife", label: "Nightlife", icon: <UsersIcon className="h-4 w-4" /> },
    { value: "foodie", label: "Foodie", icon: <Utensils className="h-4 w-4" /> },
    { value: "other", label: "Other...", icon: <Info className="h-4 w-4" /> },
];
const MAX_DURATION_DAYS = 90; // Increased max duration

// Example candidate destinations (replace with dynamic logic later if needed)
const CANDIDATE_DESTINATIONS_EUROPE = ["BCN", "LIS", "DBV", "RAK", "VLC", "ATH", "NAP", "FCO", "PMI", "AGP"];


// Define Zod schema for the new travel form validation
const travelFormSchema = z.object({
  tripType: z.enum(['individual', 'group'], { required_error: "Please select a trip type."}),
  groupId: z.string().optional(), // Required if tripType is 'group'
  departureCity: z.string().min(2, "Departure city is required."),
  departureCityIata: z.string().min(3).max(3).optional().describe("IATA code needed for matching."), // Hidden field, potentially derived
  // Mode 1: Guided Sliders
  mood: z.string().optional(),
  activity: z.string().optional(),
  activityOther: z.string().optional(),
  // Mode 2: AI
  aiPrompt: z.string().optional(),
  planningMode: z.enum(['guided', 'ai']).default('guided'),
  // Date/Duration Selection
  dateInputMode: z.enum(['dates', 'duration']).default('dates'),
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
  durationDays: z.coerce.number().int().min(1, "Duration must be at least 1 day.").max(MAX_DURATION_DAYS).optional().nullable(),
}).refine(data => {
    if (data.tripType === 'group') return !!data.groupId;
    return true;
}, { message: "Please select a group for a group trip.", path: ["groupId"]})
.refine(data => {
    if (data.activity === 'other') return !!data.activityOther && data.activityOther.trim().length > 0;
    return true;
}, { message: "Please specify the 'other' activity.", path: ["activityOther"]})
.refine(data => {
    // Require dates OR duration based on mode
    if (data.dateInputMode === 'dates') return !!data.startDate && !!data.endDate;
    if (data.dateInputMode === 'duration') return !!data.durationDays;
    return false; // Should not happen if mode is set
}, {
    message: "Please select both start/end dates or specify a duration.",
    // Apply error to a common path or a specific one based on mode
    path: ["startDate"], // Apply error to startDate for date mode failure
})
.refine(data => {
    // Ensure duration is set if mode is duration
    if (data.dateInputMode === 'duration' && !data.durationDays) return false;
    return true;
}, {
    message: "Please specify the trip duration in days.",
    path: ["durationDays"],
});


type TravelFormValues = z.infer<typeof travelFormSchema>;

// --- Chat Interface ---
interface ChatMessage {
  sender: 'user' | 'ai';
  message: string;
  timestamp: number;
}

export default function MyTravelsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [myIndividualTravels, setMyIndividualTravels] = useState<Travel[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [loadingTravels, setLoadingTravels] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingMatchId, setProcessingMatchId] = useState<string | null>(null); // Track which travel ID is being matched

  // State for Mode 1 (Sliders)
  const [moodSliderValue, setMoodSliderValue] = useState(0);
  const [activitySliderValue, setActivitySliderValue] = useState(0);
  // Duration slider is removed, using input field instead

  // State for Mode 2 (AI Chat)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentUserInput, setCurrentUserInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);

  const form = useForm<TravelFormValues>({
    resolver: zodResolver(travelFormSchema),
    defaultValues: {
      tripType: 'individual',
      groupId: undefined,
      departureCity: '',
      departureCityIata: '', // Initialize hidden field
      mood: MOOD_OPTIONS[0].value,
      activity: ACTIVITY_OPTIONS[0].value,
      activityOther: '',
      startDate: null,
      endDate: null,
      durationDays: 5, // Default duration if mode is switched
      aiPrompt: '',
      planningMode: 'guided',
      dateInputMode: 'dates', // Default to date selection
    },
    mode: 'onChange', // Validate on change for better feedback
  });

   // Watch the date input mode to conditionally render/disable fields
   const dateInputMode = useWatch({ control: form.control, name: 'dateInputMode' });

  // --- Effect for Authentication Check ---
   useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);


  // --- Fetch Individual Travels ---
   const fetchMyIndividualTravels = useCallback(async () => {
      if (user?.uid) {
        setLoadingTravels(true);
        try {
          const travelsCollection = collection(db, 'travels');
          // Query for individual travels (userId matches, groupId is null)
          const q = query(travelsCollection, where('userId', '==', user.uid), where('groupId', '==', null));
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
                  groupName: doc.data().groupName || `Group ${doc.id.substring(0,5)}`,
                  // Add other necessary group fields if needed
              })) as Group[]; // Ensure Group type includes needed fields
              setMyGroups(groupsList);
          } catch (error) {
              console.error('Error fetching groups for selection:', error);
          } finally {
              setLoadingGroups(false);
          }
      }
  }, [user]);

  // --- Initial Data Fetch ---
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      fetchMyIndividualTravels();
      fetchMyGroups();
    }
  }, [user, isAuthenticated, authLoading, fetchMyIndividualTravels, fetchMyGroups]);


  // --- Function to Trigger Destination Matching ---
  const triggerDestinationMatching = useCallback(async (travelData: Travel) => {
    // Matching now strictly requires dateRange
    if (!travelData.id || !travelData.dateRange?.start || !travelData.dateRange?.end || !travelData.departureCity) {
      toast({ variant: 'destructive', title: 'Matching Error', description: 'Specific dates and departure city are required to find matches.' });
      return;
    }

    // *** Placeholder: Derive IATA from departureCity ***
    const departureIata = travelData.departureCity.substring(0,3).toUpperCase(); // VERY Basic placeholder
     if (departureIata.length !== 3) {
          toast({ variant: 'destructive', title: 'Matching Error', description: 'Could not determine IATA code for departure city.' });
          return;
     }
    console.log(`Derived IATA for ${travelData.departureCity}: ${departureIata}`);
    // *** End Placeholder ***


    setProcessingMatchId(travelData.id); // Set loading state for this specific travel item

    // Update Firestore status to 'processing'
    const travelRef = doc(db, 'travels', travelData.id);
    try {
      await updateDoc(travelRef, {
        destinationMatchesStatus: 'processing',
        lastMatchedAt: Timestamp.now(),
      });
      // Optionally update local state immediately for better UX
       setMyIndividualTravels(prev => prev.map(t => t.id === travelData.id ? { ...t, destinationMatchesStatus: 'processing', lastMatchedAt: Timestamp.now() } : t));
    } catch (error) {
       console.error("Error updating travel status to processing:", error);
       toast({ variant: 'destructive', title: 'Matching Error', description: 'Failed to start the matching process.' });
       setProcessingMatchId(null);
       return;
    }


    try {
      const moodPrefs = travelData.preferences.filter(p => p.startsWith('mood:')).map(p => p.substring(5));
      const activityPrefs = travelData.preferences.filter(p => p.startsWith('activity:')).map(p => p.substring(9)); // Adjusted index

      const matchInput: FindDestinationMatchesInput = {
        // durationDays is not used for matching when dates are present
        moodPreferences: moodPrefs,
        activityPreferences: activityPrefs,
        departureCityIata: departureIata, // Use derived IATA
        preferredStartDate: format(travelData.dateRange.start.toDate(), 'yyyy-MM-dd'),
        preferredEndDate: format(travelData.dateRange.end.toDate(), 'yyyy-MM-dd'),
        candidateDestinationIatas: CANDIDATE_DESTINATIONS_EUROPE, // Use predefined candidates
      };

      console.log("Calling findDestinationMatches with input:", matchInput);
      const matchOutput: FindDestinationMatchesOutput = await findDestinationMatches(matchInput);
      console.log("Received findDestinationMatches output:", matchOutput);

      // Update Firestore with results and status 'completed'
      await updateDoc(travelRef, {
        destinationMatches: matchOutput.rankedDestinations,
        destinationMatchesStatus: 'completed',
        lastMatchedAt: Timestamp.now(),
        destinationMatchesError: null, // Clear previous error
      });
       // Update local state
       setMyIndividualTravels(prev => prev.map(t => t.id === travelData.id ? { ...t, destinationMatches: matchOutput.rankedDestinations, destinationMatchesStatus: 'completed', destinationMatchesError: undefined, lastMatchedAt: Timestamp.now() } : t));

      toast({ title: 'Matching Complete!', description: `Found potential destinations for trip #${travelData.id?.substring(0, 6)}.` });

    } catch (error: any) {
      console.error(`Error during destination matching for travel ${travelData.id}:`, error);
      const errorMessage = error.message || "An unknown error occurred during matching.";
       // Update Firestore with status 'error'
        try {
             await updateDoc(travelRef, {
                destinationMatchesStatus: 'error',
                destinationMatchesError: errorMessage,
                lastMatchedAt: Timestamp.now(),
             });
              // Update local state
             setMyIndividualTravels(prev => prev.map(t => t.id === travelData.id ? { ...t, destinationMatchesStatus: 'error', destinationMatchesError: errorMessage, lastMatchedAt: Timestamp.now() } : t));
        } catch (updateError) {
             console.error("Failed to update travel status to error:", updateError);
        }
      toast({ variant: 'destructive', title: 'Matching Failed', description: errorMessage });
    } finally {
      setProcessingMatchId(null); // Clear loading state for this item
    }
  }, [toast]); // Include dependencies


  // --- Form Submission ---
  const onSubmit: SubmitHandler<TravelFormValues> = async (data) => {
     if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to add a travel plan.' });
        return;
    }
    // Validation based on dateInputMode
    if (data.dateInputMode === 'dates' && (!data.startDate || !data.endDate)) {
         toast({ variant: 'destructive', title: 'Missing Dates', description: 'Please select both a start and end date.' });
         return;
    }
     if (data.dateInputMode === 'duration' && !data.durationDays) {
         toast({ variant: 'destructive', title: 'Missing Duration', description: 'Please specify the trip duration in days.' });
         return;
    }

    setIsSubmitting(true);
    console.log("Submitting Travel Form Data:", data); // Log form data

    const preferences: string[] = [];
    if (data.mood) preferences.push(`mood:${data.mood}`);
    if (data.activity === 'other' && data.activityOther) {
        preferences.push(`activity:other:${data.activityOther.trim()}`);
    } else if (data.activity && data.activity !== 'other') {
        preferences.push(`activity:${data.activity}`);
    }

    let newTravelDocId: string | null = null; // To store the ID of the newly created doc

    try {
       // Prepare dateRange or durationDays based on mode
       let dateRangeValue: { start: Timestamp; end: Timestamp } | null = null;
       let durationValue: number | undefined = undefined;

       if (data.dateInputMode === 'dates' && data.startDate && data.endDate) {
           dateRangeValue = {
               start: Timestamp.fromDate(data.startDate),
               end: Timestamp.fromDate(data.endDate),
           };
       } else if (data.dateInputMode === 'duration' && data.durationDays) {
           durationValue = data.durationDays;
       }

       const travelToAdd: Omit<Travel, 'id'> = {
        userId: data.tripType === 'individual' ? user.uid : null,
        groupId: data.tripType === 'group' ? data.groupId! : null,
        departureCity: data.departureCity, // Save departure city
        preferences: preferences,
        dateRange: dateRangeValue, // Use Timestamp or null
        durationDays: durationValue, // Use number or undefined
        places: [], // Initialize places as empty array
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(), // Set updatedAt on creation
        // Set matching status only if dates are provided
        destinationMatchesStatus: dateRangeValue ? 'pending' : undefined,
      };

      console.log("Data being sent to Firestore:", travelToAdd); // Log data before sending

      const docRef = await addDoc(collection(db, 'travels'), travelToAdd);
      newTravelDocId = docRef.id; // Store the new ID

      toast({
        title: 'Travel Plan Added!',
        description: `Your new ${data.tripType} travel plan has been saved. ${data.tripType === 'individual' && dateRangeValue ? 'Finding matches...' : ''}`,
      });

      const newTravelData: Travel = {
          ...travelToAdd,
          id: newTravelDocId,
          // Ensure these are correctly typed based on what was added
          dateRange: travelToAdd.dateRange || undefined,
          durationDays: travelToAdd.durationDays || undefined,
          createdAt: travelToAdd.createdAt,
          updatedAt: travelToAdd.updatedAt,
          destinationMatchesStatus: travelToAdd.destinationMatchesStatus,
      };

       if (data.tripType === 'individual') {
            setMyIndividualTravels(prev => [...prev, newTravelData]);
             // Trigger matching only if dates were provided
            if (dateRangeValue) {
                triggerDestinationMatching(newTravelData);
            }
       } else {
           // For group trips, redirect to the groups page
           toast({ title: 'Group Trip Added', description: 'The new trip plan is now associated with the group.' });
           router.push('/groups');
       }


      // Reset form to default values
      form.reset({
          tripType: 'individual',
          groupId: undefined,
          departureCity: '',
          departureCityIata: '',
          mood: MOOD_OPTIONS[0].value,
          activity: ACTIVITY_OPTIONS[0].value,
          activityOther: '',
          startDate: null,
          endDate: null,
          durationDays: 5, // Reset durationDays
          aiPrompt: '',
          planningMode: 'guided',
          dateInputMode: 'dates', // Reset date mode
      });
      setMoodSliderValue(0);
      setActivitySliderValue(0);
      setChatHistory([]);
      setCurrentUserInput('');
      setIsAddDialogOpen(false);

    } catch (error) {
      console.error('Error adding travel plan:', error);
      toast({
        variant: 'destructive',
        title: 'Error Adding Travel',
        description: `Failed to save your travel plan. ${error instanceof Error ? error.message : 'Please try again.'}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

   // --- Handlers for slider changes ---
    const handleMoodSliderChange = (value: number[]) => {
        const index = value[0];
        setMoodSliderValue(index);
        form.setValue('mood', MOOD_OPTIONS[index]?.value, { shouldValidate: true });
    };

    const handleActivitySliderChange = (value: number[]) => {
        const index = value[0];
        setActivitySliderValue(index);
        form.setValue('activity', ACTIVITY_OPTIONS[index]?.value, { shouldValidate: true });
        if (ACTIVITY_OPTIONS[index]?.value !== 'other') {
            form.setValue('activityOther', '', { shouldValidate: true });
        }
    };

    // --- Handler for DatePicker within FormField ---
    const handleDateChange = (date: Date | undefined, field: ControllerRenderProps<TravelFormValues, 'startDate' | 'endDate'>) => {
        field.onChange(date); // Update RHF state
        form.trigger(['startDate', 'endDate']); // Trigger validation
    }

     // --- Handler for Date Input Mode change ---
     const handleDateInputModeChange = (value: 'dates' | 'duration') => {
         form.setValue('dateInputMode', value);
         // Clear the other mode's values when switching
         if (value === 'dates') {
             form.setValue('durationDays', null, { shouldValidate: true });
         } else {
             form.setValue('startDate', null, { shouldValidate: true });
             form.setValue('endDate', null, { shouldValidate: true });
         }
         form.trigger(); // Re-validate the form
     };


     // --- AI Chat Handlers ---
    const handleAiInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCurrentUserInput(event.target.value);
    };

    const handleAiSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        if (!currentUserInput.trim() || isAiLoading) return;

        const userMessage: ChatMessage = {
            sender: 'user',
            message: currentUserInput.trim(),
            timestamp: Date.now(),
        };
        setChatHistory(prev => [...prev, userMessage]);
        setCurrentUserInput('');
        setIsAiLoading(true);

        try {
            const aiInput: PlanTravelAssistantInput = {
                currentChat: chatHistory.map(m => ({ role: m.sender === 'user' ? 'user' : 'ai', text: m.message })),
                userPrompt: userMessage.message,
            };
            const aiOutput: PlanTravelAssistantOutput = await planTravelAssistant(aiInput);

            const aiMessage: ChatMessage = {
                sender: 'ai',
                message: aiOutput.response,
                timestamp: Date.now(),
            };
            setChatHistory(prev => [...prev, aiMessage]);

            // --- Update Form Values based on AI Output ---
            console.log("AI Extracted Data:", aiOutput.extractedData);
            if (aiOutput.extractedData) {
                 const { mood, activity, activityOther, durationDays, startDate, endDate } = aiOutput.extractedData;

                if (mood) {
                    const moodOption = MOOD_OPTIONS.find(opt => opt.value === mood);
                    if (moodOption) {
                         form.setValue('mood', moodOption.value, { shouldValidate: true });
                         const index = MOOD_OPTIONS.findIndex(opt => opt.value === moodOption.value);
                         setMoodSliderValue(index >= 0 ? index : 0);
                    }
                }
                if (activity) {
                    const activityOption = ACTIVITY_OPTIONS.find(opt => opt.value === activity);
                     if (activityOption && activityOption.value !== 'other') {
                        form.setValue('activity', activityOption.value, { shouldValidate: true });
                        const index = ACTIVITY_OPTIONS.findIndex(opt => opt.value === activityOption.value);
                        setActivitySliderValue(index >= 0 ? index : 0);
                        form.setValue('activityOther', '', { shouldValidate: true });
                     } else if (activity === 'other' && activityOther) {
                        form.setValue('activity', 'other', { shouldValidate: true });
                        form.setValue('activityOther', activityOther, { shouldValidate: true });
                         const otherIndex = ACTIVITY_OPTIONS.findIndex(opt => opt.value === 'other');
                         setActivitySliderValue(otherIndex >= 0 ? otherIndex : 0);
                     }
                }
                // Prioritize dates extracted by AI
                if (startDate && endDate) {
                    try {
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                            form.setValue('dateInputMode', 'dates', { shouldValidate: true });
                            form.setValue('startDate', start, { shouldValidate: true });
                            form.setValue('endDate', end, { shouldValidate: true });
                            form.setValue('durationDays', null, { shouldValidate: true }); // Clear duration if dates are set
                            toast({ title: "AI Update", description: "Dates updated. Review and save."});
                        } else {
                             console.error("AI returned invalid or illogical date format:", startDate, endDate);
                             toast({ variant: 'destructive', title: "AI Date Error", description: "AI provided invalid dates. Please set manually."});
                        }
                    } catch (e) {
                        console.error("Error parsing AI dates:", e);
                         toast({ variant: 'destructive', title: "AI Date Error", description: "Could not parse dates from AI. Please set manually."});
                    }
                } else if (durationDays) { // Fallback to durationDays if dates are not extracted
                    form.setValue('dateInputMode', 'duration', { shouldValidate: true });
                    form.setValue('durationDays', durationDays, { shouldValidate: true });
                    form.setValue('startDate', null, { shouldValidate: true });
                    form.setValue('endDate', null, { shouldValidate: true });
                     toast({ title: "AI Update", description: "Duration updated. Review and save."});
                } else {
                     // If neither dates nor duration are extracted, keep current mode and show message
                     toast({ title: "AI Update", description: "Preferences updated. Please set dates or duration manually."});
                }
                 form.trigger(); // Re-validate after AI updates
            }

        } catch (error) {
            console.error('Error calling AI assistant:', error);
            const errorMessage = error instanceof Error ? error.message : 'Could not get response from AI assistant.';
            toast({
                variant: 'destructive',
                title: 'AI Error',
                description: errorMessage + " Please try again.",
            });
            const errorChatMessage: ChatMessage = {
                 sender: 'ai',
                 message: "Sorry, I encountered an error trying to process that. Please try again.",
                 timestamp: Date.now(),
             };
             setChatHistory(prev => [...prev, errorChatMessage]);
        } finally {
            setIsAiLoading(false);
        }
    };

    // --- Scroll Chat Area ---
    useEffect(() => {
        if (chatScrollAreaRef.current) {
            const scrollViewport = chatScrollAreaRef.current.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]');
             if (scrollViewport) {
                scrollViewport.scrollTop = scrollViewport.scrollHeight;
            }
        }
    }, [chatHistory]);


     // --- Helper to parse preferences ---
    const getPreference = (preferences: string[] | undefined, key: string): string | undefined => {
         if (!preferences) return undefined;
        const pref = preferences.find(p => p.startsWith(`${key}:`));
        return pref ? pref.split(':').slice(1).join(':') : undefined;
    };

    const getPreferenceIcon = (key: string, value: string | undefined): React.ReactNode => {
         if (!value) return null;
        if (key === 'mood') {
            switch (value) {
                case 'relaxed': return <Smile className="h-4 w-4 text-primary"/>;
                case 'adventurous': return <Mountain className="h-4 w-4 text-primary"/>;
                case 'cultural': return <Film className="h-4 w-4 text-primary"/>;
                case 'social': return <UsersIcon className="h-4 w-4 text-primary"/>;
                case 'nature': return <Leaf className="h-4 w-4 text-primary"/>;
                default: return <Heart className="h-4 w-4 text-primary"/>;
            }
        }
        if (key === 'activity') {
             if (value.startsWith('other:')) return <Info className="h-4 w-4 text-primary"/>;
            switch (value) {
                case 'hiking': return <Mountain className="h-4 w-4 text-primary"/>;
                case 'museums': return <Film className="h-4 w-4 text-primary"/>;
                case 'beach': return <PlaneTakeoff className="h-4 w-4 text-primary"/>; // Placeholder
                case 'nightlife': return <UsersIcon className="h-4 w-4 text-primary"/>;
                case 'foodie': return <Utensils className="h-4 w-4 text-primary"/>;
                 case 'other': return <Info className="h-4 w-4 text-primary"/>;
                default: return <Heart className="h-4 w-4 text-primary"/>;
            }
        }
        return null;
    };


  // --- Render Logic ---
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

   if (!isAuthenticated && !authLoading) {
     return null;
   }

  return (
     <TooltipProvider> {/* Added TooltipProvider */}
    <div className="container mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2"><User className="h-8 w-8 text-primary"/> My Travels</h1>
        {/* --- Add New Travel Dialog --- */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Plan New Trip
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle className="text-2xl">Plan Your Next Adventure</DialogTitle>
              <DialogDescription>
                Tell us about your dream trip. Is it solo or with a group? Specify dates for matching or duration for flexibility.
              </DialogDescription>
            </DialogHeader>

             <Form {...form}>
                 <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 pt-4">

                    {/* Trip Type Selection */}
                    <FormField
                        control={form.control}
                        name="tripType"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel className="text-base font-semibold">Trip Type</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            form.setValue('groupId', undefined, { shouldValidate: true });
                                        }}
                                        value={field.value}
                                        className="flex gap-4"
                                        disabled={isSubmitting}
                                    >
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <RadioGroupItem value="individual" id="individual" className="sr-only" />
                                            </FormControl>
                                            <FormLabel htmlFor="individual" className="flex items-center gap-2 p-4 border rounded-md cursor-pointer hover:bg-accent/50 has-[:checked]:bg-accent has-[:checked]:border-primary justify-center font-normal">
                                                <User className="h-5 w-5 mr-1" /> Individual
                                            </FormLabel>
                                        </FormItem>
                                         <FormItem className="flex-1">
                                              <FormControl>
                                                 <RadioGroupItem value="group" id="group" className="sr-only" />
                                              </FormControl>
                                             <FormLabel htmlFor="group" className="flex items-center gap-2 p-4 border rounded-md cursor-pointer hover:bg-accent/50 has-[:checked]:bg-accent has-[:checked]:border-primary justify-center font-normal">
                                                <UsersIcon className="h-5 w-5 mr-1" /> Group
                                             </FormLabel>
                                        </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Conditional Group Selector */}
                    {form.watch('tripType') === 'group' && (
                         <FormField
                            control={form.control}
                            name="groupId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-base font-semibold">Select Group</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={isSubmitting || loadingGroups}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={loadingGroups ? "Loading groups..." : "Select a group"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {loadingGroups ? (
                                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                                            ) : myGroups.length === 0 ? (
                                                <SelectItem value="no-groups" disabled>No groups found</SelectItem>
                                            ) : (
                                                <SelectGroup>
                                                    <SelectLabel>Your Groups</SelectLabel>
                                                    {myGroups.map((group) => (
                                                        <SelectItem key={group.id} value={group.id}>
                                                            {group.groupName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                     <p className="text-xs text-muted-foreground pt-1">Plan this trip with one of your existing groups.</p>
                                </FormItem>
                            )}
                        />
                    )}

                     <FormField
                        control={form.control}
                        name="departureCity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-base font-semibold flex items-center gap-1"><LocateFixed className="h-5 w-5"/>Departure City</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., Rome, London, New York" {...field} disabled={isSubmitting} />
                                </FormControl>
                                <FormMessage />
                                 <p className="text-xs text-muted-foreground pt-1">Needed for destination matching.</p>
                            </FormItem>
                        )}
                     />

                    <FormField
                        control={form.control}
                        name="planningMode"
                        render={({ field }) => (
                            <FormItem className="mt-2 border-t pt-6">
                                 <FormLabel className="text-base font-semibold mb-3 block">Trip Preferences</FormLabel>
                                <FormControl>
                                    <Tabs value={field.value} onValueChange={field.onChange} className="w-full">
                                         <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="guided"><SlidersHorizontal className="mr-2 h-4 w-4"/>Guided</TabsTrigger>
                                            <TabsTrigger value="ai"><Wand2 className="mr-2 h-4 w-4"/>AI Assistant</TabsTrigger>
                                         </TabsList>

                                         <TabsContent value="guided" className="mt-6 space-y-6">
                                             <FormField
                                                control={form.control}
                                                name="mood"
                                                render={({ field: moodField }) => (
                                                    <FormItem>
                                                        <FormLabel className="flex items-center gap-1 text-base font-semibold"><Smile className="h-5 w-5"/>Mood</FormLabel>
                                                        <FormControl>
                                                            <Slider
                                                                id="mood-slider"
                                                                min={0}
                                                                max={MOOD_OPTIONS.length - 1}
                                                                step={1}
                                                                value={[moodSliderValue]}
                                                                onValueChange={handleMoodSliderChange}
                                                                className={cn("w-[95%] mx-auto pt-2")}
                                                                disabled={isSubmitting}
                                                                aria-label="Select Mood"
                                                            />
                                                        </FormControl>
                                                        <div className="flex justify-between text-xs text-muted-foreground px-2">
                                                            {MOOD_OPTIONS.map((opt, index) => (
                                                                <span key={opt.value} className={cn(index === moodSliderValue && "font-bold text-primary")}>
                                                                    {opt.label}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <p className="text-center text-lg font-medium mt-2 flex items-center justify-center gap-1">
                                                            {MOOD_OPTIONS[moodSliderValue]?.icon} {MOOD_OPTIONS[moodSliderValue]?.label}
                                                        </p>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="activity"
                                                render={({ field: activityField }) => (
                                                     <FormItem>
                                                        <FormLabel className="flex items-center gap-1 text-base font-semibold"><Mountain className="h-5 w-5"/>Activity</FormLabel>
                                                         <FormControl>
                                                            <Slider
                                                                id="activity-slider"
                                                                min={0}
                                                                max={ACTIVITY_OPTIONS.length - 1}
                                                                step={1}
                                                                value={[activitySliderValue]}
                                                                onValueChange={handleActivitySliderChange}
                                                                className={cn("w-[95%] mx-auto pt-2")}
                                                                disabled={isSubmitting}
                                                                aria-label="Select Activity"
                                                            />
                                                        </FormControl>
                                                        <div className="flex justify-between text-xs text-muted-foreground px-2">
                                                            {ACTIVITY_OPTIONS.map((opt, index) => (
                                                                <span key={opt.value} className={cn(index === activitySliderValue && "font-bold text-primary")}>
                                                                    {opt.label}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <p className="text-center text-lg font-medium mt-2 flex items-center justify-center gap-1">
                                                            {ACTIVITY_OPTIONS[activitySliderValue]?.icon} {ACTIVITY_OPTIONS[activitySliderValue]?.label}
                                                        </p>
                                                        {form.watch('activity') === 'other' && (
                                                             <FormField
                                                                control={form.control}
                                                                name="activityOther"
                                                                render={({ field: otherField }) => (
                                                                    <FormItem className="px-4 space-y-1 pt-2">
                                                                         <FormLabel>Describe "Other" Activity</FormLabel>
                                                                         <FormControl>
                                                                             <Input
                                                                                placeholder="e.g., Volunteering, Language course"
                                                                                {...otherField}
                                                                                disabled={isSubmitting}
                                                                            />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                     </FormItem>
                                                                )}
                                                            />
                                                        )}
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                             {/* Date / Duration Selection */}
                                             <FormField
                                                control={form.control}
                                                name="dateInputMode"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-3">
                                                         <FormLabel className="text-base font-semibold">Trip Timing <span className='text-destructive'>*</span></FormLabel>
                                                         <FormControl>
                                                            <RadioGroup
                                                                onValueChange={(value: 'dates' | 'duration') => handleDateInputModeChange(value)}
                                                                value={field.value}
                                                                className="flex gap-4"
                                                                disabled={isSubmitting}
                                                            >
                                                                <FormItem className="flex-1">
                                                                     <FormControl>
                                                                         <RadioGroupItem value="dates" id="dates" className="sr-only" />
                                                                     </FormControl>
                                                                     <FormLabel htmlFor="dates" className="flex items-center gap-2 p-4 border rounded-md cursor-pointer hover:bg-accent/50 has-[:checked]:bg-accent has-[:checked]:border-primary justify-center font-normal">
                                                                         <CalendarDays className="h-5 w-5 mr-1" /> Select Dates
                                                                     </FormLabel>
                                                                </FormItem>
                                                                 <FormItem className="flex-1">
                                                                     <FormControl>
                                                                         <RadioGroupItem value="duration" id="duration" className="sr-only" />
                                                                     </FormControl>
                                                                      <FormLabel htmlFor="duration" className="flex items-center gap-2 p-4 border rounded-md cursor-pointer hover:bg-accent/50 has-[:checked]:bg-accent has-[:checked]:border-primary justify-center font-normal">
                                                                          <Timer className="h-5 w-5 mr-1" /> Specify Duration
                                                                      </FormLabel>
                                                                </FormItem>
                                                            </RadioGroup>
                                                         </FormControl>
                                                          <FormMessage /> {/* For the RadioGroup itself if needed */}

                                                         {/* Conditional Date Pickers */}
                                                          <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pt-4", field.value !== 'dates' && 'hidden')}>
                                                              <FormField
                                                                    control={form.control}
                                                                    name="startDate"
                                                                    render={({ field: startDateField }) => (
                                                                        <FormItem className="flex flex-col space-y-2">
                                                                            <FormLabel>Start Date</FormLabel>
                                                                            <Popover>
                                                                                <PopoverTrigger asChild>
                                                                                     <FormControl>
                                                                                        <Button
                                                                                            variant={"outline"}
                                                                                            className={cn(
                                                                                                "w-full justify-start text-left font-normal",
                                                                                                !startDateField.value && "text-muted-foreground"
                                                                                            )}
                                                                                            disabled={isSubmitting || field.value !== 'dates'}
                                                                                        >
                                                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                                                            {startDateField.value ? format(startDateField.value, "PPP") : <span>Pick a date</span>}
                                                                                        </Button>
                                                                                    </FormControl>
                                                                                </PopoverTrigger>
                                                                                 <PopoverContent className="w-auto p-0">
                                                                                    <ShadCalendar
                                                                                        mode="single"
                                                                                        selected={startDateField.value ?? undefined}
                                                                                        onSelect={(date) => handleDateChange(date, startDateField)}
                                                                                        initialFocus
                                                                                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} // Disable past dates
                                                                                    />
                                                                                </PopoverContent>
                                                                            </Popover>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                              />
                                                               <FormField
                                                                    control={form.control}
                                                                    name="endDate"
                                                                    render={({ field: endDateField }) => (
                                                                        <FormItem className="flex flex-col space-y-2">
                                                                            <FormLabel>End Date</FormLabel>
                                                                            <Popover>
                                                                                <PopoverTrigger asChild>
                                                                                     <FormControl>
                                                                                         <Button
                                                                                            variant={"outline"}
                                                                                            className={cn(
                                                                                                "w-full justify-start text-left font-normal",
                                                                                                !endDateField.value && "text-muted-foreground"
                                                                                            )}
                                                                                            disabled={isSubmitting || field.value !== 'dates' || !form.watch('startDate')}
                                                                                        >
                                                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                                                            {endDateField.value ? format(endDateField.value, "PPP") : <span>Pick a date</span>}
                                                                                        </Button>
                                                                                     </FormControl>
                                                                                </PopoverTrigger>
                                                                                 <PopoverContent className="w-auto p-0">
                                                                                     <ShadCalendar
                                                                                        mode="single"
                                                                                        selected={endDateField.value ?? undefined}
                                                                                        onSelect={(date) => handleDateChange(date, endDateField)}
                                                                                        disabled={(date) => {
                                                                                           const startDate = form.watch('startDate');
                                                                                           return (startDate ? date < startDate : false) || date < new Date(new Date().setHours(0,0,0,0));
                                                                                        }}
                                                                                        initialFocus
                                                                                    />
                                                                                </PopoverContent>
                                                                            </Popover>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                               />
                                                          </div>

                                                          {/* Conditional Duration Input */}
                                                          <div className={cn("px-4 pt-4", field.value !== 'duration' && 'hidden')}>
                                                               <FormField
                                                                    control={form.control}
                                                                    name="durationDays"
                                                                    render={({ field: durationField }) => (
                                                                        <FormItem>
                                                                            <FormLabel>Duration (days)</FormLabel>
                                                                             <FormControl>
                                                                                <Input
                                                                                    type="number"
                                                                                    min="1"
                                                                                    max={MAX_DURATION_DAYS}
                                                                                    placeholder="e.g., 7"
                                                                                    {...durationField}
                                                                                    value={durationField.value ?? ''} // Handle null/undefined for input value
                                                                                    disabled={isSubmitting || field.value !== 'duration'}
                                                                                />
                                                                             </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                          </div>
                                                          {/* Display top-level form errors related to date/duration refinement */}
                                                          {form.formState.errors.startDate?.type === 'refine' && (
                                                            <p className="text-sm text-destructive text-center font-semibold pt-2">{form.formState.errors.startDate.message}</p>
                                                           )}
                                                            {form.formState.errors.durationDays?.type === 'refine' && (
                                                            <p className="text-sm text-destructive text-center font-semibold pt-2">{form.formState.errors.durationDays.message}</p>
                                                           )}
                                                    </FormItem>
                                                )}
                                            />


                                         </TabsContent>

                                        <TabsContent value="ai">
                                            <div className="flex flex-col h-[50vh]">
                                                 <Label className="text-base font-semibold mb-2 flex items-center gap-1"><Bot className="h-5 w-5"/>AI Travel Assistant</Label>
                                                <ScrollArea className="flex-grow border rounded-md p-4 mb-4 bg-muted/50" ref={chatScrollAreaRef}>
                                                    {chatHistory.length === 0 && (
                                                        <p className="text-sm text-muted-foreground text-center py-4">Start chatting with the AI to plan your trip!</p>
                                                    )}
                                                    {chatHistory.map((chat) => (
                                                        <div key={chat.timestamp} className={cn("mb-3 flex", chat.sender === 'user' ? 'justify-end' : 'justify-start')}>
                                                            <div className={cn(
                                                                "rounded-lg p-2 px-3 max-w-[80%] text-sm break-words",
                                                                chat.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground border'
                                                            )}>
                                                                {chat.message}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {isAiLoading && (
                                                        <div className="mb-3 flex justify-start">
                                                            <div className="rounded-lg p-2 px-3 max-w-[80%] text-sm bg-background text-foreground border italic flex items-center gap-2">
                                                                <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                                                            </div>
                                                        </div>
                                                    )}
                                                </ScrollArea>
                                                 <div className="flex items-center gap-2">
                                                     <Textarea
                                                         placeholder="Ask the AI about your trip preferences (e.g., 'I want a relaxing beach vacation for a week from Rome')"
                                                         value={currentUserInput}
                                                         onChange={handleAiInputChange}
                                                         onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSubmit(); } }}
                                                         className="flex-grow resize-none"
                                                         rows={1}
                                                         disabled={isSubmitting || isAiLoading}
                                                     />
                                                     <Button type="button" onClick={() => handleAiSubmit()} disabled={isSubmitting || isAiLoading || !currentUserInput.trim()} size="icon">
                                                         <Send className="h-4 w-4"/>
                                                         <span className="sr-only">Send message</span>
                                                     </Button>
                                                 </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || isAiLoading || !form.formState.isValid}>
                        {(isSubmitting || isAiLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {(isSubmitting || isAiLoading) ? 'Saving...' : 'Save Travel Plan'}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Display User's Individual Travels */}
      {loadingTravels ? (
        <div className="text-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your travel plans...</p>
        </div>
      ) : myIndividualTravels.length === 0 ? (
         <Card className="text-center py-12 shadow-md">
          <CardHeader>
             <PlaneTakeoff className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>No Individual Trips Planned Yet</CardTitle>
            <CardDescription>Start planning your next solo adventure or a trip with friends!</CardDescription>
          </CardHeader>
          <CardContent>
             <Button onClick={() => setIsAddDialogOpen(true)}>
               <PlusCircle className="mr-2 h-4 w-4" /> Plan Your First Trip
             </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myIndividualTravels.map((travel) => {
             const mood = getPreference(travel.preferences, 'mood');
             const activityRaw = getPreference(travel.preferences, 'activity');
             const activityOther = activityRaw?.startsWith('other:') ? activityRaw.substring(6) : undefined;
             const activity = activityOther ? `Other (${activityOther})` : activityRaw;

              const formattedCreatedAt = travel.createdAt && typeof travel.createdAt.toDate === 'function'
                ? travel.createdAt.toDate().toLocaleDateString()
                : 'N/A';

             const formattedStartDate = travel.dateRange?.start && typeof travel.dateRange.start.toDate === 'function'
                ? format(travel.dateRange.start.toDate(), "PPP")
                : null;
             const formattedEndDate = travel.dateRange?.end && typeof travel.dateRange.end.toDate === 'function'
                ? format(travel.dateRange.end.toDate(), "PPP")
                : null;

             const isMatching = processingMatchId === travel.id || travel.destinationMatchesStatus === 'processing';
             const matchCompleted = travel.destinationMatchesStatus === 'completed';
             const matchError = travel.destinationMatchesStatus === 'error';
             const canMatch = !!travel.dateRange?.start && !!travel.dateRange?.end && !!travel.departureCity; // Can match only if dates and departure city are set

             return (
                <Card key={travel.id} className="shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Trip Plan <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">#{travel.id?.substring(0, 6)}</span></span>
                         <User className="h-5 w-5 text-muted-foreground" title="Individual Trip"/>
                    </CardTitle>
                    <CardDescription>
                        Created: {formattedCreatedAt}
                    </CardDescription>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <LocateFixed className="h-4 w-4"/>
                         Departing from: <span className="font-medium text-foreground">{travel.departureCity}</span>
                    </p>
                     {(formattedStartDate && formattedEndDate) ? (
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="h-4 w-4"/>
                            {formattedStartDate} - {formattedEndDate}
                        </p>
                     ) : travel.durationDays ? (
                         <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <Timer className="h-4 w-4"/>
                            {travel.durationDays} day{travel.durationDays !== 1 ? 's' : ''} (Flexible Dates)
                         </p>
                     ) : null}
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                    {mood && (
                         <p className="text-sm flex items-center gap-1 capitalize">
                             {getPreferenceIcon('mood', mood)} Mood: <span className="font-medium text-foreground">{mood}</span>
                         </p>
                    )}
                     {activity && (
                         <p className="text-sm flex items-center gap-1 capitalize">
                             {getPreferenceIcon('activity', activityRaw)} Activity: <span className="font-medium text-foreground">{activity}</span>
                         </p>
                     )}
                     {travel.preferences?.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length > 0 && (
                         <div className="flex items-start gap-1 pt-1">
                            <Heart className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary"/>
                            <div className="flex flex-wrap gap-1">
                             {travel.preferences.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).slice(0, 5).map((pref, index) => (
                                <span key={index} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{pref}</span>
                             ))}
                             {travel.preferences.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length > 5 && <span className="text-xs text-muted-foreground">...</span>}
                            </div>
                         </div>
                     )}

                     {/* Destination Matching Section */}
                     <div className="pt-4 border-t mt-4">
                        <h4 className="text-sm font-semibold mb-2">Destination Matches</h4>
                         {!canMatch ? (
                            <p className="text-sm text-muted-foreground italic">Specify exact dates and departure city to enable matching.</p>
                         ) : isMatching ? (
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching for best destinations...
                            </div>
                         ) : matchError ? (
                             <div className="flex items-center text-sm text-destructive">
                                 <XCircle className="h-4 w-4 mr-2" /> Error: {travel.destinationMatchesError || 'Matching failed.'}
                             </div>
                         ) : matchCompleted && travel.destinationMatches && travel.destinationMatches.length > 0 ? (
                            <div className="space-y-2">
                                {travel.destinationMatches.slice(0, 3).map((match, index) => (
                                    <div key={index} className="text-xs border p-2 rounded-md bg-background">
                                        <div className="flex justify-between items-center mb-1">
                                             <span className="font-semibold text-primary">{index + 1}. {match.destinationIata}</span>
                                             <span className="font-bold text-lg">{Math.round((match.finalScore ?? 0) * 100)}%</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-muted-foreground">
                                            <span className="flex items-center gap-1"><Euro className="h-3 w-3"/> ~€{match.priceEur ?? 'N/A'}</span>
                                            <span className="flex items-center gap-1"><Leaf className="h-3 w-3"/> {match.co2Kg?.toFixed(1) ?? 'N/A'} kg</span>
                                            <span className="flex items-center gap-1"><BarChart className="h-3 w-3"/> {match.stops ?? 'N/A'} stop(s)</span>
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {match.durationMinutes ? `${Math.floor(match.durationMinutes/60)}h ${match.durationMinutes%60}m` : 'N/A'}</span>
                                            {match.affinityScore !== undefined && <span className="flex items-center gap-1 col-span-2"><Heart className="h-3 w-3"/> Affinity: {Math.round(match.affinityScore * 100)}%</span>}
                                        </div>
                                        {match.errorMessage && <p className="text-destructive text-xs mt-1">{match.errorMessage}</p>}
                                    </div>
                                ))}
                                {travel.destinationMatches.length > 3 && <p className="text-xs text-muted-foreground text-center mt-1">... and more</p>}
                            </div>
                         ) : matchCompleted && (!travel.destinationMatches || travel.destinationMatches.length === 0) ? (
                             <p className="text-sm text-muted-foreground italic">No suitable destinations found based on criteria.</p>
                         ) : (
                             <p className="text-sm text-muted-foreground italic">Ready to find matches.</p>
                         )}
                     </div>


                    {(!mood && !activity && !(travel.places && travel.places.length > 0) && travel.preferences?.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length === 0) && (
                        <p className="text-sm text-muted-foreground italic">No specific preferences set.</p>
                    )}
                </CardContent>
                <CardFooter className="flex justify-end pt-4 border-t gap-2">
                     <Tooltip>
                        <TooltipTrigger asChild>
                            {/* Wrap button in span to allow tooltip when disabled */}
                            <span tabIndex={!canMatch ? 0 : -1}>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => triggerDestinationMatching(travel)}
                                    disabled={isMatching || !canMatch}
                                    aria-disabled={!canMatch} // For accessibility
                                >
                                    {isMatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4" />}
                                    {isMatching ? 'Matching...' : (matchCompleted || matchError) ? 'Refresh Matches' : 'Find Matches'}
                                </Button>
                             </span>
                        </TooltipTrigger>
                         {!canMatch && (
                             <TooltipContent>
                                <p>Requires specific dates and departure city</p>
                            </TooltipContent>
                         )}
                     </Tooltip>
                    {/* <Button variant="outline" size="sm">View Details</Button> */}
                </CardFooter>
                </Card>
             );
          })}
        </div>
      )}
    </div>
     </TooltipProvider>
  );
}
