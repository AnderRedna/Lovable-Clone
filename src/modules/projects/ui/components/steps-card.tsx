import { CheckCircle, Loader } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

interface StepState {
  text: string;
  state: "pending" | "completed";
}

const deepEqual = (a: StepState[], b: StepState[]) => JSON.stringify(a) === JSON.stringify(b);

function loadProgress(messageId: string): StepState[] | null {
  try {
    const raw = localStorage.getItem(`steps-progress:${messageId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveProgress(messageId: string, steps: StepState[]) {
  try {
    localStorage.setItem(`steps-progress:${messageId}`, JSON.stringify(steps));
  } catch {}
}

export function StepsCard({ steps, messageId, forceComplete }: { steps: string[]; messageId: string; forceComplete?: boolean }) {
  const [startTs, setStartTs] = useState<number>(() => {
    if (typeof window === "undefined") return Date.now();
    const raw = localStorage.getItem(`steps-start:${messageId}`);
    const t = raw ? Number(raw) : NaN;
    return Number.isFinite(t) ? t : Date.now();
  });

  const initial = useMemo<StepState[]>(() => {
    const persisted = typeof window !== "undefined" ? loadProgress(messageId) : null;
    if (persisted && persisted.length) return persisted;
    if (!steps?.length) return [];
    return [{ text: steps[0], state: "pending" as const }];
  }, [steps, messageId]);

  const [visibleSteps, setVisibleSteps] = useState<StepState[]>(initial);
  const [tick, setTick] = useState(0);

  // Persist progress and start timestamp on changes
  useEffect(() => {
    if (visibleSteps.length) saveProgress(messageId, visibleSteps);
    if (typeof window !== "undefined") {
      localStorage.setItem(`steps-start:${messageId}`, String(startTs));
    }
  }, [messageId, visibleSteps, startTs]);

  // Drive a 1s tick while processing steps (not forced complete)
  useEffect(() => {
    if (!steps?.length || forceComplete) return;
    const id = setInterval(() => setTick((t) => (t + 1) % 1000000), 1000);
    return () => clearInterval(id);
  }, [steps?.length, forceComplete]);

  // Compute visible steps based on elapsed time and props
  useEffect(() => {
    if (!steps?.length) return;

    if (forceComplete) {
      const allDone: StepState[] = steps.map((t) => ({ text: t, state: "completed" }));
      setVisibleSteps((prev) => (deepEqual(prev, allDone) ? prev : allDone));
      return;
    }

    const elapsed = Date.now() - startTs;
    const stepMs = 20000;
    const maxCompletable = Math.max(0, steps.length - 1);
    const completedCount = Math.min(Math.floor(elapsed / stepMs), maxCompletable);
    const next: StepState[] = [];
    for (let i = 0; i < steps.length; i++) {
      if (i < completedCount) next.push({ text: steps[i], state: "completed" });
      else if (i === completedCount) next.push({ text: steps[i], state: "pending" });
      else break;
    }
    if (next.length) {
      setVisibleSteps((prev) => (deepEqual(prev, next) ? prev : next));
    }
  }, [steps, startTs, forceComplete, tick]);

  return (
    <div className="flex flex-col group px-2 pb-4">
      <div className="flex items-center gap-2 pl-2 mb-2">
        <Image src="/logo.svg" alt="lovable-clone" height={18} width={18} className="shrink-0" />
        <span className="text-sm font-medium">Landinfy</span>
      </div>
      <div className="pl-8.5 flex flex-col gap-y-2">
        {visibleSteps.map((step, index) => (
          <div key={index} className="flex items-center gap-2">
            {step.state === "completed" ? (
              <CheckCircle className="h-4 w-4 text-green-500" />)
              : (<Loader className="h-4 w-4 text-muted-foreground animate-spin" />)}
            <span className={`text-base ${step.state === "completed" ? "text-muted-foreground/80" : "text-muted-foreground animate-pulse"}`}>
              {step.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
