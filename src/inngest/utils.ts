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

/**
 * Verifica se uma escrita de página seria destrutiva
 */
export function shouldBlockDestructivePageWrite(prev: string, next: string): boolean {
  if (!prev) return false;
  const ratio = next.length / Math.max(prev.length, 1);
  const importNames = Array.from(prev.matchAll(/import\s+([\s\S]*?)from\s+['"][^'"]+['"]/g))
    .flatMap((m) => {
      const spec = (m[1] || "").trim();
      const names: string[] = [];
      const named = spec.match(/\{([^}]+)\}/);
      if (named) {
        for (const n of named[1].split(",")) names.push(n.trim().split(/\s+as\s+/)[0]);
      }
      const def = spec.replace(named?.[0] || "", "").trim().replace(/^,/, "").trim();
      if (def) names.push(def);
      return names.filter(Boolean);
    })
    .filter(Boolean);
  const usedNames = new Set(importNames.filter((n) => new RegExp(`<${n}\\b`).test(prev)));
  const stillUsed = Array.from(usedNames).filter((n) => new RegExp(`<${n}\\b`).test(next));
  if (ratio < 0.6 && usedNames.size >= 2 && stillUsed.length <= 0) return true;
  return false;
}

/**
 * Normaliza o conteúdo de arquivos da pasta app/
 */
export function normalizeAppFileContent(filePath: string, content: string): string {
  if (!/^app\//i.test(filePath) || typeof content !== 'string') return content;
  let out = content;

  // 0) Auto-detect and add "use client" for components with React hooks or browser APIs
  const needsUseClient = (
    // React hooks
    /\b(useState|useEffect|useRef|useCallback|useMemo|useReducer|useContext|useLayoutEffect|useImperativeHandle|useDebugValue|useDeferredValue|useId|useInsertionEffect|useSyncExternalStore|useTransition)\b/.test(out) ||
    // Browser APIs
    /\b(window|document|localStorage|sessionStorage|navigator|location|history|addEventListener|removeEventListener)\b/.test(out) ||
    // Event handlers
    /\b(onClick|onChange|onSubmit|onFocus|onBlur|onKeyDown|onKeyUp|onMouseEnter|onMouseLeave)\s*=/.test(out) ||
    // Form elements that typically need interactivity
    (/\b(form|input|button|textarea|select)\b/i.test(out) && /\b(value|checked|disabled)\s*=/.test(out))
  );

  if (needsUseClient && !/^\s*["']use client["']/m.test(out)) {
    // Add "use client" as the very first line
    out = `"use client";\n${out}`;
  }

  // 1) Fix relative kebab-case imports to PascalCase
  out = out.replace(/from\s+(["'])\.\/(?!\.)([a-z0-9\-]+)(?:\.(?:tsx|ts|jsx|js))?\1/g, (m, quote, slug) => {
    const pascal = slug.replace(/\.(tsx|ts|jsx|js)$/i, "").split(/[^A-Za-z0-9]+/).filter(Boolean).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
    return m.replace(new RegExp(`\.\/${slug}`), `./${pascal}`);
  });

  // 2) Force Shadcn primitives to import from @/components/ui/<kebab>
  const primitiveMap: Record<string, string> = {
    Button: 'button',
    Input: 'input',
    Card: 'card',
    Badge: 'badge',
    Tabs: 'tabs',
    Sheet: 'sheet',
    Dialog: 'dialog',
    Tooltip: 'tooltip',
    Separator: 'separator',
  };
  out = out.replace(/import\s+([^;]+?)\s+from\s+(["'])([^"']+)\2\s*;?/g, (full, spec, q, src) => {
    // Already correct
    if (/^@\/components\/ui\//.test(src)) return full;
    // Only adjust if it's a relative import or bare and matches a known primitive name
    const names: string[] = [];
    const named = spec.match(/\{([^}]+)\}/);
    if (named) {
      for (const n of named[1].split(',')) {
        const local = n.trim().split(/\s+as\s+/).pop() || '';
        if (local) names.push(local);
      }
    }
    const def = spec.replace(named?.[0] || '', '').trim().replace(/^,/, '').trim();
    if (def) names.push(def);

    const found = names.find((n) => primitiveMap[n]);
    if (!found) return full;
    const kebab = primitiveMap[found] || found.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/\s+/g, '-').toLowerCase();
    return `import ${spec} from ${q}@/components/ui/${kebab}${q};`;
  });

  return out;
}

/**
 * Força atualização de metadados title/description e html lang no layout
 */
export function upsertMetadataInLayout(src: string, title: string, description: string): string {
  let next = String(src || "");

  // Ensure import of Metadata type
  if (!/\bMetadata\b/.test(next) || !/from\s+['"]next['"]/m.test(next)) {
    const lines = next.split("\n");
    let insertIdx = 0;
    if (/^\s*['"]use client['"];?\s*$/.test(lines[0] || "")) insertIdx = 1;
    // Avoid duplicate import
    const alreadyHas = lines.some((l) => /import\s+type\s+\{?\s*Metadata\s*\}?\s+from\s+['"]next['"]/i.test(l));
    if (!alreadyHas) {
      lines.splice(insertIdx, 0, `import type { Metadata } from "next";`);
      next = lines.join("\n");
    }
  }

  // Force html lang to pt-BR (replace any existing lang attr or add if missing)
  if (/<html\b[^>]*\blang\s*=/.test(next)) {
    next = next.replace(/<html\b([^>]*?)\blang\s*=\s*['"][^'\"]*['"]([^>]*)>/i, `<html$1 lang="pt-BR"$2>`);
  } else if (/<html\b/i.test(next)) {
    next = next.replace(/<html(\b[^>]*)>/i, `<html lang="pt-BR"$1>`);
  }

  // Replace existing metadata object or insert a new one before RootLayout
  const metaRe = /export\s+const\s+metadata\s*(?::\s*Metadata\s*)?=\s*\{([\s\S]*?)\}\s*;?/m;
  if (metaRe.test(next)) {
    next = next.replace(metaRe, (_full, body) => {
      let b = String(body);
      // title
      if (/\btitle\s*:/.test(b)) {
        b = b.replace(/\btitle\s*:\s*([^,}]+)(?=([^}]*))(,?)/, `title: ${JSON.stringify(title)}$3`);
      } else {
        b = `  title: ${JSON.stringify(title)},\n` + b.replace(/^\s+/, "");
      }
      // description
      if (/\bdescription\s*:/.test(b)) {
        b = b.replace(/\bdescription\s*:\s*([^,}]+)(?=([^}]*))(,?)/, `description: ${JSON.stringify(description)}$3`);
      } else {
        // insert after title if present
        if (/\btitle\s*:/.test(b)) {
          b = b.replace(/(\btitle\s*:\s*[^,}]+,?)/, `$1\n  description: ${JSON.stringify(description)},`);
        } else {
          b = `  description: ${JSON.stringify(description)},\n` + b.replace(/^\s+/, "");
        }
      }
      return `export const metadata: Metadata = {\n${b.trim()}\n};`;
    });
  } else {
    next = next.replace(
      /export\s+default\s+function\s+RootLayout\b/,
      `export const metadata: Metadata = {\n  title: ${JSON.stringify(title)},\n  description: ${JSON.stringify(description)}\n};\n\nexport default function RootLayout`
    );
    // If replace failed (no RootLayout found), append metadata at top
    if (!/export\s+const\s+metadata\b/.test(next)) {
      next = `export const metadata: Metadata = {\n  title: ${JSON.stringify(title)},\n  description: ${JSON.stringify(description)}\n};\n\n` + next;
    }
  }

  return next;
}
