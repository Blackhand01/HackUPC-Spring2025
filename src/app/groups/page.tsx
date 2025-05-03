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
import { Loader2, PlusCircle, Users, Link as LinkIcon, Share2, PlaneTakeoff, Calendar, Heart, MapPin, Smile, Mountain, Film, Utensils, Leaf, CalendarDays } from 'lucide-react'; // Added emotional planning icons
import { CopyToClipboard } from '@/components/functional/CopyToClipboard';
import { format } from 'date-fns';

// Interfaces (consider moving to a shared types file)
interface Group {
  id?: string; // Firestore document ID
  groupName: string;
  createBy: string; // userId
  createAt: Timestamp;
  users: string[]; // Array of userIds
}

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
  const [loadingTravels, setLoadingTravels] = useState<{ [groupId: string]: boolean }>({}); // Track loading per group
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


  // --- Fetch User's Groups ---
  const fetchGroups = useCallback(async () => {
      if (user?.uid) {
          setLoadingGroups(true);
          setAssociatedTravels({}); // Reset travels
          setLoadingTravels({}); // Reset travel loading state
          try {
              const groupsCollection = collection(db, 'groups');
              const q = query(groupsCollection, where('users', 'array-contains', user.uid));
              const querySnapshot = await getDocs(q);
              const groupsList = querySnapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data(),
              })) as Group[];
              setMyGroups(groupsList);
              // After fetching groups, fetch associated travels for each group
              if (groupsList.length > 0) {
                   groupsList.forEach(group => fetchAssociatedTravelsForGroup(group.id!));
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
  }, [user, authLoading, toast]); // Added fetchAssociatedTravelsForGroup to dependencies? No, called internally.

  // --- Fetch Travels Associated with a Specific Group ---
   const fetchAssociatedTravelsForGroup = useCallback(async (groupId: string) => {
        setLoadingTravels(prev => ({ ...prev, [groupId]: true }));
        try {
            const travelsCollection = collection(db, 'travels');
            // Query travels where groupId matches the specific group ID
            const q = query(travelsCollection, where('groupId', '==', groupId));
            const querySnapshot = await getDocs(q);
            const travelsList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as Travel[];

            // Update the state for this specific group
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
            // Set empty array on error for this group to avoid infinite loading look
             setAssociatedTravels(prev => ({
                ...prev,
                [groupId]: [],
            }));
        } finally {
            setLoadingTravels(prev => ({ ...prev, [groupId]: false }));
        }
  }, [toast]);


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
      // Check if user is already in the group AFTER groups have loaded
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
            fetchGroups(); // Refetch groups to include the newly joined one
          } catch (error) {
            console.error("Error joining group:", error);
            toast({ variant: 'destructive', title: 'Error Joining Group', description: 'Could not join the group. Please try the link again.' });
          } finally {
             router.replace('/groups'); // Remove query param regardless of success/fail after attempt
          }
        };
        joinGroup();
      } else {
         if (isAlreadyMember) {
             toast({ title: 'Already a Member', description: 'You are already part of this group.' });
         }
         router.replace('/groups'); // Remove query param if already member or other issues
      }
    }
     // Reduced dependency array: only react when searchParams or user/auth state solidifies
  }, [searchParams, user, isAuthenticated, loadingGroups, router, toast, fetchGroups, myGroups]);


  // --- Form Submission to Create Group ---
  const onSubmit: SubmitHandler<GroupFormValues> = async (data) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to create a group.' });
      return;
    }
    setIsSubmitting(true);

    try {
      const groupToAdd: Omit<Group, 'id'> = {
        groupName: data.groupName,
        createBy: user.uid,
        createAt: Timestamp.now(),
        users: [user.uid], // Creator is the first member
      };

      const docRef = await addDoc(collection(db, 'groups'), groupToAdd);
      toast({
        title: 'Group Created!',
        description: `Group "${data.groupName}" has been successfully created.`,
      });

      // Add the new group to the local state & initialize travels/loading state for it
      const newGroup = { ...groupToAdd, id: docRef.id, createAt: groupToAdd.createAt };
      setMyGroups(prev => [...prev, newGroup]);
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
       // Ensure this runs only client-side
       if (typeof window === 'undefined') return '';
       const baseUrl = window.location.origin;
       return `${baseUrl}/groups?joinGroup=${groupId}`;
   };

   // --- Share Handlers (Basic Examples) ---
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

      {/* Display Groups */}
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
                 const inviteLink = generateInviteLink(group.id!);
                 const travelsForGroup = associatedTravels[group.id!] || [];
                 const isLoadingThisGroupTravels = loadingTravels[group.id!] === true; // Check specific group loading

                return (
                <Card key={group.id} className="shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                        <div className="flex justify-between items-start gap-4">
                            {/* Group Info */}
                            <div className="flex-1 min-w-0"> {/* Added flex-1 and min-w-0 */}
                                <CardTitle className="truncate">{group.groupName}</CardTitle> {/* Added truncate */}
                                <CardDescription>
                                    {group.users.length} member{group.users.length !== 1 ? 's' : ''} | Created: {group.createAt?.toDate().toLocaleDateString() ?? 'N/A'}
                                </CardDescription>
                            </div>
                             {/* Share/Invite Section */}
                              <div className="flex items-center flex-shrink-0 gap-1 md:gap-2"> {/* Added flex-shrink-0 */}
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

                                    return (
                                        <div key={travel.id} className="border p-3 rounded-md bg-secondary/50">
                                            <p className="text-sm font-medium text-secondary-foreground mb-1.5">Trip Plan <span className="font-mono text-xs bg-background px-1 py-0.5 rounded">#{travel.id?.substring(0, 6)}</span></p>
                                            <div className="space-y-1 text-xs text-muted-foreground">
                                                {travel.dateRange ? (
                                                    <p className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3"/>
                                                        {format(travel.dateRange.start.toDate(), "PP")} - {format(travel.dateRange.end.toDate(), "PP")}
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
                                                {/* Display other preferences if needed */}
                                                {travel.preferences.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length > 0 && (
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
                                            {/* Add View Details button for travel */}
                                            {/* <div className="mt-2 flex justify-end">
                                                <Button variant="outline" size="xs">Trip Details</Button>
                                            </div> */}
                                        </div>
                                    );
                                })}
                             </div>
                         )}
                    </CardContent>
                    {/* <CardFooter className="flex justify-end pt-4 border-t mt-4">
                         <Button variant="secondary" size="sm" onClick={() => router.push(`/travels/new?groupId=${group.id}`)}>
                              <PlusCircle className="mr-2 h-4 w-4" /> Plan Trip for Group
                         </Button>
                    </CardFooter> */}
                </Card>
                )
            })}
         </div>
        )}
    </div>
  );
}