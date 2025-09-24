"use client";

import { useClerk } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpIcon, Loader2Icon, SettingsIcon, ChevronLeft, SparklesIcon, Zap } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { PROJECT_TEMPLATES } from "@/constants";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useRouter } from "next/navigation";
import { AnalyticsStep, ComponentsStep, ComponentPromptsStep } from "./project-form/index";
import { WizardModal } from "./project-form/WizardModal";
import { ProjectWizard } from "./project-form/ProjectWizard";
import type { ColorPalette } from "./project-form/PaletteSelector";
import { PaletteButton } from "./project-form/PaletteButton";
import { curatedPalettes } from "./project-form/palettes";
import { getOrderedComponentKeys } from "./project-form/types";

const formSchema = z.object({
  value: z.string().min(1, { message: "Value is required" }),
});

const ProjectForm = () => {
  const router = useRouter();
  const clerk = useClerk();

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: "",
    },
  });

  const createProject = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: (data) => {
        router.push(`/projects/${data.id}`);

        queryClient.invalidateQueries(trpc.projects.getMany.queryOptions());
        queryClient.invalidateQueries(trpc.usage.status.queryOptions());
      },
      onError: (error) => {
        if (error.data?.code === "UNAUTHORIZED") {
          clerk.openSignIn();
        }

        if (error.data?.code === "TOO_MANY_REQUESTS") {
          router.push("/pricing");
        }

        // Verificar se é erro de limite de projetos
        if (error.message.includes("Você já possui 2 projetos")) {
          toast.error(
            "Limite de projetos atingido! Você pode ter no máximo 2 projetos. Exclua um projeto existente para criar um novo.",
            {
              duration: 6000,
              position: "top-center",
            }
          );
        } else {
          toast.error(error.message);
        }
      },
    })
  );

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const customization = (isCustomizing || selectedPalette)
      ? {
          analytics: isCustomizing ? analytics : ({ provider: "none", code: "" } as const),
          components: isCustomizing ? componentsCfg : ({} as Record<string, any>),
          theme: selectedPalette
            ? {
                paletteId: selectedPalette.id,
                paletteName: selectedPalette.name,
                colors: selectedPalette.colors,
              }
            : undefined,
        }
      : undefined;

    await createProject.mutateAsync({
      value: values.value,
      customization,
    });
  };

  const onSelectTemplate = (content: string) => {
    form.setValue("value", content, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const improveMutation = useMutation(
    trpc.prompts.improve.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Não foi possível melhorar o prompt");
      },
      onSuccess: (data) => {
        form.setValue("value", data.value, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
        toast.success("Prompt melhorado!");
      },
    })
  );

  const improvePrompt = async () => {
    const current = form.getValues("value");
    if (!current.trim()) return;
    await improveMutation.mutateAsync({ value: current });
  };

  const [isFocused, setIsFocused] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [wizardActive, setWizardActive] = useState(false);
  // legacy step state removed; new wizard handles steps dynamically
  const [componentEditIndex, setComponentEditIndex] = useState<number | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<ColorPalette | null>(curatedPalettes[0]);

  type AnalyticsProvider = import("./project-form/types").AnalyticsProvider;
  type ComponentKey = import("./project-form/types").ComponentKey;
  type ComponentConfig = import("./project-form/types").ComponentConfig;

  const componentKeys: ComponentKey[] = [
    "Background",
    "Announcement",
    "CallToAction",
    "Clients",
    "Features",
    "Footers",
    "Heroes",
    "Images",
    "Header",
    "Pricing",
    "Testimonials",
    "Video",
  ];

  const [analytics, setAnalytics] = useState<{ provider: AnalyticsProvider; code?: string }>({
    provider: "none",
    code: "",
  });

  const [componentsCfg, setComponentsCfg] = useState<Record<ComponentKey, ComponentConfig>>(
    () =>
      componentKeys.reduce((acc, key) => {
        acc[key] = { enabled: false, prompt: "", border: { enabled: false, prompt: "" }, order: undefined };
        return acc;
      }, {} as Record<ComponentKey, ComponentConfig>)
  );

  const resetWizard = () => {
    setWizardActive(false);
  setComponentEditIndex(null);
    setAnalytics({ provider: "none", code: "" });
    setComponentsCfg(
      componentKeys.reduce((acc, key) => {
        acc[key] = { enabled: false, prompt: "", border: { enabled: false, prompt: "" }, order: undefined };
        return acc;
      }, {} as Record<ComponentKey, ComponentConfig>)
    );
    setSelectedPalette(curatedPalettes[0]);
  };

  const isPending = createProject.isPending;
  const isDisabled = isPending || !form.formState.isValid;

  const canAdvanceFromStep1 = form.formState.isValid;
  const canAdvanceFromStep2 =
    analytics.provider === "none" || (analytics.code && analytics.code.trim().length > 0);
  const step3HasInvalidBorders = componentKeys.some((k) => {
    const c = componentsCfg[k];
    return c.enabled && c.border?.enabled && !(c.border?.prompt && c.border.prompt.trim());
  });
  const canFinish = !step3HasInvalidBorders && form.formState.isValid && !isPending;

  const handleArrowAction = async () => {
    // If not customizing, behave as normal submit
    if (!isCustomizing) {
      // Normal submit
      await form.handleSubmit(onSubmit)();
      return;
    }

    // Start wizard on first submit click
    if (!wizardActive) {
      setWizardActive(true);
      return;
    }

    // Component prompts flow when wizard concluded to components prompts
    const enabledKeys = getOrderedComponentKeys(componentKeys, componentsCfg);
    const lastIndex = enabledKeys.length - 1;

    // If not yet in substep and there are components, start at first
    if (componentEditIndex === null) {
      if (enabledKeys.length > 0) {
        setComponentEditIndex(0);
        return;
      }
      // No components -> finish directly if allowed
      if (!canFinish) return;
      await form.handleSubmit(onSubmit)();
      return;
    }

    // In substep
    if (componentEditIndex < lastIndex) {
      setComponentEditIndex((i) => (i ?? 0) + 1);
      return;
    }

    // Last component -> finish
    if (!canFinish) return;
    await form.handleSubmit(onSubmit)();
  };

  return (
    <Form {...form}>
      <section className="space-y-6">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            "relative border p-4 pt-1 rounded-xl bg-sidebar dark:bg-sidebar transition-all",
            isFocused && "shadow-xs"
          )}
        >
          {/* Step 1: Basic info (existing prompt) stays inline only if not wizard */}
          {!wizardActive && (
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <div>
                  <TextareaAutosize
                    {...field}
                    placeholder="Descreva a landing page que você deseja criar."
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    minRows={2}
                    maxRows={8}
                    className="pt-4 resize-none border-none w-full outline-none bg-transparent"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.ctrlKey) {
                        e.preventDefault();
                        handleArrowAction();
                      }
                    }}
                    disabled={isPending}
                  />
                </div>
              )}
            />
          )}

          <div className="flex gap-x-2 items-end justify-between pt-2">
            <div className="flex gap-2">
              <Button
                variant={isCustomizing ? "default" : "outline"}
                className="h-6 px-2 text-xs border-2 border-green-700"
                type="button"
                onClick={() => {
                  const next = !isCustomizing;
                  setIsCustomizing(next);
                  if (!next) {
                    resetWizard();
                  }
                }}
              >
                <SettingsIcon className="size-3 mr-1" />
                Customizar
              </Button>
              <Button
                variant="outline"
                className="h-6 w-6 p-0 text-xs"
                type="button"
                onClick={improvePrompt}
                disabled={improveMutation.isPending}
                title={improveMutation.isPending ? "Melhorando prompt..." : "Melhorar prompt com IA"}
              >
                {improveMutation.isPending ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : (
                  <Zap className="size-3" />
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <PaletteButton
                selectedPalette={selectedPalette}
                onPaletteSelect={setSelectedPalette}
                className="mr-1"
              />
              <Button
                type="button"
                onClick={handleArrowAction}
                className={cn(
                  "size-8 rounded-full",
                  (wizardActive
                    ? componentEditIndex === null
                    : (isCustomizing ? !canAdvanceFromStep1 || isPending : isDisabled)) && "bg-muted-foreground border"
                )}
                disabled={
                  wizardActive
                    ? componentEditIndex === null // while the main wizard is open, use its own footer
                    : (isCustomizing ? !canAdvanceFromStep1 || isPending : isDisabled)
                }
              >
                {isPending ? <Loader2Icon className="animate-spin" /> : <ArrowUpIcon />}
              </Button>
            </div>
          </div>
        </form>

        <div className="flex-wrap justify-center gap-2 hidden md:flex max-w-3xl">
          {PROJECT_TEMPLATES.map((template) => (
            <Button
              key={template.title}
              variant="outline"
              size="sm"
              className="bg-white dark:bg-sidebar"
              onClick={() => onSelectTemplate(template.prompt)}
            >
              {template.emoji}&nbsp;&nbsp;
              {template.title}
            </Button>
          ))}
        </div>
      </section>

      {/* New Project Wizard */}
      <ProjectWizard
        open={wizardActive && componentEditIndex === null}
        onClose={resetWizard}
        selectedPalette={selectedPalette}
        setSelectedPalette={setSelectedPalette}
        analytics={analytics}
        setAnalytics={setAnalytics}
        componentKeys={componentKeys}
        componentsCfg={componentsCfg}
        setComponentsCfg={setComponentsCfg}
        isPending={isPending}
        canFinish={canFinish}
        onFinish={async () => {
          // If there are enabled components, open prompts subflow
          const enabledKeys = getOrderedComponentKeys(componentKeys, componentsCfg);
          if (enabledKeys.length > 0) {
            setComponentEditIndex(0);
            return;
          }
          // Otherwise submit
          await form.handleSubmit(onSubmit)();
        }}
      />
      {/* Prompts subflow modal (reusing arrow behavior) */}
      {componentEditIndex !== null && (
        <WizardModal
          open={true}
          steps={["Componentes", "Prompts"]}
          stepIndex={1}
          onClose={() => setComponentEditIndex(null)}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setComponentEditIndex((i) => {
                    if (i && i > 0) return i - 1;
                    return null;
                  });
                }}
              >
                Voltar
              </Button>
              <Button type="button" onClick={handleArrowAction} disabled={!canFinish}>
                Próximo
              </Button>
            </>
          }
        >
          <ComponentPromptsStep
            isPending={isPending}
            orderedKeys={getOrderedComponentKeys(componentKeys, componentsCfg)}
            index={componentEditIndex}
            componentsCfg={componentsCfg}
            setComponentsCfg={setComponentsCfg}
          />
        </WizardModal>
      )}
    </Form>
  );
};

export { ProjectForm };
