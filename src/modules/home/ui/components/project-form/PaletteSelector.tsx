"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "../../../../../lib/utils";
import { ColorPalette, curatedPalettes, fetchMorePalettes } from "./palettes";

type Props = {
  value?: ColorPalette | null;
  onChange: (palette: ColorPalette) => void;
  title?: string;
  allowRefresh?: boolean;
  className?: string;
};

export function PaletteSelector({
  value,
  onChange,
  title = "Paleta de cores",
  allowRefresh = true,
  className,
}: Props) {
  const [palettes, setPalettes] = useState<ColorPalette[]>(curatedPalettes);
  const selected = value ?? palettes[0];

  useEffect(() => {
    if (!value && palettes.length) {
      onChange(palettes[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    const more = await fetchMorePalettes();
    if (more.length) {
      const key = (p: ColorPalette) => `${p.id}-${p.colors.join(",")}`;
      const merged = [...palettes, ...more];
      const unique = Array.from(new Map(merged.map((p) => [key(p), p])).values());
      setPalettes(unique);
    }
  };

  const isSelected = (p: ColorPalette) =>
    selected && p.colors.join(",") === selected.colors.join(",");

  const grid = useMemo(() => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-56 md:max-h-64 overflow-y-auto pr-1">
        {palettes.map((p) => (
          <button
            key={`${p.id}-${p.colors.join(",")}`}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "group relative rounded-lg border bg-background p-2 text-left transition-all",
              "hover:border-primary/60 hover:shadow-sm",
              isSelected(p) && "ring-2 ring-primary border-primary"
            )}
            aria-pressed={isSelected(p)}
          >
            <div className="flex overflow-hidden rounded-md">
              {p.colors.map((c, idx) => (
                <div
                  key={idx}
                  className="h-10 w-1/4"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className={cn("text-xs", isSelected(p) && "font-semibold")}>
                {p.name}
              </span>
              {isSelected(p) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                  selecionada
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  }, [palettes, selected]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {allowRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            className="text-xs px-2 py-1 rounded border hover:bg-muted transition shrink-0"
            title="Buscar novas paletas"
          >
            Atualizar paletas
          </button>
        )}
      </div>
      {grid}
      {selected ? (
        <div className="text-[11px] text-muted-foreground">
          Paleta selecionada: {selected.name} — {selected.colors.join(" • ")}
        </div>
      ) : null}
    </div>
  );
}

export type { ColorPalette };
