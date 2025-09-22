"use client";

import { useState, useRef, useEffect } from "react";
import { Palette, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorPalette, curatedPalettes, fetchMorePalettes } from "./palettes";

type Props = {
  selectedPalette: ColorPalette | null;
  onPaletteSelect: (palette: ColorPalette | null) => void;
  className?: string;
};

export function PaletteButton({ selectedPalette, onPaletteSelect, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [palettes, setPalettes] = useState<ColorPalette[]>(curatedPalettes);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Set default palette on mount
  useEffect(() => {
    if (!selectedPalette && curatedPalettes.length > 0) {
      onPaletteSelect(curatedPalettes[0]);
    }
  }, [selectedPalette, onPaletteSelect]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const more = await fetchMorePalettes();
      if (more.length) {
        // Pick 5 random palettes from the fetched ones
        const shuffled = more.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 5);
        setPalettes(selected);
      }
    } catch (error) {
      console.error("Failed to fetch palettes:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const displayPalettes = palettes.slice(0, 5);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-6 w-6 rounded border hover:border-gray-400 transition-colors flex items-center justify-center",
          "border-gray-200 dark:border-gray-600"
        )}
        style={{
          backgroundColor: selectedPalette?.colors[0] || "#E5E7EB",
        }}
        title={selectedPalette ? `Paleta: ${selectedPalette.name}` : "Selecionar paleta de cores"}
      >
        {!selectedPalette && <Palette className="h-3 w-3 text-gray-600" />}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-8 left-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Paletas de cores
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-xs px-2 py-1 rounded border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Buscar novas paletas"
            >
              <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            </button>
          </div>

          <div className="space-y-2">
            {displayPalettes.map((palette) => (
              <button
                key={palette.id}
                type="button"
                onClick={() => {
                  onPaletteSelect(palette);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                  selectedPalette?.id === palette.id && "bg-gray-100 dark:bg-gray-700"
                )}
              >
                <div className="flex rounded overflow-hidden">
                  {palette.colors.map((color, index) => (
                    <div
                      key={index}
                      className="w-3 h-3"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                  {palette.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}