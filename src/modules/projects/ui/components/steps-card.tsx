import { CheckCircle, Loader } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

interface StepState {
  text: string;
  state: "pending" | "completed";
}

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist progress and start timestamp on changes
  useEffect(() => {
    if (visibleSteps.length) saveProgress(messageId, visibleSteps);
    if (typeof window !== "undefined") {
      localStorage.setItem(`steps-start:${messageId}`, String(startTs));
    }
  }, [messageId, visibleSteps, startTs]);

  // When steps prop changes (rare), ensure at least first step is visible
  useEffect(() => {
    if (visibleSteps.length === 0 && steps?.length) {
      setVisibleSteps([{ text: steps[0], state: "pending" }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  useEffect(() => {
    if (!steps?.length) return;

    if (forceComplete) {
      const allDone: StepState[] = steps.map((t) => ({ text: t, state: "completed" }));
      setVisibleSteps(allDone);
      return;
    }

    // Start timer baseline on first render with steps
    if (visibleSteps.length === 0) {
      setStartTs((prev) => {
        const now = Date.now();
        return prev || now;
      });
      setVisibleSteps([{ text: steps[0], state: "pending" }]);
    }

    const sync = () => {
      const elapsed = Date.now() - startTs;
      const stepMs = 20000;
      // Never auto-complete the last step; it completes only with forceComplete
      const maxCompletable = Math.max(0, steps.length - 1);
      const completedCount = Math.min(Math.floor(elapsed / stepMs), maxCompletable);
      const next: StepState[] = [];
      for (let i = 0; i < steps.length; i++) {
        if (i < completedCount) next.push({ text: steps[i], state: "completed" });
        else if (i === completedCount) next.push({ text: steps[i], state: "pending" });
        else break; // do not reveal further steps yet
      }
      if (next.length && JSON.stringify(next) !== JSON.stringify(visibleSteps)) {
        setVisibleSteps(next);
      }
    };

    // Initial sync and then every second for resilience
    sync();
    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = setInterval(sync, 1000) as any;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
    };
  }, [steps, startTs, forceComplete, visibleSteps]);

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
