"use client";

import { useClerk } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpIcon, Loader2Icon, SettingsIcon, ChevronLeft } from "lucide-react";
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
import Link from "next/link";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  value: z
    .string()
    .min(1, { message: "Value is required" })
    .max(10_000, { message: "Value is too long" }),
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

        toast.error(error.message);
      },
    })
  );

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await createProject.mutateAsync({
      value: values.value,
    });
  };

  const onSelectTemplate = (content: string) => {
    form.setValue("value", content, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const [isFocused, setIsFocused] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [wizardActive, setWizardActive] = useState(false);

  type AnalyticsProvider = "none" | "google-analytics" | "clarity" | "other";
  type ComponentKey =
    | "Background"
    | "Announcement"
    | "CallToAction"
    | "Clients"
    | "Features"
    | "Footers"
    | "Heroes"
    | "Images"
    | "Header"
    | "Pricing"
    | "Testimonials"
    | "Video";

  type ComponentConfig = {
    enabled: boolean;
    prompt?: string;
    border?: {
      enabled: boolean;
      prompt?: string;
    };
  };

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
        acc[key] = { enabled: false, prompt: "", border: { enabled: false, prompt: "" } };
        return acc;
      }, {} as Record<ComponentKey, ComponentConfig>)
  );

  const resetWizard = () => {
    setStep(1);
  setWizardActive(false);
    setAnalytics({ provider: "none", code: "" });
    setComponentsCfg(
      componentKeys.reduce((acc, key) => {
        acc[key] = { enabled: false, prompt: "", border: { enabled: false, prompt: "" } };
        return acc;
      }, {} as Record<ComponentKey, ComponentConfig>)
    );
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
      if (!canAdvanceFromStep1) return; // need valid base info to proceed
      setWizardActive(true);
      setStep(2); // Step 1 is auto-complete; jump to Step 2
      return;
    }

    // Wizard flow when active
    if (step === 1) {
      if (!canAdvanceFromStep1) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!canAdvanceFromStep2) return;
      setStep(3);
      return;
    }
    // step 3 -> finish
    if (!canFinish) return;

    // NOTE: Backend currently accepts only { value }.
    // We proceed with current API and preserve selections for future use.
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
          {/* Step content */}
          {/* Step 1: Basic info (existing prompt) */}
          {(!wizardActive || step === 1) && (
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
                        // Ctrl+Enter behaves like submit button
                        handleArrowAction();
                      }
                    }}
                    disabled={isPending}
                  />
                  {wizardActive && (
                    <div className="mt-2 text-[10px] inline-flex items-center gap-1 px-2 py-0.5 border rounded bg-background">
                      Etapa 1 ficará marcada como concluída automaticamente
                    </div>
                  )}
                </div>
              )}
            />
          )}

          <div className="flex gap-x-2 items-end justify-between pt-2">
            <Button
              variant={isCustomizing ? "default" : "outline"}
              className="h-6 px-2 text-xs"
              type="button"
              onClick={() => {
                const next = !isCustomizing;
                setIsCustomizing(next);
                if (!next) {
                  // Leaving customize mode resets wizard for next time
                  resetWizard();
                }
              }}
            >
              <SettingsIcon className="size-3 mr-1" />
              Customizar
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleArrowAction}
                className={cn(
                  "size-8 rounded-full",
                  (wizardActive
                    ? (step === 1 && !canAdvanceFromStep1) || (step === 2 && !canAdvanceFromStep2) || (step === 3 && !canFinish)
                    : (isCustomizing ? !canAdvanceFromStep1 || isPending : isDisabled)) && "bg-muted-foreground border"
                )}
                disabled={
                  wizardActive
                    ? (step === 1 && !canAdvanceFromStep1) || (step === 2 && !canAdvanceFromStep2) || (step === 3 && !canFinish)
                    : (isCustomizing ? !canAdvanceFromStep1 || isPending : isDisabled)
                }
              >
                {isPending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <ArrowUpIcon />
                )}
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

      {/* Wizard Modal */}
      {wizardActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className={cn(
              "bg-background border rounded-xl shadow-2xl overflow-hidden transition-all duration-500 ease-out",
              "w-80 h-80 scale-50 opacity-0", // Initial small size and hidden
              wizardActive && "scale-100 opacity-100 w-[90vw] h-[90vh] max-w-4xl max-h-[80vh]" // Expanded to large square
            )}
          >
            <div className="flex h-full">
              {/* Left Sidebar: Stepper */}
              <div className="w-1/4 bg-muted/50 p-6 border-r flex flex-col justify-center">
                <div className="space-y-6">
                  {[1, 2, 3].map((s, index) => {
                    const isActive = step === s;
                    const isDone = step > s;
                    const labels = {
                      1: "Informações básicas",
                      2: "Monitoramento",
                      3: "Componentes",
                    } as const;
                    return (
                      <div key={s} className="flex items-center gap-3 relative">
                        <div
                          className={cn(
                            "size-10 grid place-items-center border-2 text-sm font-medium rounded-full transition-colors",
                            isActive && "bg-primary text-primary-foreground border-primary",
                            isDone && "bg-muted text-foreground border-muted",
                            !isActive && !isDone && "bg-background border-border"
                          )}
                        >
                          {isDone ? "✓" : s}
                        </div>
                        <span className={cn("text-sm", isActive && "font-semibold")}>
                          {labels[s as 1 | 2 | 3]}
                        </span>
                        {index < 2 && (
                          <div className="absolute left-5 top-10 w-0.5 h-6 bg-border"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                {/* Step 2: Analytics */}
                {step === 2 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Monitoramento</h2>
                    <div className="grid grid-cols-2 gap-4">
                      {([
                        { key: "google-analytics", label: "Google Analytics" },
                        { key: "clarity", label: "Clarity" },
                        { key: "other", label: "Outros" },
                        { key: "none", label: "Nenhum" },
                      ] as { key: AnalyticsProvider; label: string }[]).map((opt) => {
                        const selected = analytics.provider === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() =>
                              setAnalytics((a) => ({ ...a, provider: opt.key, code: opt.key === "none" ? "" : a.code }))
                            }
                            className={cn(
                              "border rounded-lg aspect-square p-4 text-left transition-colors",
                              "hover:border-primary",
                              selected && "border-primary bg-primary/5"
                            )}
                          >
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-xs text-muted-foreground mt-2">
                              {opt.key === "none" ? "Sem monitoramento" : "Adiciona código no <head>"}
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
                          minRows={3}
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
                )}

                {/* Step 3: Components selection and per-component prompts */}
                {step === 3 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Componentes</h2>
                    <div>
                      <div className="mb-4 text-sm font-medium">Selecione os componentes</div>
                      <div className="grid grid-cols-3 gap-4">
                        {componentKeys.map((key) => {
                          const selected = componentsCfg[key].enabled;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() =>
                                setComponentsCfg((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], enabled: !prev[key].enabled },
                                }))
                              }
                              className={cn(
                                "border rounded-lg aspect-square p-4 text-left text-sm transition-colors",
                                "hover:border-primary",
                                selected && "border-primary bg-primary/5"
                              )}
                            >
                              <div className="font-medium">{key}</div>
                              <div className="text-xs text-muted-foreground mt-2">Clique para {selected ? "remover" : "adicionar"}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Editor for selected components */}
                    <div className="space-y-4">
                      {componentKeys.filter((k) => componentsCfg[k].enabled).length === 0 && (
                        <div className="text-xs text-muted-foreground">Nenhum componente selecionado. Você pode prosseguir sem componentes.</div>
                      )}
                      {componentKeys
                        .filter((k) => componentsCfg[k].enabled)
                        .map((k) => {
                          const cfg = componentsCfg[k];
                          return (
                            <div key={k} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium">{k}</div>
                                <Link
                                  href="https://21st.dev/components"
                                  target="_blank"
                                  className="text-xs text-primary hover:underline"
                                >
                                  Ver prompts no 21st.dev
                                </Link>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`prompt-${k}`}>Prompt do componente (opcional)</Label>
                                <TextareaAutosize
                                  id={`prompt-${k}`}
                                  minRows={2}
                                  className="w-full resize-y rounded-md border bg-transparent p-2 text-sm"
                                  placeholder={`Descreva o conteúdo/estilo para ${k}`}
                                  value={cfg.prompt ?? ""}
                                  onChange={(e) =>
                                    setComponentsCfg((prev) => ({
                                      ...prev,
                                      [k]: { ...prev[k], prompt: e.target.value },
                                    }))
                                  }
                                  disabled={isPending}
                                />

                                <div className="flex items-center gap-2 mt-2">
                                  <input
                                    id={`border-${k}`}
                                    type="checkbox"
                                    className="size-4"
                                    checked={!!cfg.border?.enabled}
                                    onChange={(e) =>
                                      setComponentsCfg((prev) => ({
                                        ...prev,
                                        [k]: {
                                          ...prev[k],
                                          border: { ...(prev[k].border || { prompt: "" }), enabled: e.target.checked },
                                        },
                                      }))
                                    }
                                  />
                                  <Label htmlFor={`border-${k}`}>Definir borda</Label>
                                </div>

                                {cfg.border?.enabled && (
                                  <div className="space-y-2 mt-2">
                                    <Label htmlFor={`border-prompt-${k}`}>Prompt da borda</Label>
                                    <TextareaAutosize
                                      id={`border-prompt-${k}`}
                                      minRows={2}
                                      className={cn(
                                        "w-full resize-y rounded-md border bg-transparent p-2 text-sm",
                                        !cfg.border?.prompt && "border-destructive/50"
                                      )}
                                      placeholder={`Descreva a borda a aplicar em ${k}`}
                                      value={cfg.border?.prompt ?? ""}
                                      onChange={(e) =>
                                        setComponentsCfg((prev) => ({
                                          ...prev,
                                          [k]: {
                                            ...prev[k],
                                            border: { ...(prev[k].border || { enabled: true }), prompt: e.target.value },
                                          },
                                        }))
                                      }
                                      disabled={isPending}
                                    />
                                    {!cfg.border?.prompt && (
                                      <div className="text-[10px] text-destructive">Informe o prompt da borda para concluir.</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex justify-between items-center mt-6 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (step > 1) {
                        setStep((s) => (s - 1) as 1 | 2 | 3);
                      } else {
                        resetWizard();
                      }
                    }}
                  >
                    {step === 1 ? "Cancelar" : "Voltar"}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleArrowAction}
                    disabled={
                      (step === 2 && !canAdvanceFromStep2) || (step === 3 && !canFinish)
                    }
                  >
                    {step === 3 ? "Concluir" : "Avançar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Form>
  );
};

export { ProjectForm };
