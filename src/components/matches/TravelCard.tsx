// src/components/matches/TravelCard.tsx
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { User, LocateFixed, Smile, Mountain, Film, Users, Leaf, Utensils, Info, Heart, Search, XCircle, Loader2, CheckCircle } from 'lucide-react'; // Added more icons
import { format } from 'date-fns';
import { type Travel } from '@/types';

interface TravelCardProps {
  travel: Travel;
  onTriggerMatch: (travel: Travel) => void;
  // Add matching status props if needed later
  // isMatching?: boolean;
  // matchCompleted?: boolean;
  // matchError?: boolean | string;
}

// Helper to parse preferences
const getPreference = (preferences: string[] | undefined, key: string): string | undefined => {
    if (!preferences) return undefined;
    const pref = preferences.find(p => p.startsWith(`${key}:`));
    return pref ? pref.split(':').slice(1).join(':') : undefined;
};

// Helper to get preference icon
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
            // case 'beach': return <PlaneTakeoff className="h-4 w-4 text-primary"/>; // Placeholder
            case 'beach': return <span title="Beach" className="text-xl">🏖️</span>; // Emoji example
            case 'nightlife': return <Users className="h-4 w-4 text-primary"/>;
            case 'foodie': return <Utensils className="h-4 w-4 text-primary"/>;
             case 'other': return <Info className="h-4 w-4 text-primary"/>;
            default: return <Heart className="h-4 w-4 text-primary"/>;
        }
    }
    return null;
};


export function TravelCard({ travel, onTriggerMatch }: TravelCardProps) {
  const mood = getPreference(travel.preferences, 'mood');
  const activityRaw = getPreference(travel.preferences, 'activity');
  const activityOther = activityRaw?.startsWith('other:') ? activityRaw.substring(6) : undefined;
  const activity = activityOther ? `Other (${activityOther})` : activityRaw;

  const formattedCreatedAt = travel.createdAt && typeof travel.createdAt.toDate === 'function'
    ? format(travel.createdAt.toDate(), "PP") // Use PP for localized date format
    : 'N/A';

    // Example matching status (replace with actual props later)
    const isMatching = false; // Placeholder
    const matchCompleted = false; // Placeholder
    const matchError = false; // Placeholder

   // Determine if matching can be triggered (example condition)
   // Requires departure IATA and preferences. Dates/Duration might be needed too.
   const canMatch = !!(travel.departureCity && travel.preferences && travel.preferences.length > 0); // Simplified condition


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

          {/* Destination Matching Section - Placeholder */}
         <div className="pt-4 border-t mt-4">
            <h4 className="text-sm font-semibold mb-2">Destination Matches</h4>
             {isMatching ? (
                 <div className="flex items-center text-sm text-muted-foreground">
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching for matches...
                 </div>
             ) : matchCompleted ? (
                 <div className="flex items-center text-sm text-green-600">
                     <CheckCircle className="mr-2 h-4 w-4" /> Matches found! (Details to be added)
                 </div>
             ) : matchError ? (
                  <div className="flex items-center text-sm text-destructive">
                     <XCircle className="mr-2 h-4 w-4" /> Matching failed. {typeof matchError === 'string' ? matchError : ''}
                 </div>
             ) : (
                 <p className="text-sm text-muted-foreground italic">
                    Click "Find Matches" to start the search.
                 </p>
             )}
         </div>


        {(!mood && !activity && !(travel.places && travel.places.length > 0) && travel.preferences?.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length === 0) && (
          <p className="text-sm text-muted-foreground italic">No specific preferences set.</p>
        )}
      </CardContent>
      <CardFooter className="flex justify-end pt-4 border-t gap-2">
         <Tooltip>
            <TooltipTrigger asChild>
                {/* Wrap button in span to allow tooltip when disabled */}
                <span tabIndex={!canMatch ? 0 : -1}>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onTriggerMatch(travel)}
                        disabled={!canMatch || isMatching} // Disable if cannot match or already matching
                        aria-disabled={!canMatch || isMatching} // For accessibility
                    >
                        {isMatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        {isMatching ? 'Matching...' : 'Find Matches'}
                    </Button>
                 </span>
            </TooltipTrigger>
             <TooltipContent>
                <p>{canMatch ? "Find house swap destinations based on these preferences" : "Matching requires departure city & preferences."}</p>
            </TooltipContent>
         </Tooltip>
      </CardFooter>
    </Card>
  );
}
