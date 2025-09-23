import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpIcon, Loader2Icon, PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { Usage } from "./usage";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MessageFormProps {
  projectId: string;
  isEditing?: boolean;
  onToggleEditing?: () => void;
  getEdits?: () => Array<{ selector: string; oldText: string; newText: string; type?: string; url?: string }>;
  // Sinaliza que há uma solicitação em processamento; permite digitar, mas bloqueia envio
  isProcessing?: boolean;
  // Notifica o container quando o envio começar/terminar (para mostrar loader otimista)
  onSubmittingChange?: (submitting: boolean) => void;
}

const formSchema = z.object({
  value: z.string().min(1, { message: "Value is required" }),
});

const MessageForm = ({ projectId, isEditing, onToggleEditing, getEdits, isProcessing = false, onSubmittingChange }: MessageFormProps) => {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: usage } = useQuery(trpc.usage.status.queryOptions());

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: "",
    },
  });

  const createMessage = useMutation(
    trpc.messages.create.mutationOptions({
      onSuccess: (data) => {
        form.reset();
        queryClient.invalidateQueries(
          trpc.messages.getMany.queryOptions({ projectId: data.projectId })
        );
        queryClient.invalidateQueries(trpc.usage.status.queryOptions());
      },
      onError: (error) => {
        if (error.data?.code === "TOO_MANY_REQUESTS") {
          router.push("/pricing");
        }

        toast.error(error.message);
      },
    })
  );

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isProcessing) {
      toast.info("Aguarde finalizar a última solicitação.");
      return;
    }
    try {
      onSubmittingChange?.(true);
      await createMessage.mutateAsync({ value: values.value, projectId });
      // Não limpar aqui: container limpará quando steps/final chegarem
    } catch (e) {
      onSubmittingChange?.(false);
      throw e;
    }
  };

  const saveInlineEdits = async () => {
    try {
      if (isProcessing) {
        toast.info("Aguarde finalizar a última solicitação.");
        return;
      }
      // Vamos apenas sinalizar submissão se houver algo para enviar
      // Ask preview iframe to flush edits, then wait a tick
      try {
        const iframe: HTMLIFrameElement | null = document.querySelector('iframe[data-preview-iframe]');
        iframe?.contentWindow?.postMessage({ type: "collect-edits" }, "*");
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
      const edits = getEdits?.() || [];
      console.log('DEBUG: Edições coletadas:', edits);
      if (edits.length === 0) {
        console.log('DEBUG: Nenhuma edição encontrada, saindo...');
        return;
      }
      onSubmittingChange?.(true);
      
      // Separate text edits from hyperlinks
      const textEdits = edits.filter(e => e.type !== 'hyperlink');
      const hyperlinkEdits = edits.filter(e => e.type === 'hyperlink');
      
      console.log('DEBUG: Edições de texto:', textEdits);
      console.log('DEBUG: Edições de hyperlink:', hyperlinkEdits);
      
      let instructions = [];
      
      if (textEdits.length > 0) {
        instructions.push(
          "Aplique as seguintes substituições de texto nos arquivos do projeto (apenas literais de texto em TSX/JSX/HTML/MD/JSON). Não altere lógica ou estrutura de componentes.",
          ...textEdits.map(
            (e, i) => `${i + 1}) \"${e.oldText}\" -> \"${e.newText}\" (selector: ${e.selector})`
          )
        );
      }
      
      if (hyperlinkEdits.length > 0) {
        if (instructions.length > 0) instructions.push("");
        instructions.push(
          "Aplique os seguintes hyperlinks nos arquivos do projeto:",
          ...hyperlinkEdits.map(
            (e, i) => `${i + 1}) Transformar \"${e.oldText}\" em link para \"${e.url}\" (selector: ${e.selector})`
          )
        );
      }
      
      const value = instructions.join("\n");
      
      console.log('DEBUG: Instruções finais:', value);
      console.log('DEBUG: Enviando mensagem...');
      
      try {
        await createMessage.mutateAsync({ value, projectId });
        console.log('DEBUG: Mensagem enviada com sucesso!');
      } catch (e) {
        console.log('DEBUG: Erro ao enviar mensagem:', e);
        onSubmittingChange?.(false);
        throw e;
      }
      onToggleEditing?.();
    } catch (e) {
      // ignore
    }
  };

  const handleToggleEditing = () => {
    if (isEditing && hasUnsavedChanges) {
      // Se está editando e tem mudanças não salvas, mostrar aviso
      const id = toast("Você tem alterações não salvas. Deseja sair sem salvar?", {
        duration: Infinity,
        position: "bottom-center",
        action: {
          label: "Sair sem salvar",
          onClick: () => {
            onToggleEditing?.();
            toast.dismiss(id);
          }
        },
        cancel: {
          label: "Cancelar",
          onClick: () => {
            toast.dismiss(id);
          }
        }
      });
    } else {
      // Chamar a função de toggle que já inclui a animação
      onToggleEditing?.();
    }
  };

  const [isFocused, setIsFocused] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastId, setToastId] = useState<string | number | null>(null);
  
  const showUsage = !!usage;
  const isPending = createMessage.isPending;
  const isDisabled = isPending || isProcessing || !form.formState.isValid;

  // Detectar mudanças quando em modo de edição
  useEffect(() => {
    if (!isEditing) {
      setHasUnsavedChanges(false);
      if (toastId) {
        toast.dismiss(toastId);
        setToastId(null);
      }
      return;
    }

    const checkForChanges = () => {
      const edits = getEdits?.() || [];
      const hasChanges = edits.length > 0;
      
      if (hasChanges && !hasUnsavedChanges) {
        setHasUnsavedChanges(true);
        const id = toast("Você tem alterações não salvas, deseja salvar?", {
          duration: Infinity,
          position: "bottom-center",
          action: {
            label: "Salvar",
            onClick: () => {
              saveInlineEdits();
              toast.dismiss(id);
              setToastId(null);
            }
          },
          onDismiss: () => {
            setToastId(null);
          }
        });
        setToastId(id);
      } else if (!hasChanges && hasUnsavedChanges) {
        setHasUnsavedChanges(false);
        if (toastId) {
          toast.dismiss(toastId);
          setToastId(null);
        }
      }
    };

    // Verificar mudanças a cada 500ms quando em modo de edição
    const interval = setInterval(checkForChanges, 500);
    return () => clearInterval(interval);
  }, [isEditing, hasUnsavedChanges, toastId, getEdits, saveInlineEdits]);

  return (
    <Form {...form}>
      {showUsage && (
        <Usage
          points={usage.remainingPoints}
          msBeforeNext={usage.msBeforeNext}
        />
      )}
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn(
          "relative border p-4 pt-1 rounded-xl bg-sidebar dark:bg-sidebar transition-all",
          isFocused && "shadow-xs",
          showUsage && "rounded-t-none"
        )}
      >

        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <TextareaAutosize
              {...field}
              placeholder="O que você gostaria de editar?"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              minRows={2}
              maxRows={8}
              className="pt-4 resize-none border-none w-full outline-none bg-transparent"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  form.handleSubmit(onSubmit)(e);
                }
              }}
              disabled={isPending}
            />
          )}
        />

  <div className="flex gap-x-2 items-end justify-end pt-2">
          <Button
            type="button"
            variant={isEditing ? "default" : "outline"}
            size="sm"
            title={isEditing ? "Modo de edição ativo" : "Editar"}
            onClick={handleToggleEditing}
            className={cn(
              "border-2 transition-colors",
              isEditing 
                ? "!bg-green-600 !border-green-600 !text-white hover:!bg-green-700 hover:!border-green-700" 
                : "bg-black border-black text-white hover:bg-gray-800 hover:border-gray-800"
            )}
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex" aria-disabled={isDisabled}>
                <Button
                className={cn(
                  "size-8 rounded-full",
                  isDisabled && "bg-muted-foreground border"
                )}
                disabled={isDisabled}
                onClick={(e) => {
                  if (isProcessing) {
                    e.preventDefault();
                    toast.info("Aguarde finalizar a última solicitação.");
                  }
                }}
                >
                  {isPending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <ArrowUpIcon />
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            {isProcessing && (
              <TooltipContent sideOffset={6}>
                Aguarde finalizar a última solicitação
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </form>
    </Form>
  );
};

export { MessageForm };
