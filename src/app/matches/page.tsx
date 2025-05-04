// src/app/matches/page.tsx
'use client';

import { useState, useEffect } from 'react'; // Added useEffect
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation'; // Import useRouter
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, PlusCircle, User, PlaneTakeoff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTravelData } from '@/hooks/matches/useTravelData';
import { CreateTravelDialog } from '@/components/matches/CreateTravelDialog';
import { TravelCard } from '@/components/matches/TravelCard';
import { TooltipProvider } from '@/components/ui/tooltip';
import { type Travel } from '@/types'; // Import Travel type

export default function MyTravelsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter(); // Initialize useRouter
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const {
    myIndividualTravels,
    myGroups,
    allProperties,
    loadingTravels,
    loadingGroups,
    loadingProperties,
    saveTravelPlan,
    fetchMyIndividualTravels,
    // Removed triggerDestinationMatching and matchingStatus
  } = useTravelData();

  // --- Render Logic ---
  if (authLoading || loadingProperties) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading essential data...</p>
      </div>
    );
  }

   // Redirect unauthenticated users
   useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);


  if (!isAuthenticated) {
    return (
       <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
           <Loader2 className="h-16 w-16 animate-spin text-primary" />
           <p className="ml-3 text-muted-foreground">Redirecting to login...</p>
       </div>
   ); // Render loading indicator while redirecting
  }

  // --- Success Handlers for Save ---
  const handleSaveSuccess = (savedTravel: Travel | null) => {
      setIsAddDialogOpen(false);
      if (savedTravel && savedTravel.id) {
          fetchMyIndividualTravels(); // Refresh list after successful save & match initiation
          // No explicit toast here, as useTravelData handles it
          // TODO: Consider navigation after matching completes, perhaps via a listener or state update
          // Example: router.push(`/my-travels/${savedTravel.id}/results`); // Needs results page
          console.log(`Individual travel ${savedTravel.id} saved, matching initiated.`);
      } else {
          console.warn("Save succeeded but travel data or ID missing.");
      }
  };

   const handleSaveGroupSuccess = (savedTravel: Travel | null) => {
     setIsAddDialogOpen(false);
     if (savedTravel && savedTravel.id) {
         // No explicit toast here, as useTravelData handles it
         console.log(`Group travel ${savedTravel.id} saved, matching initiated.`);
         // Navigate to groups page immediately after saving a group trip
         router.push('/groups');
         toast({ title: "Group Trip Saved", description: "Matching initiated. View details on the Groups page." });
     } else {
          console.warn("Group save succeeded but travel data or ID missing.");
     }
   };


  const handleSaveError = (error: Error) => {
     // Toast is handled within useTravelData hook now
     console.error("Save error reported to page:", error.message);
     // No need for toast here, handled in the hook
  };


  return (
    <TooltipProvider>
      <div className="container mx-auto py-12 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8 text-primary" /> My Travels
          </h1>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Plan New Trip
          </Button>
           <CreateTravelDialog
             isOpen={isAddDialogOpen}
             setIsOpen={setIsAddDialogOpen}
             groups={myGroups}
             loadingGroups={loadingGroups}
             onSave={saveTravelPlan} // Pass the modified save function
             onSaveSuccess={handleSaveSuccess} // Pass the specific handler
             onSaveGroupSuccess={handleSaveGroupSuccess} // Pass the specific handler
             onSaveError={handleSaveError}
           />
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
               if (!travel.id) {
                   console.warn("Attempting to render TravelCard without a valid ID:", travel);
                   return null;
               }
              return (
                <TravelCard
                  key={travel.id}
                  travel={travel}
                  // Removed onTriggerMatch and matchingStatus props
                  allProperties={allProperties} // Pass allProperties
                  currentUserId={user?.uid || null}
                />
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
