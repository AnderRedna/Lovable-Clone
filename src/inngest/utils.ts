import { SANDBOX_TIMEOUT_IN_MS } from "@/constants";
import { Sandbox } from "@e2b/code-interpreter";
import { AgentResult, type Message, TextMessage } from "@inngest/agent-kit";

export type AzureCompatOptions = {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
  defaultParameters?: Record<string, any>;
};

export async function getSandbox(sandboxId: string) {
  const sandbox = await Sandbox.connect(sandboxId);
  await sandbox.setTimeout(SANDBOX_TIMEOUT_IN_MS); // half hour

  return sandbox;
}

export function azureOpenAICompat(opts: AzureCompatOptions) {
  const base = opts.endpoint.replace(/\/+$/, "");
  const url = `${base}/openai/deployments/${opts.deployment}/chat/completions?api-version=${opts.apiVersion}`;
  return {
    format: "openai-chat",
    options: {
      model: opts.deployment,
      defaultParameters: opts.defaultParameters ?? {},
    },
    url,
    headers: {
      "api-key": opts.apiKey,
    },
    authKey: opts.apiKey,
    onCall: (_model: any, body: any) => {
      if (body && typeof body === "object" && "model" in body) {
        delete (body as any).model;
      }
    },
  } as any;
}

export function lastAssistantTextMessageContent(result: AgentResult) {
  const lastAssistantTextMessageIndex = result.output.findLastIndex(
    (message) => message.role === "assistant"
  );

  const message = result.output[lastAssistantTextMessageIndex] as
    | TextMessage
    | undefined;

  if (!message?.content) {
    return undefined;
  }

  return typeof message.content === "string"
    ? message.content
    : message.content.map((c) => c.text).join("");
}

export function parseAgentOutput(value: Message[]) {
  const output = value[0];

  if (output.type !== "text") {
    return "Fragment";
  }

  if (Array.isArray(output.content)) {
    return output.content.map((txt) => txt).join("");
  } else {
    return output.content;
  }
}

export function logAssistantTexts(label: string, messages: any) {
  try {
    const arr = Array.isArray(messages) ? messages : [];
    const texts = arr
      .filter((m) => m?.role === "assistant")
      .map((m) => (typeof m?.content === "string" ? m.content : (m?.content || []).map((c: any) => c?.text).join("")))
      .slice(-3);
    if (texts.length) console.log(`[${label}]`, ...texts);
  } catch {}
}

/**
 * Normaliza caminhos de arquivos para o sandbox de forma segura
 * Versão simplificada que corrige os problemas da implementação anterior
 */
export function normalizeSandboxPath(p: string, hasSrc: boolean = false): string | null {
  // Retorna null para inputs inválidos (evita gerar '.tsx' para strings vazias)
  if (!p || !p.trim()) {
    return null;
  }
  
  let path = p.trim().replace(/\\/g, '/');
  
  // Remove barras iniciais (caminhos absolutos)
  path = path.replace(/^\/+/, '');
  
  // Resolve alias @/ para src/ ou raiz
  if (path.startsWith('@/')) {
    path = path.replace(/^@\//, hasSrc ? 'src/' : '');
  }
  
  // Adiciona extensão .tsx apenas se não tiver extensão
  if (!/\.(tsx|ts|jsx|js)$/i.test(path)) {
    path = path + '.tsx';
  }
  
  return path;
}
