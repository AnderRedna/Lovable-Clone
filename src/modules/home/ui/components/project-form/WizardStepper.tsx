"use client";

import { cn } from "@/lib/utils";

type Props = {
  step: 1 | 2 | 3;
  subStepLabel?: string; // e.g., "3.1" when in component prompts
};

const labels: Record<1 | 2 | 3, string> = {
  1: "Informações básicas",
  2: "Monitoramento",
  3: "Componentes",
};

export function WizardStepper({ step, subStepLabel }: Props) {
  return (
    <div className="md:w-1/4 w-full bg-muted/50 p-4 md:p-6 md:border-r border-b md:border-b-0 flex md:flex-col justify-center md:justify-start max-h-[30vh] md:max-h-none overflow-x-auto md:overflow-visible">
      <div className="space-y-6">
        {[1, 2, 3].map((s, index) => {
          const isActive = step === (s as 1 | 2 | 3);
          const isDone = step > (s as 1 | 2 | 3);
          return (
            <div key={s} className="flex items-center gap-3 relative">
              <div
                className={cn(
                  "w-10 h-10 aspect-square grid place-items-center border-2 text-sm font-medium rounded-full transition-colors",
                  isActive && "bg-primary text-primary-foreground border-primary",
                  isDone && "bg-muted text-foreground border-muted",
                  !isActive && !isDone && "bg-background border-border"
                )}
              >
                {isDone ? "✓" : s}
              </div>
              <span className={cn("text-sm", isActive && "font-semibold")}>{
                labels[s as 1 | 2 | 3]
              }</span>
              {index < 2 && <div className="absolute left-5 top-10 w-0.5 h-6 bg-border"></div>}
            </div>
          );
        })}
        {subStepLabel && (
          <div className="relative flex items-center gap-2 pl-10">
            {/* connector from step 3 to 3.1 (child link): short vertical + short horizontal */}
            <div className="absolute left-6 -top-3 w-0.5 h-5 bg-border" />
            <div className="absolute left-6 top-2 w-3 h-0.5 bg-border" />
            {(() => {
              const numeric = subStepLabel.includes(".") ? subStepLabel.split(".")[1] : subStepLabel;
              return (
                <div
                  className={cn(
                    "ml-3 w-6 h-6 grid place-items-center rounded-full border-2",
                    "border-primary bg-primary text-primary-foreground text-[10px] leading-none"
                  )}
                >
                  {numeric}
                </div>
              );
            })()}
            <span className="text-xs font-medium">Prompts</span>
          </div>
        )}
      </div>
    </div>
  );
}
