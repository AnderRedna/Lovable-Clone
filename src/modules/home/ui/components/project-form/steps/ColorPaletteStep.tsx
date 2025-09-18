"use client";

import { PaletteSelector, type ColorPalette } from "../PaletteSelector";

type Props = {
  value: ColorPalette | null;
  onChange: (p: ColorPalette | null) => void;
};

export function ColorPaletteStep({ value, onChange }: Props) {
  return (
    <div className="h-full overflow-hidden">
      <h2 className="text-xl font-semibold mb-4">Paleta de cores</h2>
      <PaletteSelector value={value ?? undefined} onChange={(p) => onChange(p)} title="Paleta de cores do site" />
    </div>
  );
}