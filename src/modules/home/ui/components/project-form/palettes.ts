export type ColorPalette = {
  id: string;
  name: string;
  colors: [string, string, string, string];
};

export const curatedPalettes: ColorPalette[] = [
  {
    id: "azure-breeze",
    name: "Azul (padrão)",
    colors: ["#0EA5E9", "#3B82F6", "#1E293B", "#E2E8F0"],
  },
  {
    id: "sunset-pop",
    name: "Sunset Pop",
    colors: ["#FFBE0B", "#FB5607", "#FF006E", "#8338EC"],
  },
  {
    id: "forest-fresh",
    name: "Forest Fresh",
    colors: ["#2B9348", "#55A630", "#80B918", "#AACC00"],
  },
  {
    id: "citrus-wave",
    name: "Citrus Wave",
    colors: ["#FFD166", "#06D6A0", "#118AB2", "#EF476F"],
  },
  {
    id: "earth-tones",
    name: "Earth Tones",
    colors: ["#606C38", "#283618", "#DDA15E", "#BC6C25"],
  },
  {
    id: "teal-mint",
    name: "Teal Mint",
    colors: ["#0F766E", "#14B8A6", "#2DD4BF", "#99F6E4"],
  },
  {
    id: "magenta-glow",
    name: "Magenta Glow",
    colors: ["#F72585", "#B5179E", "#7209B7", "#560BAD"],
  },
  {
    id: "mono-soft",
    name: "Mono Soft",
    colors: ["#111827", "#374151", "#9CA3AF", "#F3F4F6"],
  },
];

export async function fetchMorePalettes(): Promise<ColorPalette[]> {
  try {
    const res = await fetch(
      "https://unpkg.com/nice-color-palettes@3.0.0/1000.json",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Fetch failed");
    const data: string[][] = await res.json();
    const toHex = (c: string) => c.trim().toUpperCase();
    const mapped: ColorPalette[] = data
      .map((arr, i) => arr.slice(0, 4))
      .filter((arr) => arr.length === 4)
      .map((arr, i) => ({
        id: `nice-${i}`,
        name: `Nice Palette ${i + 1}`,
        colors: [toHex(arr[0]), toHex(arr[1]), toHex(arr[2]), toHex(arr[3])],
      }));

    return mapped.slice(0, 32);
  } catch {
    return [];
  }
}
