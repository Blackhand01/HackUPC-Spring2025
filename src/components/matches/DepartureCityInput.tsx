// src/components/matches/DepartureCityInput.tsx
'use client';

import { ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { LocateFixed } from 'lucide-react';

interface DepartureCityInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  control: any; // Control from react-hook-form
  disabled?: boolean;
  name?: TName; // Optional name override
}

export function DepartureCityInput<TFieldValues extends FieldValues>({
  control,
  disabled,
  name = 'departureCity' as FieldPath<TFieldValues>,
}: DepartureCityInputProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-base font-semibold flex items-center gap-1">
            <LocateFixed className="h-5 w-5" /> Departure City <span className='text-destructive'>*</span>
          </FormLabel>
          <FormControl>
            <Input placeholder="e.g., Rome, London, New York" {...field} disabled={disabled} />
          </FormControl>
          <FormMessage />
          <p className="text-xs text-muted-foreground pt-1">Where will your journey begin?</p>
        </FormItem>
      )}
    />
  );
}
