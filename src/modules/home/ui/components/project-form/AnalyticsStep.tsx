"use client";

import TextareaAutosize from "react-textarea-autosize";
import { Label } from "../../../../../components/ui/label";
import { cn } from "../../../../../lib/utils";
import { BarChart3, MousePointerClick, Sparkles, CircleSlash } from "lucide-react";
import type { AnalyticsProvider, AnalyticsState } from "./types";

type Props = {
  isPending: boolean;
  analytics: AnalyticsState;
  setAnalytics: (updater: (prev: AnalyticsState) => AnalyticsState) => void;
};

export function AnalyticsStep({ isPending, analytics, setAnalytics }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Monitoramento</h2>
      <div className="grid grid-cols-2 gap-3">
        {([
          { key: "google-analytics", label: "Google Analytics", icon: BarChart3 },
          { key: "clarity", label: "Clarity", icon: MousePointerClick },
          { key: "other", label: "Outros", icon: Sparkles },
          { key: "none", label: "Nenhum", icon: CircleSlash },
        ] as { key: AnalyticsProvider; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[]).map((opt) => {
          const selected = analytics.provider === opt.key;
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() =>
                setAnalytics((a) => ({ ...a, provider: opt.key, code: opt.key === "none" ? "" : a.code }))
              }
              className={cn(
                "border rounded-lg p-3 text-left transition-colors",
                "hover:border-primary",
                selected && "border-primary bg-primary/5"
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn("size-4", selected ? "text-primary" : "text-muted-foreground")} />
                <div className="font-medium text-sm">{opt.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {analytics.provider !== "none" && (
        <div className="space-y-2">
          <Label htmlFor="analytics-code">Código de inserção no head</Label>
          <TextareaAutosize
            id="analytics-code"
            minRows={8}
            className="w-full resize-y rounded-md border bg-transparent p-2 text-sm"
            placeholder={
              analytics.provider === "google-analytics"
                ? "<!-- GA4 snippet -->\n<script>/* ... */</script>"
                : analytics.provider === "clarity"
                ? "<!-- Clarity snippet -->\n<script>/* ... */</script>"
                : "Cole aqui o código do seu provedor"
            }
            value={analytics.code}
            onChange={(e) => setAnalytics((a) => ({ ...a, code: e.target.value }))}
            disabled={isPending}
          />
        </div>
      )}
    </div>
  );
}
