// src/components/matches/GroupSelector.tsx
'use client';

import { ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { type Group } from '@/types';

interface GroupSelectorProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  control: any; // Control from react-hook-form
  groups: Group[];
  loadingGroups: boolean;
  disabled?: boolean;
  name?: TName; // Optional name override
}

export function GroupSelector<TFieldValues extends FieldValues>({
  control,
  groups,
  loadingGroups,
  disabled,
  name = 'groupId' as FieldPath<TFieldValues>,
}: GroupSelectorProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-base font-semibold">Select Group</FormLabel>
          <Select
            onValueChange={field.onChange}
            value={field.value}
            disabled={disabled || loadingGroups}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={loadingGroups ? "Loading groups..." : "Select a group"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {loadingGroups ? (
                <SelectItem value="loading" disabled>Loading...</SelectItem>
              ) : groups.length === 0 ? (
                <SelectItem value="no-groups" disabled>No groups found</SelectItem>
              ) : (
                <SelectGroup>
                  <SelectLabel>Your Groups</SelectLabel>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.groupName}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          <FormMessage />
          <p className="text-xs text-muted-foreground pt-1">Plan this trip with one of your existing groups.</p>
        </FormItem>
      )}
    />
  );
}
