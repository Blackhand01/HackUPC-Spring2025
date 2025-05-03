'use client';

import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { generateTravelMatches, type GenerateTravelMatchesInput, type GenerateTravelMatchesOutput } from '@/ai/flows/generate-travel-matches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, Sparkles, MapPin, Calendar, Leaf } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const matchesSchema = z.object({
  userPreferences: z.string().min(10, { message: 'Please describe your preferences (destinations, activities).' }),
  accommodationDetails: z.string().min(10, { message: 'Please describe your accommodation (size, amenities, location).' }),
  travelDates: z.string().min(5, { message: 'Please specify your desired travel dates (e.g., July 2024, next summer).' }),
  greenScorePreferences: z.string().optional(),
});

type MatchesFormValues = z.infer<typeof matchesSchema>;

export default function MatchesPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [matchesResult, setMatchesResult] = useState<GenerateTravelMatchesOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<MatchesFormValues>({
    resolver: zodResolver(matchesSchema),
    defaultValues: {
      userPreferences: '',
      accommodationDetails: '',
      travelDates: '',
      greenScorePreferences: 'Prefer sustainable options', // Default preference
    },
  });

  const onSubmit: SubmitHandler<MatchesFormValues> = async (data) => {
    setIsLoading(true);
    setError(null);
    setMatchesResult(null);
    console.log('Generating matches with data:', data);

    try {
      // Type assertion to match the expected input type
      const inputData: GenerateTravelMatchesInput = {
        userPreferences: data.userPreferences,
        accommodationDetails: data.accommodationDetails,
        travelDates: data.travelDates,
        greenScorePreferences: data.greenScorePreferences || undefined, // Pass undefined if empty
      };
      const result = await generateTravelMatches(inputData);
      setMatchesResult(result);
    } catch (e) {
      console.error('Error generating matches:', e);
      setError('Failed to generate matches. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <Card className="mb-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
             <Sparkles className="text-primary"/> Find Your Perfect House Swap
          </CardTitle>
          <CardDescription>Enter your details and let our AI find the best matches for you.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="userPreferences" className="flex items-center gap-1"><MapPin className="h-4 w-4"/>Your Preferences</Label>
                <Textarea
                  id="userPreferences"
                  placeholder="e.g., Beach destinations in Europe, interested in hiking and local cuisine."
                  {...form.register('userPreferences')}
                  rows={4}
                  aria-invalid={form.formState.errors.userPreferences ? 'true' : 'false'}
                />
                {form.formState.errors.userPreferences && (
                  <p className="text-sm text-destructive">{form.formState.errors.userPreferences.message}</p>
                )}
              </div>
              <div className="space-y-2">
                 <Label htmlFor="accommodationDetails" className="flex items-center gap-1"><MapPin className="h-4 w-4" />Your Accommodation</Label>
                <Textarea
                  id="accommodationDetails"
                  placeholder="e.g., 2-bedroom apartment in downtown, modern amenities, close to public transport."
                  {...form.register('accommodationDetails')}
                  rows={4}
                  aria-invalid={form.formState.errors.accommodationDetails ? 'true' : 'false'}
                />
                {form.formState.errors.accommodationDetails && (
                  <p className="text-sm text-destructive">{form.formState.errors.accommodationDetails.message}</p>
                )}
              </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="travelDates" className="flex items-center gap-1"><Calendar className="h-4 w-4"/>Desired Travel Dates</Label>
                  <Input
                    id="travelDates"
                    placeholder="e.g., August 1st - 15th, 2024, Christmas holidays"
                    {...form.register('travelDates')}
                     aria-invalid={form.formState.errors.travelDates ? 'true' : 'false'}
                  />
                   {form.formState.errors.travelDates && (
                    <p className="text-sm text-destructive">{form.formState.errors.travelDates.message}</p>
                   )}
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="greenScorePreferences" className="flex items-center gap-1"><Leaf className="h-4 w-4"/>Sustainability Preference (Optional)</Label>
                  <Input
                    id="greenScorePreferences"
                    placeholder="e.g., High green score, eco-friendly focus"
                    {...form.register('greenScorePreferences')}
                  />
                </div>
            </div>
            <Button type="submit" className="w-full md:w-auto" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {isLoading ? 'Finding Matches...' : 'Find Matches'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
         <div className="text-center p-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Searching for the best swaps...</p>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {matchesResult && matchesResult.matches.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Potential Matches Found!</CardTitle>
             <CardDescription>Here are some house swap opportunities based on your criteria:</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {matchesResult.matches.map((match, index) => (
                <li key={index} className="p-4 border rounded-md bg-secondary">
                  <p className="text-secondary-foreground">{match}</p>
                  {/* Add more details here if the AI provides structured data */}
                   <div className="mt-2 flex justify-end">
                     <Button variant="outline" size="sm">View Details</Button>
                   </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

       {matchesResult && matchesResult.matches.length === 0 && !isLoading && (
         <Alert>
           <AlertTitle>No Matches Found</AlertTitle>
           <AlertDescription>We couldn't find any perfect matches with your current criteria. Try adjusting your preferences or dates.</AlertDescription>
         </Alert>
       )}
    </div>
  );
}
