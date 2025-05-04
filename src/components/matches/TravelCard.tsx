// src/components/matches/TravelCard.tsx
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { User, LocateFixed, Smile, Mountain, Film, Users, Leaf, Utensils, Info, Heart, Search, XCircle, Loader2, CheckCircle, PlaneTakeoff, CalendarDays, Clock } from 'lucide-react'; // Added Clock icon
import { format, formatDistanceToNow } from 'date-fns';
import { type Travel, type Property } from '@/types';
import { type EnrichedDestination } from '@/ai/flows/find-destination-matches-flow';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from "@/components/ui/dialog";
import { PropertyCard } from './PropertyCard';

interface TravelCardProps {
  travel: Travel;
  allProperties: Property[];
  currentUserId: string | null;
}

// Helper to parse preferences (same as before)
const getPreference = (preferences: string[] | undefined, key: string): string | undefined => {
    if (!preferences) return undefined;
    const pref = preferences.find(p => p.startsWith(`${key}:`));
    return pref ? pref.split(':').slice(1).join(':') : undefined;
};

// Helper to get preference icon (same as before)
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
            case 'beach': return <PlaneTakeoff className="h-4 w-4 text-primary"/>; // Using PlaneTakeoff for beach
            case 'nightlife': return <Users className="h-4 w-4 text-primary"/>;
            case 'foodie': return <Utensils className="h-4 w-4 text-primary"/>;
             case 'other': return <Info className="h-4 w-4 text-primary"/>;
            default: return <Heart className="h-4 w-4 text-primary"/>;
        }
    }
    return null;
};

// Helper to get properties in a destination city (same as before)
const getAvailableProperties = (destinationIata: string, allProps: Property[], userId: string | null): Property[] => {
    if (!userId) return [];
    return allProps.filter(prop => prop.address.nearestAirportIata === destinationIata && prop.hostId !== userId);
};


export function TravelCard({ travel, allProperties, currentUserId }: TravelCardProps) {
  const mood = getPreference(travel.preferences, 'mood');
  const activityRaw = getPreference(travel.preferences, 'activity');
  const activityOther = activityRaw?.startsWith('other:') ? activityRaw.substring(6) : undefined;
  const activity = activityOther ? `Other (${activityOther})` : activityRaw;

  const formattedCreatedAt = travel.createdAt && typeof travel.createdAt.toDate === 'function'
    ? formatDistanceToNow(travel.createdAt.toDate(), { addSuffix: true }) // Use relative time
    : 'N/A';

   const formattedStartDate = travel.tripDateStart && typeof travel.tripDateStart.toDate === 'function'
      ? format(travel.tripDateStart.toDate(), "PP")
      : null;
   const formattedEndDate = travel.tripDateEnd && typeof travel.tripDateEnd.toDate === 'function'
      ? format(travel.tripDateEnd.toDate(), "PP")
      : null;

    // --- Matching Status based on travel.status ---
    const isPending = travel.status === 'pending';
    const isMatching = travel.status === 'matching';
    const isMatched = travel.status === 'matched';
    const isError = travel.status === 'error';

    const topMatches = travel.matches?.slice(0, 10) || []; // Get top 10 matches

  return (
    <Card key={travel.id} className="shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Trip Plan <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">#{travel.id?.substring(0, 6)}</span></span>
          <User className="h-5 w-5 text-muted-foreground" title="Individual Trip" />
        </CardTitle>
        <CardDescription>
          Created: {formattedCreatedAt}
        </CardDescription>
         <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <LocateFixed className="h-4 w-4"/>
            Departing from: <span className="font-medium text-foreground">{travel.departureCity || 'N/A'}</span>
            {travel.departureCityIata && <span className="text-xs bg-muted px-1 py-0.5 rounded">({travel.departureCityIata})</span>}
         </p>
         {formattedStartDate && formattedEndDate && (
             <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                 <CalendarDays className="h-4 w-4" />
                 Dates: <span className="font-medium text-foreground">{formattedStartDate} - {formattedEndDate}</span>
             </p>
         )}
      </CardHeader>
      <CardContent className="flex-grow space-y-2">
        {/* Preferences Display */}
        <div className='space-y-1 mb-4'>
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
             {travel.preferences?.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length > 0 && (
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
             {(!mood && !activity && travel.preferences?.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length === 0) && (
                <p className="text-sm text-muted-foreground italic">No specific preferences set.</p>
            )}
        </div>


         {/* Destination Matching Section */}
         <div className="pt-4 border-t mt-4">
            <h4 className="text-sm font-semibold mb-2">Destination Matches</h4>
             {isPending ? (
                  <div className="flex items-center text-sm text-muted-foreground">
                     <Clock className="mr-2 h-4 w-4" /> Matching pending...
                 </div>
             ) : isMatching ? (
                 <div className="flex items-center text-sm text-muted-foreground">
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching for matches...
                 </div>
             ) : isMatched ? (
                  topMatches.length > 0 ? (
                     <div className="space-y-2">
                         {topMatches.map((match, index) => {
                              const availableProps = match.destinationIata ? getAvailableProperties(match.destinationIata, allProperties, currentUserId) : [];
                              return (
                                <Dialog key={`${match.destinationIata || `no-iata-${index}`}-${index}`}>
                                    <DialogTrigger asChild>
                                        <button
                                            className="w-full text-left border p-2 rounded-md hover:bg-accent/50 transition-colors text-sm block disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={availableProps.length === 0 || !match.destinationIata}
                                            title={!match.destinationIata ? "Destination IATA missing" : availableProps.length === 0 ? "No available properties in this destination for swapping" : `View ${availableProps.length} available properties in ${match.destinationCity} (${match.destinationIata})`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">{index + 1}. {match.destinationCity || match.destinationIata || 'Unknown'} {match.destinationIata && `(${match.destinationIata})`}</span>
                                                <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                                                    Score: {match.finalScore?.toFixed(2) ?? 'N/A'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-1">
                                                <span>€{match.priceEur?.toFixed(0) ?? '?'}</span>
                                                <span>{match.co2Kg?.toFixed(1) ?? '?'}kg CO₂</span>
                                                <span>{match.stops ?? '?'} stops</span>
                                                {match.durationMinutes && <span>~{(match.durationMinutes / 60).toFixed(1)}h</span>}
                                            </div>
                                             {match.destinationIata && availableProps.length === 0 && (
                                                <p className="text-xs text-amber-600 mt-1">No available properties for swap.</p>
                                             )}
                                             {match.errorMessage && <p className="text-xs text-destructive mt-1">Flight data error: {match.errorMessage}</p>}
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>Available Properties in {match.destinationCity} ({match.destinationIata})</DialogTitle>
                                            <DialogDescription>
                                                Browse available properties for swapping in this destination. These exclude your own listings.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                                            {availableProps.map(prop => (
                                                <PropertyCard key={prop.id} property={prop} />
                                            ))}
                                             {availableProps.length === 0 && (
                                                <p className="text-muted-foreground col-span-full text-center py-4">No properties available for swap found in this location.</p>
                                            )}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                              );
                            })}
                     </div>
                  ) : (
                      <div className="flex items-center text-sm text-muted-foreground">
                         <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Matching complete, but no suitable destinations found.
                      </div>
                  )
             ) : isError ? ( // Check for isError
                  <div className="flex items-center text-sm text-destructive">
                     <XCircle className="mr-2 h-4 w-4" /> Matching failed. {travel.errorDetails || 'Please try saving the plan again.'}
                 </div>
             ) : (
                 <p className="text-sm text-muted-foreground italic">
                    Unknown matching status.
                 </p>
             )}
         </div>

      </CardContent>
       <CardFooter className="flex justify-end pt-4 border-t">
           {/* Removed Find Matches Button */}
           <Button variant="outline" size="sm">View Details</Button> {/* Placeholder */}
       </CardFooter>
    </Card>
  );
}
