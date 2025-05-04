// src/components/matches/TripTypeSelector.tsx
'use client';

import { ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { User, Users } from 'lucide-react';

interface TripTypeSelectorProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  control: any; // Control from react-hook-form
  disabled?: boolean;
  name?: TName; // Optional name override
}

export function TripTypeSelector<TFieldValues extends FieldValues>({
  control,
  disabled,
  name = 'tripType' as FieldPath<TFieldValues>,
}: TripTypeSelectorProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-3">
          <FormLabel className="text-base font-semibold">Trip Type</FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              className="flex gap-4"
              disabled={disabled}
            >
              <FormItem className="flex-1">
                <FormControl>
                  <RadioGroupItem value="individual" id="individual" className="sr-only" />
                </FormControl>
                <FormLabel htmlFor="individual" className="flex items-center gap-2 p-4 border rounded-md cursor-pointer hover:bg-accent/50 has-[:checked]:bg-accent has-[:checked]:border-primary justify-center font-normal">
                  <User className="h-5 w-5 mr-1" /> Individual
                </FormLabel>
              </FormItem>
              <FormItem className="flex-1">
                <FormControl>
                  <RadioGroupItem value="group" id="group" className="sr-only" />
                </FormControl>
                <FormLabel htmlFor="group" className="flex items-center gap-2 p-4 border rounded-md cursor-pointer hover:bg-accent/50 has-[:checked]:bg-accent has-[:checked]:border-primary justify-center font-normal">
                  <Users className="h-5 w-5 mr-1" /> Group
                </FormLabel>
              </FormItem>
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
