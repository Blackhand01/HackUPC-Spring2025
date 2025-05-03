// src/app/matches/page.tsx - Refactored for "My Travels / Find Swap"
'use client';

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, getDocs, addDoc, Timestamp, GeoPoint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, PlusCircle, PlaneTakeoff, Calendar, MapPin, Heart, User, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar as ShadCalendar } from "@/components/ui/calendar"; // Rename Calendar import
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Define interfaces based on Firestore structure
interface Place {
  name: string;
  coordinate?: { lat: number | null; lng: number | null }; // Make coordinate optional as per schema
  country: string;
}

interface Travel {
  id?: string; // Firestore document ID
  groupId: string | null;
  userId: string | null;
  preferences: string[];
  dateRange?: { start: Timestamp; end: Timestamp } | null; // Optional
  places?: Place[]; // Optional
  createdAt: Timestamp;
}

// Define Zod schema for the new travel form validation
const travelFormSchema = z.object({
  preferences: z.string().min(3, 'Please list at least one preference (e.g., beach, hiking, city).'),
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
  // For simplicity, places will be handled separately or in a future iteration
  // places: z.array(z.object({ name: z.string(), country: z.string() })).optional(),
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

  const form = useForm<TravelFormValues>({
    resolver: zodResolver(travelFormSchema),
    defaultValues: {
      preferences: '',
      startDate: null,
      endDate: null,
      // places: [],
    },
  });

  // Effect for Authentication Check
   useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);


  // Effect for Fetching Individual Travels
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

  const onSubmit: SubmitHandler<TravelFormValues> = async (data) => {
     if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to add a travel plan.' });
        return;
    }
    setIsSubmitting(true);

    try {
       const travelToAdd: Omit<Travel, 'id'> = {
        userId: user.uid,
        groupId: null,
        preferences: data.preferences.split(',').map(item => item.trim()).filter(Boolean),
        dateRange: data.startDate && data.endDate ? {
            start: Timestamp.fromDate(data.startDate),
            end: Timestamp.fromDate(data.endDate)
        } : null,
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

      form.reset();
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

  // Loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  // Render page content if authenticated
  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2"><User className="h-8 w-8 text-primary"/> My Individual Travels</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Plan New Trip
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-2xl">Plan a New Solo Trip</DialogTitle>
              <DialogDescription>
                Add details about your desired trip to find potential swaps later or just keep track.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
              {/* Preferences */}
              <div className="space-y-2">
                 <Label htmlFor="preferences" className="flex items-center gap-1"><Heart className="h-4 w-4"/>Preferences (comma-separated)</Label>
                <Textarea
                  id="preferences"
                  placeholder="e.g., beach, mountains, city break, relaxing, adventure"
                  {...form.register('preferences')}
                   aria-invalid={form.formState.errors.preferences ? 'true' : 'false'}
                   disabled={isSubmitting}
                   rows={3}
                />
                {form.formState.errors.preferences && <p className="text-sm text-destructive">{form.formState.errors.preferences.message}</p>}
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                     <Label htmlFor="startDate" className="flex items-center gap-1"><Calendar className="h-4 w-4"/>Start Date (Optional)</Label>
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
                            selected={form.watch('startDate')}
                            onSelect={(date) => form.setValue('startDate', date, { shouldValidate: true })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {form.formState.errors.startDate && <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>}
                  </div>
                 <div className="space-y-2">
                    <Label htmlFor="endDate" className="flex items-center gap-1"><Calendar className="h-4 w-4"/>End Date (Optional)</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !form.watch('endDate') && "text-muted-foreground"
                            )}
                            disabled={isSubmitting}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {form.watch('endDate') ? format(form.watch('endDate')!, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                           <ShadCalendar
                            mode="single"
                            selected={form.watch('endDate')}
                            onSelect={(date) => form.setValue('endDate', date, { shouldValidate: true })}
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

                {/* Future: Add Places Input */}
                 <div className="space-y-2">
                    <Label className="flex items-center gap-1"><MapPin className="h-4 w-4"/>Destinations (Optional)</Label>
                    <p className="text-sm text-muted-foreground">Ability to add specific destinations coming soon!</p>
                    {/* Input for places will go here later */}
                 </div>


              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Saving...' : 'Save Travel Plan'}
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
          {myTravels.map((travel) => (
            <Card key={travel.id} className="shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col">
              <CardHeader>
                <CardTitle>Trip Plan #{travel.id?.substring(0, 6)}...</CardTitle> {/* Short ID for title */}
                <CardDescription>
                  Created: {travel.createdAt.toDate().toLocaleDateString()}
                </CardDescription>
                 {travel.dateRange && (
                    <p className="text-sm text-muted-foreground mt-1">
                        <Calendar className="inline-block h-4 w-4 mr-1"/>
                        {format(travel.dateRange.start.toDate(), "PP")} - {format(travel.dateRange.end.toDate(), "PP")}
                    </p>
                 )}
              </CardHeader>
              <CardContent className="flex-grow">
                  {travel.preferences.length > 0 && (
                  <div className="mt-1">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1"><Heart className="h-3 w-3"/>Preferences</h4>
                    <div className="flex flex-wrap gap-1">
                      {travel.preferences.slice(0, 5).map((pref, index) => ( // Show max 5 preferences
                        <span key={index} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{pref}</span>
                      ))}
                       {travel.preferences.length > 5 && <span className="text-xs text-muted-foreground">...</span>}
                    </div>
                  </div>
                )}
                {/* Optionally display places if available */}
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
                  {/* Add Edit/Delete buttons later */}
                  <Button variant="outline" size="sm">View Details</Button>
               </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

    