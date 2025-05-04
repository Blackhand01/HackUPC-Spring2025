// src/components/matches/DatePicker.tsx
// Placeholder component - Implement actual date picker later

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function DatePicker({ label, disabled }: { label: string, disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="text" placeholder="Date selection (coming soon)" disabled={disabled || true} />
      <p className="text-xs text-muted-foreground">Date selection is currently disabled.</p>
    </div>
  );
}
