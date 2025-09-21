"use client";

import { useMemo, useState } from "react";
import { WizardModal } from "./WizardModal";
import { StepOptionSelector, type StepChoices } from "./steps/StepOptionSelector";
import { ColorPaletteStep } from "./steps/ColorPaletteStep";
import { AnalyticsStep } from "./AnalyticsStep";
import { ComponentsStep } from "./ComponentsStep";
import type { AnalyticsState, ComponentKey, ComponentConfig } from "./types";
import { Button } from "@/components/ui/button";
import { getOrderedComponentKeys } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  initialChoices?: StepChoices;
  selectedPalette: any; // ColorPalette | null (avoid circular import types here)
  setSelectedPalette: (p: any | null) => void;
  analytics: AnalyticsState;
  setAnalytics: (updater: (prev: AnalyticsState) => AnalyticsState) => void;
  componentKeys: ComponentKey[];
  componentsCfg: Record<ComponentKey, ComponentConfig>;
  setComponentsCfg: (updater: (prev: Record<ComponentKey, ComponentConfig>) => Record<ComponentKey, ComponentConfig>) => void;
  isPending: boolean;
  canFinish: boolean;
  onFinish: () => Promise<void> | void;
};

export function ProjectWizard({
  open,
  onClose,
  initialChoices,
  selectedPalette,
  setSelectedPalette,
  analytics,
  setAnalytics,
  componentKeys,
  componentsCfg,
  setComponentsCfg,
  isPending,
  canFinish,
  onFinish,
}: Props) {
  const [choices, setChoices] = useState<StepChoices>(
    initialChoices ?? { seoPremium: true, copyPremium: true, palette: true, monitoring: false, components: false }
  );

  const steps = useMemo(() => {
    const labels = ["Seleção de etapas"];
    if (choices.palette) labels.push("Paleta de cores");
    if (choices.monitoring) labels.push("Monitoramento");
    if (choices.components) labels.push("Componentes");
    return labels;
  }, [choices]);

  const [stepIndex, setStepIndex] = useState(0);

  const content = useMemo(() => {
    if (stepIndex === 0) return <StepOptionSelector value={choices} onChange={setChoices} />;
    let idx = 1;
    if (choices.palette) {
      if (stepIndex === idx)
        return <ColorPaletteStep value={selectedPalette ?? null} onChange={setSelectedPalette} />;
      idx++;
    }
    if (choices.monitoring) {
      if (stepIndex === idx)
        return (
          <AnalyticsStep isPending={isPending} analytics={analytics} setAnalytics={setAnalytics} />
        );
      idx++;
    }
    if (choices.components) {
      if (stepIndex === idx)
        return (
          <ComponentsStep
            isPending={isPending}
            componentKeys={componentKeys}
            componentsCfg={componentsCfg}
            setComponentsCfg={setComponentsCfg}
          />
        );
      idx++;
    }
    return null;
  }, [stepIndex, choices, selectedPalette, isPending, analytics, componentsCfg]);

  const canGoNextFromSelection = choices.palette || choices.monitoring || choices.components;
  const isLast = stepIndex === steps.length - 1;

  const goNext = async () => {
    if (isLast) {
      if (canFinish) await onFinish();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };
  const goPrev = () => setStepIndex((i) => Math.max(0, i - 1));

  return (
    <WizardModal
      open={open}
      steps={steps}
      stepIndex={stepIndex}
      onClose={onClose}
      footer={
        <div className="w-full flex items-center justify-between">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={goPrev} disabled={stepIndex === 0}>
              Voltar
            </Button>
            {!isLast ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={stepIndex === 0 && !canGoNextFromSelection}
              >
                Avançar
              </Button>
            ) : (
              <Button type="button" onClick={goNext} disabled={!canFinish || isPending}>
                Concluir
              </Button>
            )}
          </div>
        </div>
      }
    >
      {content}
    </WizardModal>
  );
}