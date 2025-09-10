"use client";

import { useEffect } from "react";
import { cn } from "../../../../../lib/utils";
import { WizardStepper } from "./WizardStepper";

type Props = {
  open: boolean;
  step: 1 | 2 | 3;
  children: React.ReactNode;
  footer: React.ReactNode;
  beforeFooter?: React.ReactNode;
  subStepLabel?: string;
  onClose?: () => void;
};

export function WizardModal({ open, step, children, footer, beforeFooter, subStepLabel, onClose }: Props) {
  useEffect(() => {
    if (open) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "bg-background border rounded-xl shadow-2xl overflow-hidden transition-all duration-500 ease-out",
          "w-80 h-80 scale-50 opacity-0",
          open && "scale-100 opacity-100 w-[80vw] h-[70vh] max-w-3xl max-h-[60vh]"
        )}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="flex flex-col h-full">
          <div className="flex flex-1">
            <WizardStepper step={step} subStepLabel={subStepLabel} />
            <div className="flex-1 p-6 overflow-y-auto">
              {children}
            </div>
          </div>
          {beforeFooter && (
            <div className="px-6 py-3 border-t bg-muted/50">
              {beforeFooter}
            </div>
          )}
          <div className="flex justify-between items-center p-6 border-t">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
