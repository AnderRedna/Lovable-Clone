import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { Usage } from "./usage";

interface MessageFormProps {
  projectId: string;
  isEditing?: boolean;
  onToggleEditing?: () => void;
  getEdits?: () => Array<{ selector: string; oldText: string; newText: string }>;
}

const formSchema = z.object({
  value: z.string().min(1, { message: "Value is required" }),
});

const MessageForm = ({ projectId, isEditing, onToggleEditing, getEdits }: MessageFormProps) => {
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
    await createMessage.mutateAsync({ value: values.value, projectId });
  };

  const saveInlineEdits = async () => {
    try {
      // Ask preview iframe to flush edits, then wait a tick
      try {
        const iframe: HTMLIFrameElement | null = document.querySelector('iframe[data-preview-iframe]');
        iframe?.contentWindow?.postMessage({ type: "collect-edits" }, "*");
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
      const edits = getEdits?.() || [];
      if (edits.length === 0) return;
      const value = [
        "Aplique as seguintes substituições de texto nos arquivos do projeto (apenas literais de texto em TSX/JSX/HTML/MD/JSON). Não altere lógica ou estrutura de componentes.",
        ...edits.map(
          (e, i) => `${i + 1}) \"${e.oldText}\" -> \"${e.newText}\" (selector: ${e.selector})`
        ),
      ].join("\n");
      await createMessage.mutateAsync({ value, projectId });
      onToggleEditing?.();
    } catch (e) {
      // ignore
    }
  };

  const [isFocused, setIsFocused] = useState(false);
  const showUsage = !!usage;
  const isPending = createMessage.isPending;
  const isDisabled = isPending || !form.formState.isValid;

  return (
    <Form {...form}>
      {/* {showUsage && (
        <Usage
          points={usage.remainingPoints}
          msBeforeNext={usage.msBeforeNext}
        />
      )} */}
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
          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              title="Editar textos"
              onClick={() => onToggleEditing?.()}
              className="bg-white border-2 border-white text-white hover:bg-white/10"
            >
              <span style={{ fontWeight: 700 }}>T</span>
            </Button>
          )}
          {isEditing && (
            <>
              <Button
                type="button"
                variant="default"
                size="sm"
                title="Cancelar edição"
                onClick={() => onToggleEditing?.()}
                className="h-8 border-0 bg-red-600 hover:bg-red-700"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                title="Salvar alterações"
                onClick={saveInlineEdits}
                className="h-8 border-0"
              >
                Salvar
              </Button>
            </>
          )}
          <Button
            className={cn(
              "size-8 rounded-full",
              isDisabled && "bg-muted-foreground border"
            )}
            disabled={isDisabled}
          >
            {isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <ArrowUpIcon />
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export { MessageForm };
