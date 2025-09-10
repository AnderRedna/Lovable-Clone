"use client";

import Link from "next/link";
import TextareaAutosize from "react-textarea-autosize";
import { Label } from "../../../../../components/ui/label";
import { cn } from "../../../../../lib/utils";
import type { ComponentKey, ComponentConfig } from "./types";

type Props = {
  isPending: boolean;
  componentKeys: ComponentKey[];
  componentsCfg: Record<ComponentKey, ComponentConfig>;
  setComponentsCfg: (updater: (prev: Record<ComponentKey, ComponentConfig>) => Record<ComponentKey, ComponentConfig>) => void;
};

export function ComponentsStep({ isPending, componentKeys, componentsCfg, setComponentsCfg }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Componentes</h2>
  <div>
        <div className="mb-4 text-sm font-medium">Selecione os componentes</div>
        <div className="grid grid-cols-3 gap-3">
          {componentKeys.map((key) => {
            const selected = componentsCfg[key].enabled;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setComponentsCfg((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], enabled: !prev[key].enabled },
                  }))
                }
                className={cn(
                  "border rounded-lg p-3 text-left text-sm transition-colors",
                  "hover:border-primary",
                  selected && "border-primary bg-primary/5"
                )}
              >
                <div className="font-medium text-sm">{key}</div>
              </button>
            );
          })}
        </div>
        {componentKeys.every((k) => !componentsCfg[k].enabled) && (
          <div className="mt-4 text-xs text-muted-foreground">
            Nenhum componente selecionado. Você pode prosseguir sem componentes.
          </div>
        )}
      </div>
    </div>
  );
}
