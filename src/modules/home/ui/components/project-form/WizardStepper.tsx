"use client";

import { cn } from "@/lib/utils";

type Props = {
  labels: string[];
  current: number; // 0-based
};

export function WizardStepper({ labels, current }: Props) {
  return (
    <div className="md:w-1/4 w-full bg-muted/50 p-4 md:p-6 md:border-r border-b md:border-b-0 flex md:flex-col justify-center md:justify-start max-h-[30vh] md:max-h-none overflow-x-auto md:overflow-visible">
      <div className="space-y-6">
        {labels.map((label, index) => {
          const isActive = current === index;
          const isDone = current > index;
          return (
            <div key={`${label}-${index}`} className="flex items-center gap-3 relative">
              <div
                className={cn(
                  "w-10 h-10 aspect-square grid place-items-center border-2 text-sm font-medium rounded-full transition-colors",
                  isActive && "bg-primary text-primary-foreground border-primary",
                  isDone && "bg-muted text-foreground border-muted",
                  !isActive && !isDone && "bg-background border-border"
                )}
              >
                {isDone ? "✓" : index + 1}
              </div>
              <span className={cn("text-sm", isActive && "font-semibold")}>{label}</span>
              {index < labels.length - 1 && (
                <div className="absolute left-5 top-10 w-0.5 h-6 bg-border" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
