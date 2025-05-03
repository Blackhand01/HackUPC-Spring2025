// src/app/matches/page.tsx - Refactored for "My Travels / Find Swap" with Emotional Planning
'use client';

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Keep Textarea for potential AI mode
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, PlusCircle, PlaneTakeoff, Calendar, MapPin, Heart, User, List, SlidersHorizontal, Wand2, Smile, Mountain, Film, Users, Utensils, Info, CalendarDays, Leaf } from 'lucide-react'; // Added icons for planning, including Leaf
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar as ShadCalendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Added Tabs
import { Slider } from "@/components/ui/slider"; // Added Slider

// Define interfaces based on Firestore structure
interface Place {
  name: string;
  coordinate?: { lat: number | null; lng: number | null };
  country: string;
}

interface Travel {
  id?: string; // Firestore document ID
  groupId: string | null;
  userId: string | null;
  preferences: string[]; // Will store mood, activity/activityOther
  dateRange?: { start: Timestamp; end: Timestamp } | null; // Optional
  durationDays?: number; // Optional duration in days
  places?: Place[]; // Optional
  createdAt: Timestamp;
}

// --- Emotional Planning Constants ---
const MOOD_OPTIONS = [
    { value: "relaxed", label: "Relaxed", icon: <Smile className="h-4 w-4" /> },
    { value: "adventurous", label: "Adventurous", icon: <Mountain className="h-4 w-4" /> },
    { value: "cultural", label: "Cultural", icon: <Film className="h-4 w-4" /> },
    { value: "social", label: "Social", icon: <Users className="h-4 w-4" /> },
    { value: "nature", label: "Nature", icon: <Leaf className="h-4 w-4" /> }, // Using imported Leaf icon
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


// Define Zod schema for the new travel form validation (including emotional planning)
const travelFormSchema = z.object({
  // Mode 1: Guided Sliders
  mood: z.string().refine(val => MOOD_OPTIONS.some(opt => opt.value === val), { message: "Please select a valid mood." }).optional(),
  activity: z.string().refine(val => ACTIVITY_OPTIONS.some(opt => opt.value === val), { message: "Please select a valid activity." }).optional(),
  activityOther: z.string().optional(),
  durationDays: z.number().min(1, "Duration must be at least 1 day.").max(MAX_DURATION_DAYS).optional(),
  // OR Date Range
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
  // Mode 2: AI (for future use, keep schema simple for now)
  aiPrompt: z.string().optional(),
  // Preferences string[] will be constructed on submit
  // places: z.array(z.object({ name: z.string(), country: z.string() })).optional(),
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
    // Require at least one planning input (mood, activity, durationDays OR date range)
    const hasMood = !!data.mood;
    const hasActivity = !!data.activity;
    const hasDurationDays = data.durationDays !== undefined && data.durationDays !== null && data.durationDays > 0;
    const hasDateRange = data.startDate !== undefined && data.startDate !== null && data.endDate !== undefined && data.endDate !== null;
    // Check if either mode 1 fields are present OR AI prompt exists (future)
    return hasMood || hasActivity || hasDurationDays || hasDateRange || !!data.aiPrompt;
}, {
    message: "Please provide at least one preference (Mood, Activity, Duration/Dates).",
    path: ["mood"], // Assign error message to one field for simplicity
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

export default function MyTravelsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [myTravels, setMyTravels] = useState<Travel[]>([]);
  const [loadingTravels, setLoadingTravels] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for Mode 1 (Sliders)
  const [moodSliderValue, setMoodSliderValue] = useState(0);
  const [activitySliderValue, setActivitySliderValue] = useState(0);
  const [durationSliderValue, setDurationSliderValue] = useState([5]); // Default 5 days

  const form = useForm<TravelFormValues>({
    resolver: zodResolver(travelFormSchema),
    defaultValues: {
      mood: undefined,
      activity: undefined,
      activityOther: '',
      durationDays: 5, // Default value syncs with slider
      startDate: null,
      endDate: null,
      aiPrompt: '',
    },
  });

  // --- Effect for Authentication Check ---
   useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);


  // --- Effect for Fetching Individual Travels ---
  useEffect(() => {
    const fetchMyTravels = async () => {
      if (user?.uid) {
        setLoadingTravels(true);
        try {
          const travelsCollection = collection(db, 'travels');
          // Query for travels where userId matches and groupId is null
          const q = query(travelsCollection, where('userId', '==', user.uid), where('groupId', '==', null));
          const querySnapshot = await getDocs(q);
          const travelsList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as Travel[];
          setMyTravels(travelsList);
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
    };

    if (!authLoading && isAuthenticated && user) {
      fetchMyTravels();
    }
  }, [user, isAuthenticated, authLoading, toast]);

  // --- Form Submission ---
  const onSubmit: SubmitHandler<TravelFormValues> = async (data) => {
     if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to add a travel plan.' });
        return;
    }
    setIsSubmitting(true);

    // Construct preferences array
    const preferences: string[] = [];
    if (data.mood) preferences.push(`mood:${data.mood}`);
    if (data.activity === 'other' && data.activityOther) {
        preferences.push(`activity:other:${data.activityOther}`);
    } else if (data.activity) {
        preferences.push(`activity:${data.activity}`);
    }
    // Add more complex logic here if needed based on AI mode in the future

    try {
       const travelToAdd: Omit<Travel, 'id'> = {
        userId: user.uid,
        groupId: null,
        preferences: preferences, // Use constructed preferences
        dateRange: data.startDate && data.endDate ? {
            start: Timestamp.fromDate(data.startDate),
            end: Timestamp.fromDate(data.endDate)
        } : null,
        durationDays: (data.startDate && data.endDate) ? undefined : data.durationDays, // Only store duration if no date range
        places: [], // Start with empty places for now
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, 'travels'), travelToAdd);
      toast({
        title: 'Travel Plan Added!',
        description: `Your new travel plan has been saved.`,
      });

      // Add the new travel to the local state
      setMyTravels(prev => [...prev, { ...travelToAdd, id: docRef.id, createdAt: travelToAdd.createdAt }]);

      form.reset({ // Reset form with defaults
          mood: undefined,
          activity: undefined,
          activityOther: '',
          durationDays: 5,
          startDate: null,
          endDate: null,
          aiPrompt: '',
      });
      setMoodSliderValue(0);
      setActivitySliderValue(0);
      setDurationSliderValue([5]);
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
        // Reset 'other' field if not selected
        if (ACTIVITY_OPTIONS[index]?.value !== 'other') {
            form.setValue('activityOther', '', { shouldValidate: true });
        }
    };

    const handleDurationSliderChange = (value: number[]) => {
        setDurationSliderValue(value);
        form.setValue('durationDays', value[0], { shouldValidate: true });
        // Clear date range if duration is set
        form.setValue('startDate', null, { shouldValidate: true });
        form.setValue('endDate', null, { shouldValidate: true });
    };

    const handleDateChange = (date: Date | undefined, field: 'startDate' | 'endDate') => {
        form.setValue(field, date, { shouldValidate: true });
        // Clear duration days if date range is set
        if (form.getValues('startDate') && form.getValues('endDate')) {
             form.setValue('durationDays', undefined, { shouldValidate: true });
             setDurationSliderValue([1]); // Reset slider visual, maybe not needed?
        }
    }


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
        <h1 className="text-3xl font-bold flex items-center gap-2"><User className="h-8 w-8 text-primary"/> My Individual Travels</h1>
        {/* --- Add New Travel Dialog --- */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Plan New Trip
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]"> {/* Increased width */}
            <DialogHeader>
              <DialogTitle className="text-2xl">Plan Your Next Adventure</DialogTitle>
              <DialogDescription>
                Tell us about your dream trip using the options below.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="guided" className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="guided"><SlidersHorizontal className="mr-2 h-4 w-4"/>Guided</TabsTrigger>
                <TabsTrigger value="ai" disabled><Wand2 className="mr-2 h-4 w-4"/>AI Assistant (Coming Soon)</TabsTrigger>
              </TabsList>

              {/* --- Mode 1: Guided Planning (Sliders) --- */}
              <TabsContent value="guided">
                 <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
                     {/* Mood Slider */}
                    <div className="space-y-3">
                      <Label htmlFor="mood-slider" className="flex items-center gap-1 text-lg font-semibold"><Smile className="h-5 w-5"/>Mood</Label>
                      <Controller
                        name="mood" // Control the 'mood' field
                        control={form.control}
                        render={({ field }) => (
                            <>
                            <Slider
                                id="mood-slider"
                                min={0}
                                max={MOOD_OPTIONS.length - 1}
                                step={1}
                                value={[moodSliderValue]}
                                onValueChange={handleMoodSliderChange}
                                className={cn("w-[95%] mx-auto")}
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
                             <p className="text-center text-lg font-medium mt-2">
                                 {MOOD_OPTIONS[moodSliderValue]?.icon} {MOOD_OPTIONS[moodSliderValue]?.label}
                             </p>
                            </>
                        )}
                      />
                      {form.formState.errors.mood && <p className="text-sm text-destructive text-center">{form.formState.errors.mood.message}</p>}
                    </div>

                    {/* Activity Slider */}
                    <div className="space-y-3">
                        <Label htmlFor="activity-slider" className="flex items-center gap-1 text-lg font-semibold"><Mountain className="h-5 w-5"/>Activity</Label>
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
                                     className={cn("w-[95%] mx-auto")}
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
                                 <p className="text-center text-lg font-medium mt-2">
                                     {ACTIVITY_OPTIONS[activitySliderValue]?.icon} {ACTIVITY_OPTIONS[activitySliderValue]?.label}
                                 </p>
                                </>
                            )}
                        />
                        {/* Conditional 'Other' Input */}
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
                         <Label className="flex items-center gap-1 text-lg font-semibold"><CalendarDays className="h-5 w-5"/>Duration</Label>
                         {/* Date Range */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate">Start Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !form.watch('startDate') && "text-muted-foreground"
                                        )}
                                        disabled={isSubmitting}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {form.watch('startDate') ? format(form.watch('startDate')!, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                    <ShadCalendar
                                        mode="single"
                                        selected={form.watch('startDate') ?? undefined}
                                        onSelect={(date) => handleDateChange(date, 'startDate')}
                                        initialFocus
                                    />
                                    </PopoverContent>
                                </Popover>
                                {form.formState.errors.startDate && <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endDate">End Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !form.watch('endDate') && "text-muted-foreground"
                                        )}
                                        disabled={isSubmitting || !form.watch('startDate')} // Disable if no start date
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {form.watch('endDate') ? format(form.watch('endDate')!, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                    <ShadCalendar
                                        mode="single"
                                        selected={form.watch('endDate') ?? undefined}
                                        onSelect={(date) => handleDateChange(date, 'endDate')}
                                        disabled={(date) =>
                                            form.watch('startDate') ? date < form.watch('startDate')! : false
                                        }
                                        initialFocus
                                    />
                                    </PopoverContent>
                                </Popover>
                                {form.formState.errors.endDate && <p className="text-sm text-destructive">{form.formState.errors.endDate.message}</p>}
                            </div>
                         </div>

                        {/* Duration Slider - Conditionally rendered or just shown */}
                        <div className="space-y-3 pt-4">
                             <Label htmlFor="duration-slider" className="text-center block text-sm text-muted-foreground">Or select number of days</Label>
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
                                        disabled={isSubmitting || (!!form.watch('startDate') && !!form.watch('endDate'))} // Disable if date range is set
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


                    {/* General Error Message for missing fields */}
                     {form.formState.errors.mood && form.formState.errors.mood.type === 'refine' && (
                        <p className="text-sm text-destructive text-center font-semibold">{form.formState.errors.mood.message}</p>
                     )}


                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isSubmitting ? 'Saving...' : 'Save Travel Plan'}
                        </Button>
                    </DialogFooter>
                 </form>
              </TabsContent>

              {/* --- Mode 2: AI Assistant --- */}
              <TabsContent value="ai">
                <div className="py-10 text-center">
                  <Wand2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">AI Assistant feature coming soon!</p>
                  {/* Add AI chat interface here later */}
                </div>
              </TabsContent>
            </Tabs>

          </DialogContent>
        </Dialog>
      </div>

      {/* Display User's Individual Travels */}
      {loadingTravels ? (
        <div className="text-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your travel plans...</p>
        </div>
      ) : myTravels.length === 0 ? (
         <Card className="text-center py-12 shadow-md">
          <CardHeader>
             <PlaneTakeoff className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>No Solo Trips Planned Yet</CardTitle>
            <CardDescription>Start planning your next solo adventure!</CardDescription>
          </CardHeader>
          <CardContent>
             <Button onClick={() => setIsAddDialogOpen(true)}>
               <PlusCircle className="mr-2 h-4 w-4" /> Plan Your First Solo Trip
             </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myTravels.map((travel) => {
             // Helper to parse preferences
             const getPreference = (key: string): string | undefined => {
                 const pref = travel.preferences.find(p => p.startsWith(`${key}:`));
                 return pref ? pref.split(':').slice(1).join(':') : undefined;
             };
             const mood = getPreference('mood');
             const activity = getPreference('activity');
             const activityOther = activity?.startsWith('other:') ? activity.substring(6) : undefined;
             const displayActivity = activityOther ? `Other (${activityOther})` : activity;

             return (
                <Card key={travel.id} className="shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col">
                <CardHeader>
                    <CardTitle>Trip Plan #{travel.id?.substring(0, 6)}...</CardTitle>
                    <CardDescription>
                    Created: {travel.createdAt.toDate().toLocaleDateString()}
                    </CardDescription>
                    {/* Display Date Range or Duration */}
                     {(travel.dateRange) ? (
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="h-4 w-4"/>
                            {format(travel.dateRange.start.toDate(), "PP")} - {format(travel.dateRange.end.toDate(), "PP")}
                        </p>
                     ) : travel.durationDays ? (
                         <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <CalendarDays className="h-4 w-4"/>
                            {travel.durationDays} day{travel.durationDays !== 1 ? 's' : ''}
                         </p>
                     ) : null}
                </CardHeader>
                <CardContent className="flex-grow">
                    {/* Display Mood and Activity */}
                    <div className="space-y-2">
                        {mood && (
                             <p className="text-sm flex items-center gap-1">
                                 <Smile className="h-4 w-4 text-primary"/> Mood: <span className="font-medium capitalize">{mood}</span>
                             </p>
                        )}
                         {displayActivity && (
                             <p className="text-sm flex items-center gap-1">
                                 <Mountain className="h-4 w-4 text-primary"/> Activity: <span className="font-medium capitalize">{displayActivity}</span>
                             </p>
                        )}
                        {/* Display other preferences if needed */}
                         {travel.preferences.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length > 0 && (
                             <div className="mt-1">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1"><Heart className="h-3 w-3"/>Other Prefs</h4>
                                <div className="flex flex-wrap gap-1">
                                 {travel.preferences.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).slice(0, 5).map((pref, index) => (
                                    <span key={index} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{pref}</span>
                                 ))}
                                 {travel.preferences.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length > 5 && <span className="text-xs text-muted-foreground">...</span>}
                                </div>
                             </div>
                         )}
                    </div>
                    {/* Display Places */}
                    {travel.places && travel.places.length > 0 && (
                        <div className="mt-3">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="h-3 w-3"/>Places</h4>
                            <div className="flex flex-wrap gap-1">
                                {travel.places.slice(0, 3).map((place, index) => (
                                    <span key={index} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{place.name}, {place.country}</span>
                                ))}
                                {travel.places.length > 3 && <span className="text-xs text-muted-foreground">...</span>}
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-end pt-4">
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
    
    