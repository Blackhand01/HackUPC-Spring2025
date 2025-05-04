// src/app/matches/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, PlusCircle, User, PlaneTakeoff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTravelData } from '@/hooks/matches/useTravelData';
import { CreateTravelDialog } from '@/components/matches/CreateTravelDialog';
import { TravelCard } from '@/components/matches/TravelCard';
import { TooltipProvider } from '@/components/ui/tooltip'; // Ensure TooltipProvider wraps the component

export default function MyTravelsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth(); // Get user object
  const router = useRouter();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const {
    myIndividualTravels,
    myGroups,
    allProperties, // Get all properties
    loadingTravels,
    loadingGroups,
    loadingProperties,
    saveTravelPlan,
    triggerDestinationMatching,
    fetchMyIndividualTravels,
    matchingStatus, // Get matching status from hook
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

  if (!authLoading && !isAuthenticated) {
    router.push('/login');
    return (
       <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
           <Loader2 className="h-16 w-16 animate-spin text-primary" />
           <p className="ml-3 text-muted-foreground">Redirecting to login...</p>
       </div>
   );
  }

  const handleSaveSuccess = () => {
    setIsAddDialogOpen(false);
    fetchMyIndividualTravels(); // Refresh list
     toast({
        title: 'Travel Plan Added!',
        description: `Your new travel plan has been saved.`,
      });
  };

   const handleSaveGroupSuccess = () => {
     setIsAddDialogOpen(false);
     toast({
        title: 'Group Trip Added',
        description: 'The new trip plan is now associated with the group. View it on the Groups page.',
      });
     router.push('/groups');
   };


  const handleSaveError = (error: Error) => {
     toast({
        variant: 'destructive',
        title: 'Error Adding Travel',
        description: `Failed to save your travel plan. ${error.message}`,
     });
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
             onSave={saveTravelPlan}
             onSaveSuccess={handleSaveSuccess}
             onSaveGroupSuccess={handleSaveGroupSuccess}
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
               // Ensure travel.id exists and is valid before rendering
               const currentStatus = travel.id ? matchingStatus[travel.id] || 'idle' : 'idle';
               if (!travel.id) {
                   console.warn("Attempting to render TravelCard without a valid ID:", travel);
                   return null; // Skip rendering if ID is missing
               }
              return (
                <TravelCard
                  key={travel.id}
                  travel={travel}
                  onTriggerMatch={triggerDestinationMatching}
                  matchingStatus={currentStatus} // Pass the specific status for this travel plan
                  allProperties={allProperties} // Pass all properties down
                  currentUserId={user?.uid || null} // Pass current user ID
                />
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
