import { CheckCircle, Loader } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface Step {
  text: string;
  state: "pending" | "completed";
}

const ShimmerMessages = ({ steps: stepsProp }: { steps?: string[] }) => {
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    if (!stepsProp || stepsProp.length === 0) {
      if (steps.length > 0) {
        setSteps([]);
      }
      return;
    }

    const areDifferent =
      steps.length !== stepsProp.length ||
      stepsProp.some((s, i) => steps[i]?.text !== s);

    if (areDifferent) {
      setSteps(stepsProp.map((s) => ({ text: s, state: "pending" })));
    }
  }, [stepsProp]);

  useEffect(() => {
    if (steps.length > 0) {
      const totalDuration = 120000; // 2 minutes
      const stepDuration = totalDuration / (steps.length || 1);

      const stepInterval = setInterval(() => {
        let stop = false;
        setSteps((currentSteps) => {
          const nextPendingIndex = currentSteps.findIndex(
            (s) => s.state === "pending"
          );
          if (nextPendingIndex !== -1) {
            // If only the last step is pending, stop updating to avoid loops
            if (nextPendingIndex === currentSteps.length - 1) {
              stop = true;
              return currentSteps;
            }
            const newSteps = [...currentSteps];
            newSteps[nextPendingIndex] = {
              ...newSteps[nextPendingIndex],
              state: "completed",
            };
            return newSteps;
          }
          return currentSteps;
        });
        if (stop) clearInterval(stepInterval);
      }, stepDuration);

      return () => clearInterval(stepInterval);
    }
  }, [steps.length]);

  if (!steps.length) {
    return (
      <div className="flex items-center gap-2">
        <Loader className="size-4 text-muted-foreground animate-spin shrink-0" />
        <span className="text-base text-muted-foreground animate-pulse">
          Pensando nas próximas etapas...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-2">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-2">
          {step.state === "completed" ? (
            <CheckCircle className="size-4 text-green-500 shrink-0" />
          ) : (
            <Loader className="size-4 text-muted-foreground animate-spin shrink-0" />
          )}
          <span
            className={`text-base ${
              step.state === "completed"
                ? "text-muted-foreground/80"
                : "text-muted-foreground animate-pulse"
            }`}
          >
            {step.text}
          </span>
        </div>
      ))}
    </div>
  );
};

const MessageLoading = ({ steps }: { steps?: string[] }) => {
  return (
    <div className="flex flex-col group px-2 pb-4">
      <div className="flex items-center gap-2 pl-2 mb-2">
        <Image
          src="/logo.svg"
          alt="lovable-clone"
          height={18}
          width={18}
          className="shrink-0"
        />
        <span className="text-sm font-medium">Landinfy</span>
      </div>
      <div className="pl-8.5 flex flex-col gap-y-4">
        <ShimmerMessages steps={steps} />
      </div>
    </div>
  );
};

export { MessageLoading };
