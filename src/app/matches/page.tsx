// src/app/matches/page.tsx - Refactored for "My Travels / Plan Trip"
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
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
import { Loader2, PlusCircle, PlaneTakeoff, Calendar, MapPin, Heart, User, List, SlidersHorizontal, Wand2, Smile, Mountain, Film, Users, Utensils, Info, CalendarDays, Leaf, UserPlus, Group, Bot, Send } from 'lucide-react'; // Added Bot, Send
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
import { Textarea } from '@/components/ui/textarea'; // Added Textarea
import { ScrollArea } from '@/components/ui/scroll-area'; // Added ScrollArea
import { planTravelAssistant, type PlanTravelAssistantInput, type PlanTravelAssistantOutput } from '@/ai/flows/plan-travel-assistant-flow'; // Import AI flow

// Interfaces (consider moving to a shared types file)
interface Place {
  name: string;
  coordinate?: { lat: number | null; lng: number | null };
  country: string;
}

interface Travel {
  id?: string; // Firestore document ID
  groupId: string | null;
  userId: string | null;
  preferences: string[]; // e.g., ["mood:relaxed", "activity:beach"]
  dateRange?: { start: Timestamp; end: Timestamp } | null;
  durationDays?: number;
  places?: Place[];
  createdAt: Timestamp;
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
    { value: "social", label: "Social", icon: <Users className="h-4 w-4" /> },
    { value: "nature", label: "Nature", icon: <Leaf className="h-4 w-4" /> },
];
const ACTIVITY_OPTIONS = [
    { value: "hiking", label: "Hiking", icon: <Mountain className="h-4 w-4" /> },
    { value: "museums", label: "Museums", icon: <Film className="h-4 w-4" /> },
    { value: "beach", label: "Beach", icon: <PlaneTakeoff className="h-4 w-4" /> }, // Replace with better icon if available
    { value: "nightlife", label: "Nightlife", icon: <Users className="h-4 w-4" /> },
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
  const chatScrollAreaRef = React.useRef<HTMLDivElement>(null);


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

    const handleDateChange = (date: Date | undefined, field: 'startDate' | 'endDate') => {
        form.setValue(field, date, { shouldValidate: true });
        // If both dates are set, clear durationDays
        const startDate = field === 'startDate' ? date : form.getValues('startDate');
        const endDate = field === 'endDate' ? date : form.getValues('endDate');
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
                currentChat: chatHistory.map(m => ({ role: m.sender, text: m.message })), // Convert history for AI
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
            // This requires the AI to reliably extract values.
            // For now, we'll log the extracted values. Actual form update needs careful implementation.
            console.log("AI Extracted Data:", aiOutput.extractedData);
            if (aiOutput.extractedData) {
                if (aiOutput.extractedData.mood) {
                    const moodOption = MOOD_OPTIONS.find(opt => opt.value === aiOutput.extractedData?.mood);
                    if (moodOption) {
                         form.setValue('mood', moodOption.value, { shouldValidate: true });
                         const index = MOOD_OPTIONS.findIndex(opt => opt.value === moodOption.value);
                         setMoodSliderValue(index >= 0 ? index : 0);
                    }
                }
                if (aiOutput.extractedData.activity) {
                    const activityOption = ACTIVITY_OPTIONS.find(opt => opt.value === aiOutput.extractedData?.activity);
                     if (activityOption && activityOption.value !== 'other') {
                        form.setValue('activity', activityOption.value, { shouldValidate: true });
                        const index = ACTIVITY_OPTIONS.findIndex(opt => opt.value === activityOption.value);
                        setActivitySliderValue(index >= 0 ? index : 0);
                        form.setValue('activityOther', '', { shouldValidate: true });
                     } else if (aiOutput.extractedData.activityOther) {
                         // If AI specifically provides 'other' and details
                        form.setValue('activity', 'other', { shouldValidate: true });
                        form.setValue('activityOther', aiOutput.extractedData.activityOther, { shouldValidate: true });
                         setActivitySliderValue(ACTIVITY_OPTIONS.findIndex(opt => opt.value === 'other'));
                     }
                }
                if (aiOutput.extractedData.durationDays) {
                    form.setValue('durationDays', aiOutput.extractedData.durationDays, { shouldValidate: true });
                    setDurationSliderValue([aiOutput.extractedData.durationDays]);
                    form.setValue('startDate', null, { shouldValidate: true });
                    form.setValue('endDate', null, { shouldValidate: true });
                } else if (aiOutput.extractedData.startDate && aiOutput.extractedData.endDate) {
                    // Assuming AI provides date strings - need parsing
                    try {
                        const startDate = new Date(aiOutput.extractedData.startDate);
                        const endDate = new Date(aiOutput.extractedData.endDate);
                        form.setValue('startDate', startDate, { shouldValidate: true });
                        form.setValue('endDate', endDate, { shouldValidate: true });
                        form.setValue('durationDays', undefined, { shouldValidate: true });
                        setDurationSliderValue([1]);
                    } catch (e) {
                        console.error("AI returned invalid date format:", e);
                        // Handle error - maybe ask user to confirm dates
                    }
                }
                 // Optionally, prompt user to confirm/switch to guided mode to finalize
                 toast({ title: "AI Update", description: "Preferences updated based on chat. Review and save."});
            }

        } catch (error) {
            console.error('Error calling AI assistant:', error);
            toast({
                variant: 'destructive',
                title: 'AI Error',
                description: 'Could not get response from AI assistant. Please try again.',
            });
            // Optionally remove the user message or add an error message to chat
            const errorMessage: ChatMessage = {
                 sender: 'ai',
                 message: "Sorry, I encountered an error. Please try again.",
                 timestamp: Date.now(),
             };
             setChatHistory(prev => [...prev, errorMessage]);
        } finally {
            setIsAiLoading(false);
        }
    };

    // --- Scroll Chat Area ---
    useEffect(() => {
        if (chatScrollAreaRef.current) {
            // Use `scrollIntoView` on a dummy element at the end for better control
            const endOfChat = chatScrollAreaRef.current.querySelector('#end-of-chat');
            endOfChat?.scrollIntoView({ behavior: 'smooth' });
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
                case 'social': return <Users className="h-4 w-4 text-primary"/>;
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
                case 'nightlife': return <Users className="h-4 w-4 text-primary"/>;
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

            {/* --- Main Form Content --- */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">

                 {/* Trip Type Selection */}
                 <div className="space-y-3">
                    <Label className="text-lg font-semibold">Trip Type</Label>
                     <Controller
                        name="tripType"
                        control={form.control}
                        render={({ field }) => (
                          <RadioGroup
                            onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue('groupId', undefined, { shouldValidate: true }); // Clear group if switching to individual
                            }}
                            value={field.value}
                            className="flex gap-4"
                            disabled={isSubmitting}
                          >
                            <Label htmlFor="individual" className="flex items-center gap-2 p-4 border rounded-md cursor-pointer hover:bg-accent/50 has-[:checked]:bg-accent has-[:checked]:border-primary flex-1 justify-center">
                              <RadioGroupItem value="individual" id="individual" />
                              <User className="h-5 w-5 mr-1" /> Individual
                            </Label>
                            <Label htmlFor="group" className="flex items-center gap-2 p-4 border rounded-md cursor-pointer hover:bg-accent/50 has-[:checked]:bg-accent has-[:checked]:border-primary flex-1 justify-center">
                              <RadioGroupItem value="group" id="group" />
                               <Users className="h-5 w-5 mr-1" /> Group
                            </Label>
                          </RadioGroup>
                        )}
                      />
                       {form.formState.errors.tripType && <p className="text-sm text-destructive text-center">{form.formState.errors.tripType.message}</p>}
                 </div>

                {/* Conditional Group Selector */}
                {form.watch('tripType') === 'group' && (
                    <div className="space-y-2">
                        <Label htmlFor="groupId" className="text-lg font-semibold">Select Group</Label>
                        <Controller
                            name="groupId"
                            control={form.control}
                            render={({ field }) => (
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value} // Use value instead of defaultValue here
                                    disabled={isSubmitting || loadingGroups}
                                >
                                    <SelectTrigger id="groupId" aria-invalid={form.formState.errors.groupId ? 'true' : 'false'}>
                                        <SelectValue placeholder={loadingGroups ? "Loading groups..." : "Select a group"} />
                                    </SelectTrigger>
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
                            )}
                        />
                        {form.formState.errors.groupId && <p className="text-sm text-destructive">{form.formState.errors.groupId.message}</p>}
                         <p className="text-xs text-muted-foreground">Plan this trip with one of your existing groups.</p>
                    </div>
                )}


              {/* Emotional Planning Section (Tabs) */}
              <Controller
                  name="planningMode"
                  control={form.control}
                  render={({ field }) => (
                    <Tabs value={field.value} onValueChange={field.onChange} className="w-full mt-2 border-t pt-6">
                      <Label className="text-lg font-semibold mb-3 block">Trip Preferences</Label>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="guided"><SlidersHorizontal className="mr-2 h-4 w-4"/>Guided</TabsTrigger>
                        <TabsTrigger value="ai"><Wand2 className="mr-2 h-4 w-4"/>AI Assistant</TabsTrigger>
                      </TabsList>

                      {/* --- Mode 1: Guided Planning --- */}
                      <TabsContent value="guided" className="mt-6 space-y-6">
                             {/* Mood Slider */}
                            <div className="space-y-3">
                              <Label htmlFor="mood-slider" className="flex items-center gap-1 text-base font-semibold"><Smile className="h-5 w-5"/>Mood</Label>
                              <Controller
                                name="mood"
                                control={form.control}
                                render={({ field }) => ( // Field is implicitly handled by slider interaction now
                                    <>
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
                                    </>
                                )}
                              />
                              {form.formState.errors.mood?.type !== 'refine' && form.formState.errors.mood && <p className="text-sm text-destructive text-center">{form.formState.errors.mood.message}</p>}
                            </div>

                            {/* Activity Slider */}
                            <div className="space-y-3">
                                <Label htmlFor="activity-slider" className="flex items-center gap-1 text-base font-semibold"><Mountain className="h-5 w-5"/>Activity</Label>
                                <Controller
                                    name="activity"
                                    control={form.control}
                                    render={({ field }) => (
                                        <>
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
                                        </>
                                    )}
                                />
                                {form.watch('activity') === 'other' && (
                                    <div className="px-4 space-y-1">
                                        <Label htmlFor="activityOther">Describe "Other" Activity</Label>
                                        <Input
                                            id="activityOther"
                                            placeholder="e.g., Volunteering, Language course"
                                            {...form.register('activityOther')}
                                            disabled={isSubmitting}
                                            aria-invalid={form.formState.errors.activityOther ? 'true' : 'false'}
                                        />
                                        {form.formState.errors.activityOther && <p className="text-sm text-destructive">{form.formState.errors.activityOther.message}</p>}
                                    </div>
                                )}
                                 {form.formState.errors.activity && <p className="text-sm text-destructive text-center">{form.formState.errors.activity.message}</p>}
                            </div>

                             {/* Duration Slider OR Date Range Picker */}
                            <div className="space-y-3">
                                 <Label className="flex items-center gap-1 text-base font-semibold"><CalendarDays className="h-5 w-5"/>Duration / Dates</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="startDate">Start Date</Label>
                                        <Controller
                                            name="startDate"
                                            control={form.control}
                                            render={({ field }) => (
                                                <Popover>
                                                    <PopoverTrigger asChild>
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
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0">
                                                    <ShadCalendar
                                                        mode="single"
                                                        selected={field.value ?? undefined}
                                                        onSelect={(date) => handleDateChange(date, 'startDate')}
                                                        initialFocus
                                                    />
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        />
                                        {form.formState.errors.startDate && <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="endDate">End Date</Label>
                                         <Controller
                                            name="endDate"
                                            control={form.control}
                                            render={({ field }) => (
                                                <Popover>
                                                    <PopoverTrigger asChild>
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
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0">
                                                    <ShadCalendar
                                                        mode="single"
                                                        selected={field.value ?? undefined}
                                                        onSelect={(date) => handleDateChange(date, 'endDate')}
                                                        disabled={(date) =>
                                                            form.watch('startDate') ? date < form.watch('startDate')! : false
                                                        }
                                                        initialFocus
                                                    />
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        />
                                        {form.formState.errors.endDate && <p className="text-sm text-destructive">{form.formState.errors.endDate.message}</p>}
                                    </div>
                                 </div>

                                <div className="space-y-3 pt-4">
                                     <Label htmlFor="duration-slider" className="text-center block text-sm text-muted-foreground">Or select approximate duration</Label>
                                     <Controller
                                        name="durationDays"
                                        control={form.control}
                                        render={({ field }) => (
                                            <>
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
                                            <p className="text-center text-lg font-medium mt-2">
                                                {durationSliderValue[0]} day{durationSliderValue[0] !== 1 ? 's' : ''}
                                            </p>
                                            </>
                                        )}
                                    />
                                   {form.formState.errors.durationDays && <p className="text-sm text-destructive text-center">{form.formState.errors.durationDays.message}</p>}
                                </div>
                            </div>
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
                                 <Button type="button" onClick={() => handleAiSubmit()} disabled={isSubmitting || isAiLoading || !currentUserInput.trim()} size="icon">
                                     <Send className="h-4 w-4"/>
                                     <span className="sr-only">Send message</span>
                                 </Button>
                             </div>
                         </div>
                      </TabsContent>
                    </Tabs>
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

             return (
                <Card key={travel.id} className="shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Trip Plan <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">#{travel.id?.substring(0, 6)}</span></span>
                         <User className="h-5 w-5 text-muted-foreground" title="Individual Trip"/>
                    </CardTitle>
                    <CardDescription>
                        Created: {travel.createdAt.toDate().toLocaleDateString()}
                    </CardDescription>
                     {(travel.dateRange) ? (
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="h-4 w-4"/>
                            {format(travel.dateRange.start.toDate(), "PPP")} - {format(travel.dateRange.end.toDate(), "PPP")}
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
