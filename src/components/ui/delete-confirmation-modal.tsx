"use client";

import { useEffect } from "react";
import { Button } from "./button";
import { Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isLoading?: boolean;
};

export function DeleteConfirmationModal({ 
  open, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  isLoading = false 
}: Props) {
  useEffect(() => {
    if (open) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }

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
        className="bg-background border rounded-xl shadow-2xl p-6 max-w-md w-[90vw] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
        
        <p className="text-muted-foreground mb-6">{description}</p>
        
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Excluindo..." : "Excluir"}
          </Button>
        </div>
      </div>
    </div>
  );
}