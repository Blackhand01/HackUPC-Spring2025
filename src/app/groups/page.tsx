
// src/app/groups/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, getDocs, addDoc, Timestamp, arrayUnion, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Users, Link as LinkIcon, Share2, PlaneTakeoff, Calendar, Heart, MapPin, Smile, Mountain, Film, Utensils, Leaf, CalendarDays, Info, LocateFixed } from 'lucide-react';
import { CopyToClipboard } from '@/components/functional/CopyToClipboard';
import { format } from 'date-fns';
import { type Group, type Travel } from '@/types'; // Import shared types

// Define Zod schema for the new group form
const groupFormSchema = z.object({
  groupName: z.string().min(3, 'Group name must be at least 3 characters'),
});

type GroupFormValues = z.infer<typeof groupFormSchema>;

export default function GroupsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [associatedTravels, setAssociatedTravels] = useState<{ [groupId: string]: Travel[] }>({});
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingTravels, setLoadingTravels] = useState<{ [groupId: string]: boolean }>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      groupName: '',
    },
  });

  // --- Authentication Check ---
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);


   // --- Fetch Travels Associated with a Specific Group ---
   const fetchAssociatedTravelsForGroup = useCallback(async (groupId: string) => {
        setLoadingTravels(prev => ({ ...prev, [groupId]: true }));
        try {
            const travelsCollection = collection(db, 'travels');
            // Ensure groupId is valid before querying
            if (!groupId || typeof groupId !== 'string') {
                console.warn("Invalid groupId provided for fetching travels:", groupId);
                 setAssociatedTravels(prev => ({ ...prev, [groupId || 'invalid']: [] })); // Handle invalid ID case
                return;
            }
            const q = query(travelsCollection, where('groupId', '==', groupId));
            const querySnapshot = await getDocs(q);
            const travelsList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as Travel[];

            setAssociatedTravels(prev => ({
                ...prev,
                [groupId]: travelsList,
            }));

        } catch (error) {
            console.error(`Error fetching travels for group ${groupId}:`, error);
            toast({
                variant: 'destructive',
                title: 'Error Fetching Group Travels',
                description: `Could not load travels for group ${groupId}.`,
            });
             setAssociatedTravels(prev => ({
                ...prev,
                [groupId]: [], // Set to empty array on error
            }));
        } finally {
            setLoadingTravels(prev => ({ ...prev, [groupId]: false }));
        }
  }, [toast]); // Removed groupId from dependency array as it's an argument


  // --- Fetch User's Groups ---
  const fetchGroups = useCallback(async () => {
      if (user?.uid) {
          setLoadingGroups(true);
          setAssociatedTravels({});
          setLoadingTravels({});
          try {
              const groupsCollection = collection(db, 'groups');
              const q = query(groupsCollection, where('users', 'array-contains', user.uid));
              const querySnapshot = await getDocs(q);
              const groupsList = querySnapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data(),
              })) as Group[];
              setMyGroups(groupsList);
              if (groupsList.length > 0) {
                   // Fetch travels for each valid group ID
                   groupsList.forEach(group => {
                       if (group.id) {
                           fetchAssociatedTravelsForGroup(group.id);
                       } else {
                            console.warn("Group found without an ID:", group);
                       }
                   });
              }
          } catch (error) {
              console.error('Error fetching groups:', error);
              toast({
                  variant: 'destructive',
                  title: 'Error Fetching Groups',
                  description: 'Could not load your groups. Please try again later.',
              });
          } finally {
              setLoadingGroups(false);
          }
      } else if (!authLoading) {
          setLoadingGroups(false);
      }
  }, [user, authLoading, toast, fetchAssociatedTravelsForGroup]); // Added fetchAssociatedTravelsForGroup dependency


  // --- Initial Data Fetch ---
  useEffect(() => {
      if (!authLoading && isAuthenticated && user) {
          fetchGroups();
      }
  }, [authLoading, isAuthenticated, user, fetchGroups]);


  // --- Handle Invite Link ---
  useEffect(() => {
    const joinGroupId = searchParams.get('joinGroup');
    if (joinGroupId && user && isAuthenticated && !loadingGroups) {
       const isAlreadyMember = myGroups.some(group => group.id === joinGroupId);

      if (!isAlreadyMember) {
        const joinGroup = async () => {
          try {
            const groupRef = doc(db, 'groups', joinGroupId);
            const groupSnap = await getDoc(groupRef);
            if (!groupSnap.exists()) {
                 toast({ variant: 'destructive', title: 'Group Not Found', description: 'The invite link is invalid or the group may have been deleted.' });
                 router.replace('/groups');
                 return;
            }

            await updateDoc(groupRef, {
              users: arrayUnion(user.uid)
            });
            toast({ title: 'Joined Group!', description: `You've been added to the group.` });
            fetchGroups(); // Re-fetch groups after joining
          } catch (error) {
            console.error("Error joining group:", error);
            toast({ variant: 'destructive', title: 'Error Joining Group', description: 'Could not join the group. Please try the link again.' });
          } finally {
             // Always remove the query param after attempting to join
             router.replace('/groups');
          }
        };
        joinGroup();
      } else {
         if (isAlreadyMember) {
             toast({ title: 'Already a Member', description: 'You are already part of this group.' });
         }
          // Always remove the query param if already a member or after handling
         router.replace('/groups');
      }
    }
     // Ensure effect only runs when relevant params/state change
  }, [searchParams, user, isAuthenticated, loadingGroups, router, toast, fetchGroups, myGroups]);


  // --- Form Submission to Create Group ---
  const onSubmit: SubmitHandler<GroupFormValues> = async (data) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to create a group.' });
      return;
    }
    setIsSubmitting(true);

    try {
      // Explicitly define the type for the object being added
      const groupData: Omit<Group, 'id'> = {
        groupName: data.groupName,
        createBy: user.uid,
        createAt: Timestamp.now(),
        users: [user.uid],
      };

      const docRef = await addDoc(collection(db, 'groups'), groupData);
      toast({
        title: 'Group Created!',
        description: `Group "${data.groupName}" has been successfully created.`,
      });

      // Construct the new group object correctly, ensuring createAt is a Timestamp
      const newGroup: Group = {
          id: docRef.id,
          groupName: groupData.groupName,
          createBy: groupData.createBy,
          createAt: groupData.createAt, // Directly use the Timestamp
          users: groupData.users,
      };

      setMyGroups(prev => [...prev, newGroup]);
      // Initialize travels for the new group as empty and not loading
      setAssociatedTravels(prev => ({ ...prev, [newGroup.id!]: [] }));
      setLoadingTravels(prev => ({ ...prev, [newGroup.id!]: false }));


      form.reset();
      setIsAddDialogOpen(false);

    } catch (error) {
      console.error('Error adding group:', error);
      toast({
        variant: 'destructive',
        title: 'Error Creating Group',
        description: 'Failed to create group. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

   // --- Generate Invite Link ---
   const generateInviteLink = (groupId: string): string => {
       // Check if window is defined (runs only on client)
       if (typeof window === 'undefined' || !groupId) return '';
       const baseUrl = window.location.origin;
       return `${baseUrl}/groups?joinGroup=${groupId}`;
   };

   // --- Share Handlers ---
   const shareOnWhatsApp = (link: string, groupName: string) => {
        if (typeof window === 'undefined') return;
       const text = encodeURIComponent(`Join my travel group "${groupName}" on OnlyFly! ${link}`);
       window.open(`https://wa.me/?text=${text}`, '_blank');
   };

   const shareOnTelegram = (link: string, groupName: string) => {
       if (typeof window === 'undefined') return;
       const text = encodeURIComponent(`Join my travel group "${groupName}" on OnlyFly!`);
       window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`, '_blank');
   };

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
                case 'beach': return <PlaneTakeoff className="h-4 w-4 text-primary"/>;
                case 'nightlife': return <Users className="h-4 w-4 text-primary"/>;
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

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Users className="h-8 w-8 text-primary"/> Your Travel Groups</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create a New Group</DialogTitle>
               <DialogDescription>
                 Enter a name for your new travel group.
               </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">Group Name</Label>
                <Input
                  id="groupName"
                  placeholder="e.g., Summer EuroTrip 2025"
                  {...form.register('groupName')}
                  aria-invalid={form.formState.errors.groupName ? 'true' : 'false'}
                  disabled={isSubmitting}
                />
                {form.formState.errors.groupName && <p className="text-sm text-destructive">{form.formState.errors.groupName.message}</p>}
              </div>
              <DialogFooter>
                 <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Creating...' : 'Create Group'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

       {loadingGroups ? (
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading your groups...</p>
          </div>
        ) : myGroups.length === 0 ? (
         <Card className="text-center py-12 shadow-md">
          <CardHeader>
             <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>No Groups Yet</CardTitle>
            <CardDescription>Start planning your next adventure by creating or joining a travel group!</CardDescription>
          </CardHeader>
          <CardContent>
             <Button onClick={() => setIsAddDialogOpen(true)}>
               <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Group
             </Button>
          </CardContent>
        </Card>
      ) : (
         <div className="space-y-6">
            {myGroups.map((group) => {
                 // Ensure group.id exists before generating link or fetching travels
                 if (!group.id) {
                     console.warn("Rendering group without ID:", group);
                     return null; // Skip rendering groups without IDs
                 }
                 const inviteLink = generateInviteLink(group.id);
                 const travelsForGroup = associatedTravels[group.id] || [];
                 const isLoadingThisGroupTravels = loadingTravels[group.id] === true;
                 // Safely format creation date
                 const formattedCreateDate = group.createAt?.toDate ? group.createAt.toDate().toLocaleDateString() : 'N/A';


                return (
                <Card key={group.id} className="shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <CardTitle className="truncate">{group.groupName}</CardTitle>
                                <CardDescription>
                                    {group.users?.length ?? 0} member{(group.users?.length ?? 0) !== 1 ? 's' : ''} | Created: {formattedCreateDate}
                                </CardDescription>
                            </div>
                              <div className="flex items-center flex-shrink-0 gap-1 md:gap-2">
                                  <CopyToClipboard textToCopy={inviteLink}>
                                      <Button variant="outline" size="sm" className="px-2">
                                          <LinkIcon className="h-4 w-4 md:mr-1"/>
                                          <span className="hidden md:inline">Copy</span>
                                      </Button>
                                  </CopyToClipboard>
                                  <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" className="px-2"><Share2 className="h-4 w-4 md:mr-1"/>
                                             <span className="hidden md:inline">Share</span>
                                             </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[350px]">
                                            <DialogHeader>
                                                <DialogTitle>Share Invite Link</DialogTitle>
                                                <DialogDescription>Invite others to "{group.groupName}"</DialogDescription>
                                            </DialogHeader>
                                            <div className="flex flex-col gap-3 py-4">
                                                <Input value={inviteLink} readOnly className="text-xs" />
                                                 <Button onClick={() => shareOnWhatsApp(inviteLink, group.groupName)} className="bg-green-500 hover:bg-green-600">
                                                    Share on WhatsApp
                                                </Button>
                                                <Button onClick={() => shareOnTelegram(inviteLink, group.groupName)} className="bg-blue-500 hover:bg-blue-600">
                                                    Share on Telegram
                                                </Button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><PlaneTakeoff className="h-5 w-5 text-primary"/>Associated Trips</h3>
                          {isLoadingThisGroupTravels ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-muted-foreground text-sm">Loading trips...</span>
                              </div>
                         ) : travelsForGroup.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No trips planned for this group yet.</p>
                         ) : (
                             <div className="space-y-3">
                                {travelsForGroup.map(travel => {
                                    const mood = getPreference(travel.preferences, 'mood');
                                    const activityRaw = getPreference(travel.preferences, 'activity');
                                    const activityOther = activityRaw?.startsWith('other:') ? activityRaw.substring(6) : undefined;
                                    const activity = activityOther ? `Other (${activityOther})` : activityRaw;

                                     // Safely format dates using optional chaining
                                     const formattedStartDate = travel.dateRange?.start?.toDate ? format(travel.dateRange.start.toDate(), "PP") : null;
                                     const formattedEndDate = travel.dateRange?.end?.toDate ? format(travel.dateRange.end.toDate(), "PP") : null;


                                    return (
                                        <div key={travel.id} className="border p-3 rounded-md bg-secondary/50">
                                            <p className="text-sm font-medium text-secondary-foreground mb-1.5">Trip Plan <span className="font-mono text-xs bg-background px-1 py-0.5 rounded">#{travel.id?.substring(0, 6)}</span></p>
                                            <div className="space-y-1 text-xs text-muted-foreground">
                                                 <p className="flex items-center gap-1">
                                                     <LocateFixed className="h-3 w-3"/>
                                                     Departing from: <span className="font-medium text-foreground">{travel.departureCity}</span>
                                                 </p>
                                                 {(formattedStartDate && formattedEndDate) ? (
                                                    <p className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3"/>
                                                        {formattedStartDate} - {formattedEndDate}
                                                    </p>
                                                ) : travel.durationDays ? (
                                                    <p className="flex items-center gap-1">
                                                        <CalendarDays className="h-3 w-3"/>
                                                        {travel.durationDays} day{travel.durationDays !== 1 ? 's' : ''}
                                                    </p>
                                                ) : null}
                                                {mood && (
                                                    <p className="flex items-center gap-1 capitalize">
                                                        {getPreferenceIcon('mood', mood)} Mood: <span className="font-medium text-foreground">{mood}</span>
                                                    </p>
                                                )}
                                                {activity && (
                                                    <p className="flex items-center gap-1 capitalize">
                                                        {getPreferenceIcon('activity', activityRaw)} Activity: <span className="font-medium text-foreground">{activity}</span>
                                                    </p>
                                                )}
                                                {travel.preferences?.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length > 0 && (
                                                    <div className="flex items-start gap-1 pt-1">
                                                        <Heart className="h-3 w-3 mt-0.5 flex-shrink-0"/>
                                                        <div className="flex flex-wrap gap-1">
                                                            {travel.preferences.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).slice(0, 4).map((pref, index) => (
                                                                <span key={index} className="text-xs bg-background text-foreground px-1.5 py-0.5 rounded-full">{pref}</span>
                                                            ))}
                                                            {travel.preferences.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length > 4 && <span className="text-xs text-muted-foreground">...</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                             </div>
                         )}
                    </CardContent>
                     <CardFooter className="flex justify-end pt-4 border-t mt-4">
                         <Button variant="secondary" size="sm" onClick={() => router.push(`/matches?groupId=${group.id}`)}>
                              <PlusCircle className="mr-2 h-4 w-4" /> Plan Trip for Group
                         </Button>
                    </CardFooter>
                </Card>
                )
            })}
         </div>
        )}
    </div>
  );
}

    