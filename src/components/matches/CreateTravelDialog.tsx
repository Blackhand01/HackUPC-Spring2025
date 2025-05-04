// src/components/matches/CreateTravelDialog.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWatch } from 'react-hook-form';
import { useRouter } from 'next/navigation'; // Import useRouter
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { type Group, type Travel } from '@/types';
import { useTravelForm, type TravelFormValues } from '@/hooks/matches/useTravelForm';
import { TripTypeSelector } from './TripTypeSelector';
import { GroupSelector } from './GroupSelector';
import { DepartureCityInput } from './DepartureCityInput';
import { PlanningModeTabs } from './PlanningModeTabs';

interface CreateTravelDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  groups: Group[];
  loadingGroups: boolean;
  onSave: (data: TravelFormValues, preferences: string[]) => Promise<Travel | null>; // Updated return type
  onSaveSuccess: (travel: Travel | null) => void; // Allow null
  onSaveGroupSuccess: (travel: Travel | null) => void; // Allow null
  onSaveError: (error: Error) => void;
}

export function CreateTravelDialog({
  isOpen,
  setIsOpen,
  groups,
  loadingGroups,
  onSave,
  onSaveSuccess,
  onSaveGroupSuccess,
  onSaveError,
}: CreateTravelDialogProps) {
  const form = useTravelForm();
  const router = useRouter(); // Initialize router
  const [isSubmitting, setIsSubmitting] = useState(false);
   const [aiExtractedPreferences, setAiExtractedPreferences] = useState<string[]>([]);

   const watchedValues = useWatch({ control: form.control });
   const planningMode = watchedValues.planningMode;
   const tripType = watchedValues.tripType;
   const departureCity = watchedValues.departureCity;
   const groupId = watchedValues.groupId;
   const mood = watchedValues.mood;
   const activity = watchedValues.activity;
   const activityOther = watchedValues.activityOther;
   const tripDateStart = watchedValues.tripDateStart;
   const tripDateEnd = watchedValues.tripDateEnd;

    const checkCanSave = useCallback((): boolean => {
        if (!departureCity?.trim() || (tripType === 'group' && !groupId)) {
            return false;
        }
         if (!tripDateStart || !tripDateEnd) {
             return false;
         }

        if (planningMode === 'guided') {
            const isActivityValid = activity === 'other' ? !!activityOther?.trim() : !!activity;
            return !!mood || isActivityValid;
        } else if (planningMode === 'ai') {
            return aiExtractedPreferences.length > 0;
        }
        return false;
    }, [departureCity, tripType, groupId, planningMode, mood, activity, activityOther, tripDateStart, tripDateEnd, aiExtractedPreferences]);

    const canSave = checkCanSave();

   const extractGuidedPreferences = useCallback(() => {
       const prefs: string[] = [];
       const currentMood = form.getValues('mood');
       const currentActivity = form.getValues('activity');
       const currentActivityOther = form.getValues('activityOther');

       if (currentMood) {
           prefs.push(`mood:${currentMood}`);
       }
       if (currentActivity === 'other' && currentActivityOther?.trim()) {
           prefs.push(`activity:other:${currentActivityOther.trim()}`);
       } else if (currentActivity && currentActivity !== 'other') {
           prefs.push(`activity:${currentActivity}`);
       }
       console.log("Extracting Guided Preferences on Submit:", prefs);
       return prefs;
   }, [form]);


  const handleFormSubmit = async (data: TravelFormValues) => {
      setIsSubmitting(true);

      const currentPrefs = planningMode === 'ai' ? aiExtractedPreferences : extractGuidedPreferences();

       if (currentPrefs.length === 0) {
           onSaveError(new Error(`Please set mood/activity preferences using the ${planningMode === 'ai' ? 'AI Assistant' : 'Guided sliders'}.`));
           setIsSubmitting(false);
           return;
       }
        if (!data.tripDateStart || !data.tripDateEnd) {
           onSaveError(new Error('Please select both a start and end date.'));
           setIsSubmitting(false);
           return;
        }

       console.log("Submitting with preferences:", currentPrefs);

      try {
          const savedTravel = await onSave(data, currentPrefs); // Call the modified onSave

          if (savedTravel) { // Check if save was successful
            // Call appropriate success handler
            if (savedTravel.groupId) {
              onSaveGroupSuccess(savedTravel); // Handles navigation for group trips
            } else {
              onSaveSuccess(savedTravel); // Handles individual trip updates
              // Optional: Navigate after individual save & match initiation
              // router.push(`/my-travels/${savedTravel.id}/results`); // Uncomment if a results page exists
            }
            form.reset();
            setAiExtractedPreferences([]);
            setIsOpen(false); // Close dialog on success
          } else {
             // Handle case where saveTravelPlan returned null (error handled in hook)
             console.log("Save operation did not return valid travel data.");
             // No need to call onSaveError here, it's handled in the hook
          }
      } catch (error) {
            // This catch block might be redundant if useTravelData handles errors,
            // but kept for safety.
          console.error("Error during form submission process:", error);
          onSaveError(error instanceof Error ? error : new Error('An unknown error occurred'));
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Plan Your Next Adventure</DialogTitle>
          <DialogDescription>
            Tell us about your dream trip. Select type, departure, dates and preferences. Matching will start automatically.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-6 pt-4">
            <TripTypeSelector control={form.control} disabled={isSubmitting} />

            {form.watch('tripType') === 'group' && (
              <GroupSelector
                control={form.control}
                groups={groups}
                loadingGroups={loadingGroups}
                disabled={isSubmitting}
              />
            )}

            <DepartureCityInput control={form.control} disabled={isSubmitting} />

             <PlanningModeTabs
               form={form}
               isSubmitting={isSubmitting}
               onPreferencesExtracted={setAiExtractedPreferences}
             />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Cancel</Button>
               <Button
                  type="submit"
                  disabled={isSubmitting || !canSave}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Saving & Matching...' : 'Save & Find Matches'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
