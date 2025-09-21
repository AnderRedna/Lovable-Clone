"use client";

import { Palette, BarChart3, Layers, Clock, Mail, CreditCard, Lock, Search, PenTool } from "lucide-react";

type StepChoices = {
  seoPremium: boolean;
  copyPremium: boolean;
  palette: boolean;
  monitoring: boolean;
  components: boolean;
};

type Props = {
  value: StepChoices;
  onChange: (next: StepChoices) => void;
};

const options = [
  { key: "seoPremium", label: "SEO Premium", description: "Otimização avançada para mecanismos de busca.", icon: Search, locked: true },
  { key: "copyPremium", label: "Copy Premium", description: "Textos persuasivos com gatilhos de conversão.", icon: PenTool, locked: true },
  { key: "palette", label: "Paleta de cores", description: "Defina a identidade de cores do projeto.", icon: Palette, locked: false },
  { key: "monitoring", label: "Monitoramento", description: "Configure métricas e observabilidade.", icon: BarChart3, locked: false },
  { key: "components", label: "Componentes", description: "Escolha e configure componentes base.", icon: Layers, locked: false },
] as const;

const comingSoonOptions = [
  { label: "Coleta de emails", icon: Mail },
  { label: "Pagamentos", icon: CreditCard },
  { label: "Em breve", icon: Clock },
  { label: "Em breve", icon: Clock },
  { label: "Em breve", icon: Clock },
  { label: "Em breve", icon: Clock },
] as const;

export function StepOptionSelector({ value, onChange }: Props) {
  const toggle = (key: keyof StepChoices) => {
    // Não permite desmarcar SEO Premium e Copy Premium
    if (key === "seoPremium" || key === "copyPremium") return;
    onChange({ ...value, [key]: !value[key] });
  };

  return (
    <div className="h-full overflow-auto">
      <h2 className="text-xl font-semibold mb-4">Selecione as etapas que deseja configurar</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {options.map((opt) => {
          const selected = value[opt.key];
          const Icon = opt.icon;
          const isLocked = opt.locked;
          const isSEOPremium = opt.key === "seoPremium";
          const isCopyPremium = opt.key === "copyPremium";
          const isPremiumOption = isSEOPremium || isCopyPremium;
          
          return (
            <button
              type="button"
              key={opt.key}
              onClick={() => toggle(opt.key)}
              className={`relative rounded-lg border p-5 transition w-full text-center ${
                isPremiumOption 
                  ? "border-yellow-400 ring-2 ring-yellow-400/30 cursor-default" 
                  : selected 
                    ? "border-primary ring-2 ring-primary/30 bg-primary/5" 
                    : "hover:bg-muted"
              }`}
            >
              {selected && (
                <span className={`absolute top-2 right-2 h-5 w-5 inline-flex items-center justify-center rounded-full text-[10px] ${
                  isPremiumOption 
                    ? "bg-yellow-500 text-white" 
                    : "bg-primary text-primary-foreground"
                }`}>
                  ✓
                </span>
              )}
              {isLocked && (
                <span className="absolute top-2 left-2 h-5 w-5 inline-flex items-center justify-center rounded-full text-[10px] bg-yellow-500 text-white">
                  <Lock className="size-3" />
                </span>
              )}
              <span
                className={`mx-auto size-12 grid place-items-center rounded-md border ${
                  isPremiumOption
                    ? "bg-yellow-100 text-yellow-600 border-yellow-300"
                    : selected 
                      ? "bg-primary/10 text-primary border-primary/30" 
                      : "bg-muted text-foreground/60 border-transparent"
                }`}
              >
                <Icon className="size-6" />
              </span>
              <div className={`mt-3 text-sm font-medium`}>
                {opt.label}
              </div>
              <div className={`text-xs mt-1 text-foreground/60`}>
                {opt.description}
              </div>
            </button>
          );
        })}
        {comingSoonOptions.map((opt, i) => {
          const Icon = opt.icon;
          return (
            <div
              key={`soon-${i}`}
              className="relative rounded-lg border p-5 w-full text-center bg-muted/40 opacity-70 cursor-not-allowed"
              aria-disabled
            >
              <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-muted-foreground/20 text-foreground/60">
                em breve
              </span>
              <span className="mx-auto size-12 grid place-items-center rounded-md border bg-muted text-foreground/60 border-transparent">
                <Icon className="size-6" />
              </span>
              <div className="mt-3 text-sm font-medium text-foreground/70">{opt.label}</div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-foreground/60 mt-3">Você pode avançar apenas com o que for relevante agora.</p>
    </div>
  );
}

export type { StepChoices };