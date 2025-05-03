
// src/app/matches/page.tsx - Refactored for "My Travels / Plan Trip"
'use client';

import { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import { useForm, SubmitHandler, Controller, ControllerRenderProps } from 'react-hook-form'; // Added ControllerRenderProps
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, getDocs, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, PlusCircle, PlaneTakeoff, Calendar, MapPin, Heart, User, List, SlidersHorizontal, Wand2, Smile, Mountain, Film, Users as UsersIcon, Utensils, Info, CalendarDays, Leaf, UserPlus, Group, Bot, Send } from 'lucide-react'; // Renamed Users icon to UsersIcon to avoid conflict with User type
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
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'; // Import form components

// Interfaces (consider moving to a shared types file)
interface Place {
  name: string;
  coordinate?: { lat: number | null; lng: number | null };
  country: string;
}

// Ensure Timestamp properties are correctly typed
interface Travel {
  id?: string; // Firestore document ID
  groupId: string | null;
  userId: string | null;
  preferences: string[]; // e.g., ["mood:relaxed", "activity:beach"]
  dateRange?: { start: Timestamp; end: Timestamp } | null;
  durationDays?: number;
  places?: Place[];
  createdAt: Timestamp; // Ensure this is always treated as Timestamp
}


interface Group {
  id: string;
  groupName: string;
}

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
const MAX_DURATION_DAYS = 30;


// Define Zod schema for the new travel form validation
const travelFormSchema = z.object({
  tripType: z.enum(['individual', 'group'], { required_error: "Please select a trip type."}),
  groupId: z.string().optional(), // Required if tripType is 'group'
  // Mode 1: Guided Sliders
  mood: z.string().optional(), // Optional now, validation inside refine if mode is guided
  activity: z.string().optional(), // Optional now
  activityOther: z.string().optional(),
  durationDays: z.number().min(1, "Duration must be at least 1 day.").max(MAX_DURATION_DAYS).optional(),
  // OR Date Range
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
  // Mode 2: AI
  aiPrompt: z.string().optional(), // User's input to AI
  planningMode: z.enum(['guided', 'ai']).default('guided'), // Track which mode is active
}).refine(data => {
    // If trip type is group, groupId must be selected
    if (data.tripType === 'group') {
        return !!data.groupId;
    }
    return true;
}, {
    message: "Please select a group for a group trip.",
    path: ["groupId"],
}).refine(data => {
    // If activity is 'other', activityOther must be provided
    if (data.activity === 'other') {
        return !!data.activityOther && data.activityOther.trim().length > 0;
    }
    return true;
}, {
    message: "Please specify the 'other' activity.",
    path: ["activityOther"],
}).refine(data => {
    // If mode is 'guided', require at least one planning input
    if (data.planningMode === 'guided') {
        const hasMood = !!data.mood;
        const hasActivity = !!data.activity;
        const hasDurationDays = data.durationDays !== undefined && data.durationDays !== null && data.durationDays > 0;
        const hasDateRange = data.startDate !== undefined && data.startDate !== null && data.endDate !== undefined && data.endDate !== null;
        return hasMood || hasActivity || hasDurationDays || hasDateRange;
    }
    // If mode is 'ai', this check is less strict initially, rely on AI interaction
    return true;
}, {
    message: "Please provide at least one preference (Mood, Activity, Duration/Dates) in Guided mode.",
    path: ["mood"], // Assign error to a relevant field for display
}).refine(data => {
    // Ensure end date is after start date if both are provided
    if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
    }
    return true;
}, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
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
  const [myGroups, setMyGroups] = useState<Group[]>([]); // For group selection
  const [loadingTravels, setLoadingTravels] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false); // Separate loading for groups in dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for Mode 1 (Sliders)
  const [moodSliderValue, setMoodSliderValue] = useState(0);
  const [activitySliderValue, setActivitySliderValue] = useState(0);
  const [durationSliderValue, setDurationSliderValue] = useState([5]); // Default 5 days

  // State for Mode 2 (AI Chat)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentUserInput, setCurrentUserInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null); // Use React.useRef


  const form = useForm<TravelFormValues>({
    resolver: zodResolver(travelFormSchema),
    defaultValues: {
      tripType: 'individual', // Default to individual
      groupId: undefined,
      mood: MOOD_OPTIONS[0].value, // Default mood
      activity: ACTIVITY_OPTIONS[0].value, // Default activity
      activityOther: '',
      durationDays: 5,
      startDate: null,
      endDate: null,
      aiPrompt: '',
      planningMode: 'guided',
    },
  });

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
          // Query for travels where userId matches AND groupId is null
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


  // --- Fetch User's Groups (for selection in the dialog) ---
  const fetchMyGroups = useCallback(async () => {
      if (user?.uid) {
          setLoadingGroups(true);
          try {
              const groupsCollection = collection(db, 'groups');
              const q = query(groupsCollection, where('users', 'array-contains', user.uid));
              const querySnapshot = await getDocs(q);
              const groupsList = querySnapshot.docs.map(doc => ({
                  id: doc.id,
                  groupName: doc.data().groupName || `Group ${doc.id.substring(0,5)}`, // Fallback name
              })) as Group[];
              setMyGroups(groupsList);
          } catch (error) {
              console.error('Error fetching groups for selection:', error);
              // Don't toast here, it might be annoying in the dialog
          } finally {
              setLoadingGroups(false);
          }
      }
  }, [user]);

  // --- Initial Data Fetch ---
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      fetchMyIndividualTravels();
      fetchMyGroups(); // Fetch groups when user is loaded
    }
  }, [user, isAuthenticated, authLoading, fetchMyIndividualTravels, fetchMyGroups]);


  // --- Form Submission ---
  const onSubmit: SubmitHandler<TravelFormValues> = async (data) => {
     if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to add a travel plan.' });
        return;
    }
    setIsSubmitting(true);

    // Construct preferences array based on final form state (could be from guided or AI)
    const preferences: string[] = [];
    if (data.mood) preferences.push(`mood:${data.mood}`);
    if (data.activity === 'other' && data.activityOther) {
        preferences.push(`activity:other:${data.activityOther}`);
    } else if (data.activity) {
        preferences.push(`activity:${data.activity}`);
    }
    // Add more preferences if AI generated them

    try {
       const travelToAdd: Omit<Travel, 'id'> = {
        userId: data.tripType === 'individual' ? user.uid : null,
        groupId: data.tripType === 'group' ? data.groupId! : null,
        preferences: preferences,
        dateRange: data.startDate && data.endDate ? {
            start: Timestamp.fromDate(data.startDate),
            end: Timestamp.fromDate(data.endDate)
        } : null,
        durationDays: (data.startDate && data.endDate) ? undefined : data.durationDays,
        places: [], // AI could potentially populate this in future
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, 'travels'), travelToAdd);
      toast({
        title: 'Travel Plan Added!',
        description: `Your new ${data.tripType} travel plan has been saved.`,
      });

       if (data.tripType === 'individual') {
            setMyIndividualTravels(prev => [...prev, { ...travelToAdd, id: docRef.id, createdAt: travelToAdd.createdAt }]);
       } else {
           // If group trip, navigate to groups page to see the new trip listed there
           // Consider refreshing the groups page data if staying on the same page
           // For now, let's assume navigating to groups page implies a fresh load there.
           router.push('/groups');
       }


      form.reset({
          tripType: 'individual',
          groupId: undefined,
          mood: MOOD_OPTIONS[0].value,
          activity: ACTIVITY_OPTIONS[0].value,
          activityOther: '',
          durationDays: 5,
          startDate: null,
          endDate: null,
          aiPrompt: '',
          planningMode: 'guided',
      });
      setMoodSliderValue(0);
      setActivitySliderValue(0);
      setDurationSliderValue([5]);
      setChatHistory([]); // Reset chat
      setCurrentUserInput('');
      setIsAddDialogOpen(false);

    } catch (error) {
      console.error('Error adding travel plan:', error);
      toast({
        variant: 'destructive',
        title: 'Error Adding Travel',
        description: 'Failed to save your travel plan. Please try again.',
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

    const handleDurationSliderChange = (value: number[]) => {
        setDurationSliderValue(value);
        form.setValue('durationDays', value[0], { shouldValidate: true });
        form.setValue('startDate', null, { shouldValidate: true });
        form.setValue('endDate', null, { shouldValidate: true });
    };

    // Updated handler for DatePicker within FormField
    const handleDateChange = (date: Date | undefined, field: ControllerRenderProps<TravelFormValues, 'startDate' | 'endDate'>) => {
        field.onChange(date); // Update RHF state
        // If both dates are set, clear durationDays
        const startDate = form.getValues('startDate');
        const endDate = form.getValues('endDate');
        if (startDate && endDate) {
            form.setValue('durationDays', undefined, { shouldValidate: false }); // No need to validate here
            setDurationSliderValue([1]); // Reset slider visually
        }
    }

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
                currentChat: chatHistory.map(m => ({ role: m.sender === 'user' ? 'user' : 'ai', text: m.message })), // Ensure correct role mapping
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
                         // Handle 'other' explicitly provided by AI
                        form.setValue('activity', 'other', { shouldValidate: true });
                        form.setValue('activityOther', activityOther, { shouldValidate: true });
                         const otherIndex = ACTIVITY_OPTIONS.findIndex(opt => opt.value === 'other');
                         setActivitySliderValue(otherIndex >= 0 ? otherIndex : 0);
                     }
                }
                if (durationDays) {
                    form.setValue('durationDays', durationDays, { shouldValidate: true });
                    setDurationSliderValue([durationDays]);
                    form.setValue('startDate', null, { shouldValidate: true });
                    form.setValue('endDate', null, { shouldValidate: true });
                } else if (startDate && endDate) {
                    try {
                        const start = new Date(startDate); // Attempt to parse date string
                        const end = new Date(endDate);
                        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) { // Check if dates are valid
                            form.setValue('startDate', start, { shouldValidate: true });
                            form.setValue('endDate', end, { shouldValidate: true });
                            form.setValue('durationDays', undefined, { shouldValidate: true });
                            setDurationSliderValue([1]);
                        } else {
                             console.error("AI returned invalid date format:", startDate, endDate);
                             toast({ variant: 'destructive', title: "AI Date Error", description: "AI provided invalid dates. Please set manually."});
                        }
                    } catch (e) {
                        console.error("Error parsing AI dates:", e);
                         toast({ variant: 'destructive', title: "AI Date Error", description: "Could not parse dates from AI. Please set manually."});
                    }
                }
                 // Optionally, prompt user to confirm/switch to guided mode to finalize
                 toast({ title: "AI Update", description: "Preferences updated based on chat. Review and save."});
            }

        } catch (error) {
            console.error('Error calling AI assistant:', error);
            const errorMessage = error instanceof Error ? error.message : 'Could not get response from AI assistant.';
            toast({
                variant: 'destructive',
                title: 'AI Error',
                description: errorMessage + " Please try again.",
            });
            // Add an error message to chat
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
            const scrollElement = chatScrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollElement) {
                scrollElement.scrollTop = scrollElement.scrollHeight;
            }
            // Use `scrollIntoView` on a dummy element at the end for better control
            // const endOfChat = chatScrollAreaRef.current.querySelector('#end-of-chat');
            // endOfChat?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory]); // Trigger scroll on new message


     // --- Helper to parse preferences --- (Duplicate from groups, consider moving to utils)
    const getPreference = (preferences: string[], key: string): string | undefined => {
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
                 case 'other': return <Info className="h-4 w-4 text-primary"/>; // Should not happen if startsWith('other:') is checked
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

  return (
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
                Tell us about your dream trip. Is it solo or with a group?
              </DialogDescription>
            </DialogHeader>

            {/* --- Wrap with Form Provider --- */}
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 pt-4">

                    {/* Trip Type Selection */}
                    <FormField
                        control={form.control}
                        name="tripType"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel className="text-lg font-semibold">Trip Type</FormLabel>
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
                                    <FormLabel className="text-lg font-semibold">Select Group</FormLabel>
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

                    {/* Emotional Planning Section (Tabs) */}
                    <FormField
                        control={form.control}
                        name="planningMode"
                        render={({ field }) => (
                            <FormItem className="mt-2 border-t pt-6">
                                 <FormLabel className="text-lg font-semibold mb-3 block">Trip Preferences</FormLabel>
                                <FormControl>
                                    <Tabs value={field.value} onValueChange={field.onChange} className="w-full">
                                         <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="guided"><SlidersHorizontal className="mr-2 h-4 w-4"/>Guided</TabsTrigger>
                                            <TabsTrigger value="ai"><Wand2 className="mr-2 h-4 w-4"/>AI Assistant</TabsTrigger>
                                         </TabsList>

                                         {/* --- Mode 1: Guided Planning --- */}
                                         <TabsContent value="guided" className="mt-6 space-y-6">
                                             {/* Mood Slider */}
                                             <FormField
                                                control={form.control}
                                                name="mood"
                                                render={({ field }) => (
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

                                             {/* Activity Slider */}
                                            <FormField
                                                control={form.control}
                                                name="activity"
                                                render={({ field }) => (
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
                                                                render={({ field }) => (
                                                                    <FormItem className="px-4 space-y-1 pt-2">
                                                                         <FormLabel>Describe "Other" Activity</FormLabel>
                                                                         <FormControl>
                                                                             <Input
                                                                                placeholder="e.g., Volunteering, Language course"
                                                                                {...field}
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

                                              {/* Duration Slider OR Date Range Picker */}
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-1 text-base font-semibold"><CalendarDays className="h-5 w-5"/>Duration / Dates</FormLabel>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4">
                                                     <FormField
                                                        control={form.control}
                                                        name="startDate"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-col space-y-2">
                                                                <FormLabel>Start Date</FormLabel>
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <FormControl>
                                                                            <Button
                                                                                variant={"outline"}
                                                                                className={cn(
                                                                                    "w-full justify-start text-left font-normal",
                                                                                    !field.value && "text-muted-foreground"
                                                                                )}
                                                                                disabled={isSubmitting}
                                                                            >
                                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                                            </Button>
                                                                        </FormControl>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-auto p-0">
                                                                         <ShadCalendar
                                                                            mode="single"
                                                                            selected={field.value ?? undefined}
                                                                            onSelect={(date) => handleDateChange(date, field)} // Pass field object
                                                                            initialFocus
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
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-col space-y-2">
                                                                <FormLabel>End Date</FormLabel>
                                                                <Popover>
                                                                     <PopoverTrigger asChild>
                                                                         <FormControl>
                                                                             <Button
                                                                                variant={"outline"}
                                                                                className={cn(
                                                                                    "w-full justify-start text-left font-normal",
                                                                                    !field.value && "text-muted-foreground"
                                                                                )}
                                                                                disabled={isSubmitting || !form.watch('startDate')}
                                                                            >
                                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                                            </Button>
                                                                        </FormControl>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-auto p-0">
                                                                         <ShadCalendar
                                                                            mode="single"
                                                                            selected={field.value ?? undefined}
                                                                            onSelect={(date) => handleDateChange(date, field)} // Pass field object
                                                                            disabled={(date) =>
                                                                                form.watch('startDate') ? date < form.watch('startDate')! : false
                                                                            }
                                                                            initialFocus
                                                                        />
                                                                    </PopoverContent>
                                                                </Popover>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                     />
                                                </div>
                                                 <FormField
                                                    control={form.control}
                                                    name="durationDays"
                                                    render={({ field }) => (
                                                         <FormItem className="pt-4 space-y-3">
                                                             <FormLabel className="text-center block text-sm text-muted-foreground">Or select approximate duration</FormLabel>
                                                             <FormControl>
                                                                <Slider
                                                                    id="duration-slider"
                                                                    min={1}
                                                                    max={MAX_DURATION_DAYS}
                                                                    step={1}
                                                                    value={durationSliderValue}
                                                                    onValueChange={handleDurationSliderChange}
                                                                    className={cn("w-[95%] mx-auto")}
                                                                    disabled={isSubmitting || (!!form.watch('startDate') && !!form.watch('endDate'))}
                                                                    aria-label="Select Duration in Days"
                                                                />
                                                            </FormControl>
                                                            <p className="text-center text-lg font-medium mt-2">
                                                                {durationSliderValue[0]} day{durationSliderValue[0] !== 1 ? 's' : ''}
                                                            </p>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </FormItem>


                                             {/* General Error Message for missing fields in guided mode */}
                                             {form.formState.errors.mood && form.formState.errors.mood.type === 'refine' && (
                                                <p className="text-sm text-destructive text-center font-semibold pt-2">{form.formState.errors.mood.message}</p>
                                             )}
                                         </TabsContent>

                                         {/* --- Mode 2: AI Assistant --- */}
                                        <TabsContent value="ai">
                                            <div className="flex flex-col h-[50vh]"> {/* Set fixed height */}
                                                 <Label className="text-base font-semibold mb-2 flex items-center gap-1"><Bot className="h-5 w-5"/>AI Travel Assistant</Label>
                                                <ScrollArea className="flex-grow border rounded-md p-4 mb-4 bg-muted/50" ref={chatScrollAreaRef}>
                                                    {chatHistory.length === 0 && (
                                                        <p className="text-sm text-muted-foreground text-center py-4">Start chatting with the AI to plan your trip!</p>
                                                    )}
                                                    {chatHistory.map((chat) => (
                                                        <div key={chat.timestamp} className={cn("mb-3 flex", chat.sender === 'user' ? 'justify-end' : 'justify-start')}>
                                                            <div className={cn(
                                                                "rounded-lg p-2 px-3 max-w-[80%] text-sm",
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
                                                    <div id="end-of-chat"></div> {/* Dummy div for scrolling */}
                                                </ScrollArea>
                                                {/* AI Input - no need for FormField as it's handled separately */}
                                                 <div className="flex items-center gap-2">
                                                     <Textarea
                                                         placeholder="Ask the AI about your trip preferences (e.g., 'I want a relaxing beach vacation for a week')"
                                                         value={currentUserInput}
                                                         onChange={handleAiInputChange}
                                                         onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSubmit(); } }}
                                                         className="flex-grow resize-none"
                                                         rows={1}
                                                         disabled={isSubmitting || isAiLoading}
                                                     />
                                                     <Button type="button" onClick={() => handleAiSubmit()} disabled={isSubmitting || isAiLoading || !currentUserInput.trim()} size="icon"> {/* Changed type to button and onClick */}
                                                         <Send className="h-4 w-4"/>
                                                         <span className="sr-only">Send message</span>
                                                     </Button>
                                                 </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </FormControl>
                                <FormMessage /> {/* For planningMode validation errors */}
                            </FormItem>
                        )}
                    />

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || isAiLoading}>
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

             // Safely format dates, checking if Timestamp exists and has toDate method
              const formattedCreatedAt = travel.createdAt && typeof travel.createdAt.toDate === 'function'
                ? travel.createdAt.toDate().toLocaleDateString()
                : 'N/A';

             const formattedStartDate = travel.dateRange?.start && typeof travel.dateRange.start.toDate === 'function'
                ? format(travel.dateRange.start.toDate(), "PPP")
                : null;
             const formattedEndDate = travel.dateRange?.end && typeof travel.dateRange.end.toDate === 'function'
                ? format(travel.dateRange.end.toDate(), "PPP")
                : null;


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
                     {(formattedStartDate && formattedEndDate) ? (
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="h-4 w-4"/>
                            {formattedStartDate} - {formattedEndDate}
                        </p>
                     ) : travel.durationDays ? (
                         <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <CalendarDays className="h-4 w-4"/>
                            {travel.durationDays} day{travel.durationDays !== 1 ? 's' : ''}
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
                     {travel.preferences.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length > 0 && (
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
                    {travel.places && travel.places.length > 0 && (
                        <div className="flex items-start gap-1 pt-1">
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary"/>
                            <div className="flex flex-wrap gap-1">
                                {travel.places.slice(0, 3).map((place, index) => (
                                    <span key={index} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{place.name}, {place.country}</span>
                                ))}
                                {travel.places.length > 3 && <span className="text-xs text-muted-foreground">...</span>}
                            </div>
                        </div>
                    )}
                    {(!mood && !activity && !(travel.places && travel.places.length > 0) && travel.preferences.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length === 0) && (
                        <p className="text-sm text-muted-foreground italic">No specific preferences set.</p>
                    )}
                </CardContent>
                <CardFooter className="flex justify-end pt-4 border-t">
                    <Button variant="outline" size="sm">View Details</Button>
                    {/* Add Edit/Delete later */}
                </CardFooter>
                </Card>
             );
          })}
        </div>
      )}
    </div>
  );
}
