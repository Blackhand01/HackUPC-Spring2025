// src/app/groups/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, getDocs, addDoc, Timestamp, arrayUnion, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation'; // Added useSearchParams
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Users, Link as LinkIcon, Share2, PlaneTakeoff, Calendar, Heart, MapPin } from 'lucide-react'; // Added icons
import { CopyToClipboard } from '@/components/functional/CopyToClipboard'; // Assuming this component exists


// Interfaces based on Firestore structure
interface Group {
  id?: string; // Firestore document ID
  groupName: string;
  createBy: string; // userId
  createAt: Timestamp;
  users: string[]; // Array of userIds
}

// Re-declare Travel interface to avoid import issues if files change context
interface Place {
  name: string;
  coordinate?: { lat: number | null; lng: number | null };
  country: string;
}

interface Travel {
  id?: string; // Firestore document ID
  groupId: string | null;
  userId: string | null;
  preferences: string[];
  dateRange?: { start: Timestamp; end: Timestamp } | null;
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
  const searchParams = useSearchParams(); // For handling invite links
  const { toast } = useToast();
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [associatedTravels, setAssociatedTravels] = useState<{ [groupId: string]: Travel[] }>({});
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingTravels, setLoadingTravels] = useState(false); // Separate loading state for travels
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
          setAssociatedTravels({}); // Reset travels when fetching groups
          try {
              const groupsCollection = collection(db, 'groups');
              // Query groups where the 'users' array contains the current user's ID
              const q = query(groupsCollection, where('users', 'array-contains', user.uid));
              const querySnapshot = await getDocs(q);
              const groupsList = querySnapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data(),
              })) as Group[];
              setMyGroups(groupsList);
              // After fetching groups, fetch associated travels
              if (groupsList.length > 0) {
                  fetchAssociatedTravels(groupsList.map(g => g.id!));
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
  }, [user, authLoading, toast]); // fetchGroups depends on user and authLoading

  // --- Fetch Travels Associated with Groups ---
  const fetchAssociatedTravels = useCallback(async (groupIds: string[]) => {
      if (groupIds.length === 0) return;
      setLoadingTravels(true);
      try {
          const travelsCollection = collection(db, 'travels');
          // Query travels where groupId is in the list of the user's group IDs
          const q = query(travelsCollection, where('groupId', 'in', groupIds));
          const querySnapshot = await getDocs(q);
          const travelsList = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
          })) as Travel[];

          // Group travels by groupId
          const groupedTravels: { [groupId: string]: Travel[] } = {};
          travelsList.forEach(travel => {
              if (travel.groupId) {
                  if (!groupedTravels[travel.groupId]) {
                      groupedTravels[travel.groupId] = [];
                  }
                  groupedTravels[travel.groupId].push(travel);
              }
          });
          setAssociatedTravels(groupedTravels);

      } catch (error) {
          console.error('Error fetching associated travels:', error);
          toast({
              variant: 'destructive',
              title: 'Error Fetching Group Travels',
              description: 'Could not load travels for your groups.',
          });
      } finally {
          setLoadingTravels(false);
      }
  }, [toast]); // fetchAssociatedTravels depends on toast


  // --- Initial Data Fetch ---
  useEffect(() => {
      if (!authLoading && isAuthenticated && user) {
          fetchGroups();
      }
  }, [authLoading, isAuthenticated, user, fetchGroups]); // Ensure fetchGroups is stable


  // --- Handle Invite Link ---
  useEffect(() => {
    const joinGroupId = searchParams.get('joinGroup');
    if (joinGroupId && user && isAuthenticated && !loadingGroups && myGroups.length > 0) {
      // Check if user is already in the group
      const isAlreadyMember = myGroups.some(group => group.id === joinGroupId);

      if (!isAlreadyMember) {
        const joinGroup = async () => {
          try {
            const groupRef = doc(db, 'groups', joinGroupId);
            // Check if group exists before trying to update
            const groupSnap = await getDoc(groupRef);
            if (!groupSnap.exists()) {
                 toast({ variant: 'destructive', title: 'Group Not Found', description: 'The invite link is invalid or the group may have been deleted.' });
                 router.replace('/groups'); // Remove query param
                 return;
            }

            await updateDoc(groupRef, {
              users: arrayUnion(user.uid)
            });
            toast({ title: 'Joined Group!', description: `You've been added to the group.` });
            // Refetch groups to include the newly joined one
            fetchGroups();
          } catch (error) {
            console.error("Error joining group:", error);
            toast({ variant: 'destructive', title: 'Error Joining Group', description: 'Could not join the group. Please try the link again.' });
          } finally {
             // Remove the query parameter from the URL after attempting to join
             router.replace('/groups');
          }
        };
        joinGroup();
      } else {
         // If already a member or group list isn't loaded yet, just remove param
         if (isAlreadyMember) {
             toast({ title: 'Already a Member', description: 'You are already part of this group.' });
         }
         router.replace('/groups');
      }
    }
     // Only run when joinGroupId changes, or auth state settles
  }, [searchParams, user, isAuthenticated, loadingGroups, myGroups, router, toast, fetchGroups]);


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

      // Add the new group to the local state
      setMyGroups(prev => [...prev, { ...groupToAdd, id: docRef.id, createAt: groupToAdd.createAt }]);

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
       const baseUrl = window.location.origin; // Gets base URL (e.g., http://localhost:3000)
       return `${baseUrl}/groups?joinGroup=${groupId}`;
   };

   // --- Share Handlers (Basic Examples) ---
   const shareOnWhatsApp = (link: string, groupName: string) => {
       const text = encodeURIComponent(`Join my travel group "${groupName}" on OnlyFly! ${link}`);
       window.open(`https://wa.me/?text=${text}`, '_blank');
   };

   const shareOnTelegram = (link: string, groupName: string) => {
       const text = encodeURIComponent(`Join my travel group "${groupName}" on OnlyFly!`);
       window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`, '_blank');
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
                return (
                <Card key={group.id} className="shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>{group.groupName}</CardTitle>
                                <CardDescription>
                                    {group.users.length} member{group.users.length !== 1 ? 's' : ''} | Created: {group.createAt.toDate().toLocaleDateString()}
                                </CardDescription>
                            </div>
                             {/* Share/Invite Section */}
                              <div className="flex items-center gap-2">
                                  <CopyToClipboard textToCopy={inviteLink}>
                                      <Button variant="outline" size="sm">
                                          <LinkIcon className="mr-2 h-4 w-4"/> Copy Invite
                                      </Button>
                                  </CopyToClipboard>
                                  <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm"><Share2 className="mr-2 h-4 w-4"/> Share</Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[350px]">
                                            <DialogHeader>
                                                <DialogTitle>Share Invite Link</DialogTitle>
                                                <DialogDescription>Share this link to invite others to "{group.groupName}".</DialogDescription>
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
                         {loadingTravels ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-muted-foreground">Loading trips...</span>
                              </div>
                         ) : travelsForGroup.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No trips planned for this group yet.</p>
                         ) : (
                             <div className="space-y-3">
                                {travelsForGroup.map(travel => (
                                    <div key={travel.id} className="border p-3 rounded-md bg-secondary">
                                        <p className="text-sm font-medium text-secondary-foreground">Trip Plan #{travel.id?.substring(0, 6)}...</p>
                                        {travel.dateRange && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                <Calendar className="inline-block h-3 w-3 mr-1"/>
                                                {new Date(travel.dateRange.start.seconds * 1000).toLocaleDateString()} - {new Date(travel.dateRange.end.seconds * 1000).toLocaleDateString()}
                                            </p>
                                        )}
                                         {travel.preferences.length > 0 && (
                                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                             <Heart className="h-3 w-3 text-muted-foreground" />
                                            {travel.preferences.slice(0, 4).map((pref, index) => (
                                                <span key={index} className="text-xs bg-background text-foreground px-1.5 py-0.5 rounded-full">{pref}</span>
                                            ))}
                                            {travel.preferences.length > 4 && <span className="text-xs text-muted-foreground">...</span>}
                                          </div>
                                        )}
                                        {/* Add View Details button for travel */}
                                        <div className="mt-2 flex justify-end">
                                           <Button variant="outline" size="xs">Trip Details</Button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                         )}
                    </CardContent>
                    {/* Footer can contain manage members or other actions */}
                    {/* <CardFooter className="flex justify-end pt-4">
                        <Button variant="outline" size="sm">Manage Group</Button>
                    </CardFooter> */}
                </Card>
                )
            })}
         </div>
        )}
    </div>
  );
}

    