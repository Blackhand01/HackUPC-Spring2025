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
import { Loader2, PlusCircle, PlaneTakeoff, Calendar, MapPin, Heart, User, List, SlidersHorizontal, Wand2, Smile, Mountain, Film, Users as UsersIcon, Utensils, Info, CalendarDays, Leaf, UserPlus, Group, Bot, Send, LocateFixed, Search, BarChart, Euro, Thermometer, Clock, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from "@/components/ui/scroll-area";
import { planTravelAssistant, type PlanTravelAssistantInput, type PlanTravelAssistantOutput } from '@/ai/flows/plan-travel-assistant-flow';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { type Travel, type Group, type Place } from '@/types'; // Import shared types
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Added Tooltip
import { format } from 'date-fns';

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

// Define Zod schema for the new travel form validation - Simplified (No Dates/Duration)
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
  aiPrompt: z.string().optional(), // Keep for potential initial trigger? Or remove? Let's keep for now.
  planningMode: z.enum(['guided', 'ai']).default('guided'),
}).refine(data => { // Refinement for groupId
    if (data.tripType === 'group') return !!data.groupId;
    return true;
}, { message: "Please select a group for a group trip.", path: ["groupId"]})
.refine(data => { // Refinement for activityOther
    if (data.activity === 'other') return !!data.activityOther && data.activityOther.trim().length > 0;
    return true;
}, { message: "Please specify the 'other' activity.", path: ["activityOther"]});

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

  // State for Mode 1 (Sliders)
  const [moodSliderValue, setMoodSliderValue] = useState(0);
  const [activitySliderValue, setActivitySliderValue] = useState(0);

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
      aiPrompt: '', // Initialize AI prompt field
      planningMode: 'guided',
    },
    mode: 'onChange', // Validate on change for better feedback
  });

   // Watch form values needed for button logic
   const watchedValues = useWatch({ control: form.control });
   const planningMode = watchedValues.planningMode;
   const tripType = watchedValues.tripType;
   const departureCity = watchedValues.departureCity;
   const groupId = watchedValues.groupId;
   const mood = watchedValues.mood;
   const activity = watchedValues.activity;


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


  // --- Function to Trigger Destination Matching (DISABLED) ---
  const triggerDestinationMatching = useCallback(async (travelData: Travel) => {
       toast({ variant: 'destructive', title: 'Matching Disabled', description: 'Destination matching is temporarily disabled.' });
       return;
  }, [toast]);


  // --- Form Submission ---
  const onSubmit: SubmitHandler<TravelFormValues> = async (data) => {
     if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to add a travel plan.' });
        return;
    }

    setIsSubmitting(true);
    console.log("Submitting Travel Form Data (Simplified):", data); // Log form data

    const preferences: string[] = [];
    let preferencesSet = false; // Flag to check if preferences were actually set

    // Get preferences based on the planning mode
    if (data.planningMode === 'guided') {
         if (data.mood) {
             preferences.push(`mood:${data.mood}`);
             preferencesSet = true;
         }
         if (data.activity === 'other' && data.activityOther) {
             preferences.push(`activity:other:${data.activityOther.trim()}`);
             preferencesSet = true;
         } else if (data.activity && data.activity !== 'other') {
             preferences.push(`activity:${data.activity}`);
             preferencesSet = true;
         }
    } else if (data.planningMode === 'ai' && chatHistory.length > 0) {
          if (form.getValues('mood')) {
              preferences.push(`mood:${form.getValues('mood')}`);
              preferencesSet = true;
          }
           const currentActivity = form.getValues('activity');
           const currentActivityOther = form.getValues('activityOther');
           if (currentActivity === 'other' && currentActivityOther) {
               preferences.push(`activity:other:${currentActivityOther.trim()}`);
               preferencesSet = true;
           } else if (currentActivity && currentActivity !== 'other') {
               preferences.push(`activity:${currentActivity}`);
               preferencesSet = true;
           }
           console.log("Preferences extracted from AI mode form state:", preferences);
    }

     // Check if preferences were actually set based on the mode
     if (!preferencesSet) {
         toast({ variant: 'destructive', title: 'Missing Preferences', description: 'Please set mood/activity or use the AI assistant.' });
         setIsSubmitting(false);
         return;
     }


    let newTravelDocId: string | null = null; // To store the ID of the newly created doc

    try {
       const travelToAdd: Omit<Travel, 'id'> = {
        userId: data.tripType === 'individual' ? user.uid : null,
        groupId: data.tripType === 'group' ? data.groupId! : null,
        departureCity: data.departureCity, // Save departure city
        preferences: preferences,
        places: [], // Initialize places as empty array
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(), // Set updatedAt on creation
      };

      console.log("Data being sent to Firestore (Simplified):", travelToAdd); // Log data before sending

      const docRef = await addDoc(collection(db, 'travels'), travelToAdd);
      newTravelDocId = docRef.id; // Store the new ID

      toast({
        title: 'Travel Plan Added!',
        description: `Your new ${data.tripType} travel plan has been saved.`,
      });

      const newTravelData: Travel = {
          ...travelToAdd,
          id: newTravelDocId,
          createdAt: travelToAdd.createdAt,
          updatedAt: travelToAdd.updatedAt,
      };

       if (data.tripType === 'individual') {
            setMyIndividualTravels(prev => [...prev, newTravelData]);
       } else {
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
          aiPrompt: '',
          planningMode: 'guided',
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

     // --- AI Chat Handlers ---
    const handleAiInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCurrentUserInput(event.target.value);
        form.setValue('aiPrompt', event.target.value); // Update hidden aiPrompt field if needed for validation
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
                 userPrompt: userMessage.message, // Pass the latest message explicitly
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
                 const { mood, activity, activityOther } = aiOutput.extractedData;

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
                 toast({ title: "AI Update", description: "Preferences updated. Review and save."});
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

    // --- Determine if Save button should be enabled ---
    const checkCanSave = (): boolean => {
        // Basic required fields: departure city and group selection (if group trip)
        if (!departureCity || (tripType === 'group' && !groupId)) {
            return false;
        }

        // Preference check based on mode
        if (planningMode === 'guided') {
            // At least one preference (mood or activity) must be set, and if activity is 'other', activityOther must be filled
            const isActivityValid = activity === 'other' ? !!form.getValues('activityOther')?.trim() : !!activity;
            return !!mood || isActivityValid;
        } else if (planningMode === 'ai') {
            // AI mode needs chat history AND preferences extracted by AI (mood or activity must have a value)
            // Check if mood or activity has been set (likely by AI interaction)
             const isActivityValid = form.getValues('activity') === 'other' ? !!form.getValues('activityOther')?.trim() : !!form.getValues('activity');
            return chatHistory.length > 0 && (!!form.getValues('mood') || isActivityValid);
        }
        return false; // Should not happen
    };
    const canSave = checkCanSave();


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
                Tell us about your dream trip. Is it solo or with a group? Specify preferences and departure city.
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
                                <FormLabel className="text-base font-semibold flex items-center gap-1"><LocateFixed className="h-5 w-5"/>Departure City <span className='text-destructive'>*</span></FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., Rome, London, New York" {...field} disabled={isSubmitting} />
                                </FormControl>
                                <FormMessage />
                                 <p className="text-xs text-muted-foreground pt-1">Where will your journey begin?</p>
                            </FormItem>
                        )}
                     />

                    <FormField
                        control={form.control}
                        name="planningMode"
                        render={({ field }) => (
                            <FormItem className="mt-2 border-t pt-6">
                                 <FormLabel className="text-base font-semibold mb-3 block">Trip Preferences <span className='text-destructive'>*</span></FormLabel>
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
                                                         placeholder="Ask the AI about your trip preferences (e.g., 'I want a relaxing beach vacation from Rome')"
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
                          <Button
                             type="submit"
                             disabled={isSubmitting || isAiLoading || !canSave} // Use the calculated canSave state
                           >
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
                ? format(travel.createdAt.toDate(), "PP") // Use PP for localized date format
                : 'N/A';

             const canMatch = false;
             const isMatching = false;
             const matchCompleted = false;
             const matchError = false;


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

                     {/* Destination Matching Section - Disabled */}
                     <div className="pt-4 border-t mt-4">
                        <h4 className="text-sm font-semibold mb-2">Destination Matches</h4>
                         <p className="text-sm text-muted-foreground italic">Destination matching is currently disabled.</p>
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
                                    onClick={() => triggerDestinationMatching(travel)} // Still calls the (now disabled) function
                                    disabled={true} // Always disabled
                                    aria-disabled={true} // For accessibility
                                >
                                    <Search className="mr-2 h-4 w-4" />
                                    Find Matches
                                </Button>
                             </span>
                        </TooltipTrigger>
                         <TooltipContent>
                            <p>Destination matching requires dates (temporarily disabled)</p>
                        </TooltipContent>
                     </Tooltip>
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
