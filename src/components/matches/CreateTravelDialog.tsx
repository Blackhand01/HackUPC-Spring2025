// src/components/matches/CreateTravelDialog.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWatch } from 'react-hook-form';
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
  onSave: (data: TravelFormValues, preferences: string[]) => Promise<Travel>;
  onSaveSuccess: (travel: Travel) => void;
  onSaveGroupSuccess: (travel: Travel) => void; // Specific handler for group success
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
  const [isSubmitting, setIsSubmitting] = useState(false);
   // State to hold preferences extracted *specifically* from AI mode
   const [aiExtractedPreferences, setAiExtractedPreferences] = useState<string[]>([]);

   // Watch form values needed for button logic and preference extraction
   const watchedValues = useWatch({ control: form.control });
   const planningMode = watchedValues.planningMode;
   const tripType = watchedValues.tripType;
   const departureCity = watchedValues.departureCity;
   const groupId = watchedValues.groupId;
   const mood = watchedValues.mood; // For Guided mode check
   const activity = watchedValues.activity; // For Guided mode check
   const activityOther = watchedValues.activityOther; // For Guided mode check
   const tripDateStart = watchedValues.tripDateStart; // Watch dates
   const tripDateEnd = watchedValues.tripDateEnd; // Watch dates

    // --- Determine if Save button should be enabled ---
    const checkCanSave = useCallback((): boolean => {
        // Basic required fields: departure city and group selection (if group trip)
        if (!departureCity?.trim() || (tripType === 'group' && !groupId)) {
            return false;
        }

        // Need either dates or duration (if duration field exists)
        // Currently only dates: Check if both dates are present
         if (!tripDateStart || !tripDateEnd) {
             return false;
         }


        // Preference check based on mode
        if (planningMode === 'guided') {
            const isActivityValid = activity === 'other' ? !!activityOther?.trim() : !!activity;
            return !!mood || isActivityValid;
        } else if (planningMode === 'ai') {
            // For AI mode, check if preferences have been extracted (use state)
            return aiExtractedPreferences.length > 0;
        }
        return false; // Should not happen
    }, [departureCity, tripType, groupId, planningMode, mood, activity, activityOther, tripDateStart, tripDateEnd, aiExtractedPreferences]);

    const canSave = checkCanSave();

   // Function to extract preferences based on current form state *for Guided Mode*
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
       console.log("Extracting Guided Preferences on Submit:", prefs); // Debug log
       return prefs;
   }, [form]);


  const handleFormSubmit = async (data: TravelFormValues) => {
      setIsSubmitting(true);

      // Determine which preferences to use based on the mode
      const currentPrefs = planningMode === 'ai' ? aiExtractedPreferences : extractGuidedPreferences();

       // Validate preferences again right before saving
       if (currentPrefs.length === 0) {
           onSaveError(new Error(`Please set mood/activity preferences using the ${planningMode === 'ai' ? 'AI Assistant' : 'Guided sliders'}.`));
           setIsSubmitting(false);
           return;
       }
        // Validate dates again
        if (!data.tripDateStart || !data.tripDateEnd) {
           onSaveError(new Error('Please select both a start and end date.'));
           setIsSubmitting(false);
           return;
        }


       console.log("Submitting with preferences:", currentPrefs); // Debug log

      try {
          const savedTravel = await onSave(data, currentPrefs); // Pass form data and the correct preferences
           if (savedTravel.groupId) {
             onSaveGroupSuccess(savedTravel);
           } else {
             onSaveSuccess(savedTravel);
           }
          form.reset(); // Reset form on successful save
          setAiExtractedPreferences([]); // Clear extracted AI prefs
      } catch (error) {
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
            Tell us about your dream trip. Select type, departure, dates and preferences.
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

             {/* PlanningModeTabs now contains GuidedMode which includes the DatePicker */}
             <PlanningModeTabs
               form={form}
               isSubmitting={isSubmitting}
               onPreferencesExtracted={setAiExtractedPreferences} // Pass callback to update AI prefs state
             />


            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Cancel</Button>
               <Button
                  type="submit"
                  disabled={isSubmitting || !canSave} // Use the calculated canSave state
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Saving...' : 'Save Travel Plan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
