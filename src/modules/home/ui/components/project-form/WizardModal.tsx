"use client";

import { useEffect } from "react";
import { cn } from "../../../../../lib/utils";
import { WizardStepper } from "./WizardStepper";

type Props = {
  open: boolean;
  steps: string[];
  stepIndex: number; // 0-based
  children: React.ReactNode;
  footer: React.ReactNode;
  beforeFooter?: React.ReactNode;
  onClose?: () => void;
};

export function WizardModal({ open, steps, stepIndex, children, footer, beforeFooter, onClose }: Props) {
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
          open && "scale-100 opacity-100 w-[95vw] h-[85vh] max-w-[95vw] max-h-[90vh] md:w-[80vw] md:h-[70vh] md:max-w-3xl md:max-h-[75vh]"
        )}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="flex flex-col h-full">
          <div className="flex flex-1 flex-col md:flex-row min-h-0">
            <WizardStepper labels={steps} current={stepIndex} />
            <div className="flex-1 min-w-0 p-6 overflow-hidden">
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
