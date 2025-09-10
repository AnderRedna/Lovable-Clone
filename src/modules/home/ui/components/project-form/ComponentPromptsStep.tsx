"use client";

import Link from "next/link";
import TextareaAutosize from "react-textarea-autosize";
import { Label } from "../../../../../components/ui/label";
import { cn } from "../../../../../lib/utils";
import type { ComponentKey, ComponentConfig } from "./types";

type Props = {
  isPending: boolean;
  orderedKeys: ComponentKey[]; // only enabled ones, ordered
  index: number; // current index within orderedKeys
  componentsCfg: Record<ComponentKey, ComponentConfig>;
  setComponentsCfg: (updater: (prev: Record<ComponentKey, ComponentConfig>) => Record<ComponentKey, ComponentConfig>) => void;
};

export function ComponentPromptsStep({ isPending, orderedKeys, index, componentsCfg, setComponentsCfg }: Props) {
  const k = orderedKeys[index];
  const cfg = componentsCfg[k];

  if (!k) {
    return (
      <div className="text-sm text-muted-foreground">Nenhum componente selecionado. Avance para concluir.</div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Componente {index + 1} de {orderedKeys.length}</h2>
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">{k}</div>
          <Link
            href="https://21st.dev/components"
            target="_blank"
            className="text-xs text-primary hover:underline"
          >
            Ver prompts no 21st.dev
          </Link>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`prompt-${k}`}>Prompt do componente (opcional)</Label>
          <TextareaAutosize
            id={`prompt-${k}`}
            minRows={4}
            maxRows={12}
            className="w-full resize-y rounded-md border bg-transparent p-2 text-sm"
            placeholder={`Descreva o conteúdo/estilo para ${k}`}
            value={cfg?.prompt ?? ""}
            onChange={(e) =>
              setComponentsCfg((prev) => ({
                ...prev,
                [k]: { ...prev[k], prompt: e.target.value },
              }))
            }
            disabled={isPending}
          />

          <div className="flex items-center gap-2 mt-2">
            <input
              id={`border-${k}`}
              type="checkbox"
              className="size-4"
              checked={!!cfg?.border?.enabled}
              onChange={(e) =>
                setComponentsCfg((prev) => ({
                  ...prev,
                  [k]: {
                    ...prev[k],
                    border: { ...(prev[k].border || { prompt: "" }), enabled: e.target.checked },
                  },
                }))
              }
            />
            <Label htmlFor={`border-${k}`}>Definir borda</Label>
          </div>

          {cfg?.border?.enabled && (
            <div className="space-y-2 mt-2">
              <Label htmlFor={`border-prompt-${k}`}>Prompt da borda</Label>
              <TextareaAutosize
                id={`border-prompt-${k}`}
                minRows={2}
                maxRows={8}
                className={cn(
                  "w-full resize-y rounded-md border bg-transparent p-2 text-sm",
                  !cfg?.border?.prompt && "border-destructive/50"
                )}
                placeholder={`Descreva a borda a aplicar em ${k}`}
                value={cfg?.border?.prompt ?? ""}
                onChange={(e) =>
                  setComponentsCfg((prev) => ({
                    ...prev,
                    [k]: {
                      ...prev[k],
                      border: { ...(prev[k].border || { enabled: true }), prompt: e.target.value },
                    },
                  }))
                }
                disabled={isPending}
              />
              {!cfg?.border?.prompt && (
                <div className="text-[10px] text-destructive">Informe o prompt da borda para concluir.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
