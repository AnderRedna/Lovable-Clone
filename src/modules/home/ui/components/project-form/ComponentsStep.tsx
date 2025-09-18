"use client";

import Link from "next/link";
import TextareaAutosize from "react-textarea-autosize";
import { Label } from "../../../../../components/ui/label";
import { cn } from "../../../../../lib/utils";
import type { ComponentKey, ComponentConfig } from "./types";
import { COMPONENT_TRANSLATIONS, getOrderedComponentKeys } from "./types";

type Props = {
  isPending: boolean;
  componentKeys: ComponentKey[];
  componentsCfg: Record<ComponentKey, ComponentConfig>;
  setComponentsCfg: (updater: (prev: Record<ComponentKey, ComponentConfig>) => Record<ComponentKey, ComponentConfig>) => void;
};

export function ComponentsStep({ isPending, componentKeys, componentsCfg, setComponentsCfg }: Props) {
  const orderedKeys = getOrderedComponentKeys(componentKeys, componentsCfg);
  const getDisplayOrder = (key: ComponentKey) => {
    const index = orderedKeys.indexOf(key);
    return index >= 0 ? index + 1 : null;
  };
  const handleComponentToggle = (key: ComponentKey) => {
    setComponentsCfg((prev) => {
      const newCfg = { ...prev };
      const wasEnabled = newCfg[key].enabled;
      const newEnabled = !wasEnabled;

      if (newEnabled) {
        // Enabling: assign next available order
        const existingOrders = componentKeys
          .filter(k => newCfg[k].enabled)
          .map(k => newCfg[k].order || 0)
          .filter(order => order > 0);
        const nextOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 1;
        newCfg[key] = { ...newCfg[key], enabled: true, order: nextOrder };
      } else {
        // Disabling: clear order and reorder remaining components
        newCfg[key] = { ...newCfg[key], enabled: false, order: undefined };

        // Reorder remaining enabled components
        const enabledKeys = componentKeys.filter(k => newCfg[k].enabled);
        enabledKeys.forEach((k, index) => {
          newCfg[k] = { ...newCfg[k], order: index + 1 };
        });
      }

      return newCfg;
    });
  };
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
                onClick={() => handleComponentToggle(key)}
                className={cn(
                  "border rounded-lg p-3 text-left text-sm transition-colors relative",
                  "hover:border-primary",
                  selected && "border-primary bg-primary/5"
                )}
              >
                {selected && (
                  <div className="absolute -top-1 -left-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {getDisplayOrder(key)}
                  </div>
                )}
                <div className="font-medium text-sm">{COMPONENT_TRANSLATIONS[key]}</div>
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
