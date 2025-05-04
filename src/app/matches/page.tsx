// src/app/matches/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, PlusCircle, User, PlaneTakeoff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTravelData } from '@/hooks/matches/useTravelData';
import { CreateTravelDialog } from '@/components/matches/CreateTravelDialog';
import { TravelCard } from '@/components/matches/TravelCard';
import { TooltipProvider } from '@/components/ui/tooltip';
import { type Travel } from '@/types';

export default function MyTravelsPage() {
  // --- Call ALL hooks unconditionally at the top level ---
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast(); // Called unconditionally
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false); // Called unconditionally
  const {
    myIndividualTravels,
    myGroups,
    allProperties,
    loadingTravels,
    loadingGroups,
    loadingProperties,
    saveTravelPlan,
    fetchMyIndividualTravels,
  } = useTravelData(); // Called unconditionally

  // --- Redirect Effect ---
  // Place useEffect after all hook calls
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // console.log("MyTravelsPage: Redirecting to login (useEffect)");
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // --- Loading State Check ---
  // Place checks after all hook calls
  if (authLoading || loadingProperties || loadingTravels || loadingGroups) {
    // console.log("MyTravelsPage: Showing loading indicator", { authLoading, loadingProperties, loadingTravels, loadingGroups });
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading travel data...</p>
      </div>
    );
  }

  // --- Authentication Guard (after loading) ---
  // Check authentication *after* loading is complete and *after* all hooks are called
  if (!isAuthenticated) {
     // This indicates the redirect effect hasn't completed yet or failed.
     // Render a loading state or null while redirecting happens.
    // console.log("MyTravelsPage: Not authenticated, showing redirect indicator");
    return (
       <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
           <Loader2 className="h-16 w-16 animate-spin text-primary" />
           <p className="ml-3 text-muted-foreground">Redirecting...</p>
       </div>
    );
  }

  // --- Component Logic and Render (only if authenticated and not loading) ---

  // Success Handlers for Save
  const handleSaveSuccess = (savedTravel: Travel | null) => {
      setIsAddDialogOpen(false);
      if (savedTravel && savedTravel.id) {
          fetchMyIndividualTravels(); // Refresh list after successful save & match initiation
          console.log(`Individual travel ${savedTravel.id} saved, matching initiated.`);
          // Toast is handled in useTravelData
      } else {
          console.warn("Save succeeded but travel data or ID missing.");
      }
  };

   const handleSaveGroupSuccess = (savedTravel: Travel | null) => {
     setIsAddDialogOpen(false);
     if (savedTravel && savedTravel.id) {
         console.log(`Group travel ${savedTravel.id} saved, matching initiated.`);
         // Toast is handled in useTravelData
         router.push('/groups'); // Navigate immediately for group trips
         toast({ title: "Group Trip Saved", description: "Matching initiated. View details on the Groups page." });
     } else {
          console.warn("Group save succeeded but travel data or ID missing.");
     }
   };


  const handleSaveError = (error: Error) => {
     console.error("Save error reported to page:", error.message);
     // Toast handled in useTravelData
  };

  // console.log("MyTravelsPage: Rendering main content", { myIndividualTravels });

  return (
    <TooltipProvider>
      <div className="container mx-auto py-12 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8 text-primary" /> My Individual Travels
          </h1>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Plan New Trip
          </Button>
           <CreateTravelDialog
             isOpen={isAddDialogOpen}
             setIsOpen={setIsAddDialogOpen}
             groups={myGroups}
             loadingGroups={loadingGroups} // Pass loading state
             onSave={saveTravelPlan}
             onSaveSuccess={handleSaveSuccess}
             onSaveGroupSuccess={handleSaveGroupSuccess}
             onSaveError={handleSaveError}
           />
        </div>

        {/* Display User's Individual Travels */}
        {myIndividualTravels.length === 0 ? (
          <Card className="text-center py-12 shadow-md">
            <CardHeader>
              <PlaneTakeoff className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <CardTitle>No Individual Trips Planned Yet</CardTitle>
              <CardDescription>Start planning your next solo adventure!</CardDescription>
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
                  allProperties={allProperties}
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
