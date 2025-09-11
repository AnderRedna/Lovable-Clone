import { Sandbox } from "@e2b/code-interpreter";
import {
  createAgent,
  createNetwork,
  createState,
  createTool,
  type Message,
  type Tool,
} from "@inngest/agent-kit";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";
import { FileCollection } from "@/types";
import { inngest } from "./client";
import {
  getSandbox,
  lastAssistantTextMessageContent,
  parseAgentOutput,
} from "./utils";
import { SANDBOX_TIMEOUT_IN_MS } from "@/constants";

interface AgentState {
  summary: string;
  files: FileCollection;
}

// Guard: detect default Next.js starter template markers to avoid accidental overwrite
const DEFAULT_NEXT_TEMPLATE_RE =
  /(Next\.js logo|\/vercel\.svg|\/next\.svg|Read our docs|Go to nextjs\.org)/i;

// Loga todo texto do assistente em um conjunto de mensagens
function logAssistantTexts(tag: string, messages: Message[]) {
  for (const m of messages) {
    if (m.type === "text" && (m as any).role === "assistant") {
      console.log(`[${tag}] assistant:`, (m as any).content);
    }
  }
}

// Minimal Azure OpenAI adapter compatible with the OpenAI-chat format used by Agent Kit.
// Avoids requiring the azureOpenai() helper which isn't available in your current @inngest/ai version.
const azureOpenAICompat = (opts: {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
  defaultParameters?: Record<string, unknown>;
}) => {
  const endpoint = opts.endpoint.replace(/\/$/, "");
  const url = `${endpoint}/openai/deployments/${opts.deployment}/chat/completions?api-version=${opts.apiVersion}`;
  return {
    // Tell Agent Kit to treat this like OpenAI Chat (so it uses the OpenAI parsers)
    format: "openai-chat",
    // Options shape is not strictly used at runtime by Agent Kit, keep minimal for TS
    options: {
      model: opts.deployment,
      defaultParameters: opts.defaultParameters ?? {},
    },
    // Azure-specific endpoint and headers
    url,
    headers: {
      "api-key": opts.apiKey,
    },
    authKey: opts.apiKey,
    // Drop `model` from the payload (Azure infers from deployment in path)
    onCall: (_model: any, body: any) => {
      if (body && typeof body === "object" && "model" in body) {
        delete body.model;
      }
    },
  } as any;
};

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    console.log("Starting code-agent function", JSON.stringify(event.data));
    const sandboxId = await step.run("get-sandbox-id", async () => {
      console.log("Running get-sandbox-id");
      const template =
        process.env.E2B_TEMPLATE_ID ||
        process.env.E2B_TEMPLATE_NAME ||
        "lovable-clone-nextjs-sg-0206"; // fallback to demo template
      console.log("Creating E2B sandbox using template:", template);
      try {
        const sandbox = await Sandbox.create(template);
        await sandbox.setTimeout(SANDBOX_TIMEOUT_IN_MS);
        console.log("Completed get-sandbox-id", sandbox.sandboxId);
        return sandbox.sandboxId;
      } catch (err: any) {
        console.error(
          "Failed to create E2B sandbox. Check E2B_API_KEY access and template ownership.",
          {
            message: err?.message,
          }
        );
        throw err;
      }
    });

    const previousMessages = await step.run(
      "get-previous-messages",
      async () => {
        console.log("Running get-previous-messages");
        const formattedMessages: Message[] = [];

        const messages = await prisma.message.findMany({
          where: {
            projectId: event.data.projectId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        });

        for (const message of messages) {
          formattedMessages.push({
            type: "text",
            role: message.role === "ASSISTANT" ? "assistant" : "user",
            content: message.content,
          });
        }
        console.log("Completed get-previous-messages", formattedMessages.length, "messages");
        return formattedMessages.reverse();
      }
    );

    const state = createState<AgentState>(
      {
        summary: "",
        files: {},
      },
      {
        messages: previousMessages,
      }
    );

    // Create a new agent with a system prompt (you can add optional tools, too)
    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: azureOpenAICompat({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
        apiKey: process.env.AZURE_OPENAI_API_KEY!,
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT!,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
        defaultParameters: {
          temperature: 0.1,
        },
      }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step }) => {
            console.log("Running terminal tool", command);
            return await step?.run("terminal", async () => {
              const buffers = {
                stdout: "",
                stderr: "",
              };

              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  },
                });
                console.log("Completed terminal tool", result.exitCode);
                return result.stdout;
              } catch (error) {
                console.error(
                  `command failed: ${error}\nstdOut: ${buffers.stdout}\nstdError: ${buffers.stderr}`
                );
                return `command failed: ${error}\nstdOut: ${buffers.stdout}\nstdError: ${buffers.stderr}`;
              }
            });
          },
        }),
        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              })
            ),
          }),
          handler: async (
            { files },
            { step, network }: Tool.Options<AgentState>
          ) => {
            console.log("Running createOrUpdateFiles tool", files.length, "files");
            const newFiles = await step?.run(
              "createOrUpdateFiles",
              async () => {
                try {
                  const updatedFiles = network.state.data.files || {};
                  const sandbox = await getSandbox(sandboxId);

                  for (const file of files) {
                    // Template Guard: don't overwrite main page with Next.js starter content
                    if (
                      /app\/page\.(tsx|jsx|ts|js)$/i.test(file.path) &&
                      DEFAULT_NEXT_TEMPLATE_RE.test(file.content)
                    ) {
                      console.warn(
                        "Template guard: skipping overwrite of app/page.* with Next.js starter content"
                      );
                      continue;
                    }

                    await sandbox.files.write(file.path, file.content);
                    updatedFiles[file.path] = file.content;
                  }
                  console.log("Completed createOrUpdateFiles tool");
                  return updatedFiles;
                } catch (error) {
                  console.log("Error in createOrUpdateFiles", error);
                  return "Error: " + error;
                }
              }
            );

            if (typeof newFiles === "object") {
              network.state.data.files = newFiles;
            }
          },
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }, { step }) => {
            console.log("Running readFiles tool", files.length, "files");
            return await step?.run("readFiles", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const contents = [];

                for (const file of files) {
                  const content = await sandbox.files.read(file);
                  contents.push({ path: file, content });
                }
                console.log("Completed readFiles tool", contents.length, "files read");
                return JSON.stringify(contents);
              } catch (error) {
                console.log("Error in readFiles", error);
                return "Error: " + error;
              }
            });
          },
        }),
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          // Loga os outputs do modelo a cada iteração
          logAssistantTexts("code-agent", result.output);
          console.log("Running onResponse lifecycle");
          const lastAssistantTextMessageText =
            lastAssistantTextMessageContent(result);

          if (lastAssistantTextMessageText && network) {
            if (lastAssistantTextMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantTextMessageText;
            }
          }
          console.log("Completed onResponse lifecycle");
          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: async ({ network }) => {
        console.log("Running router");
        const summary = network.state.data.summary;

        if (summary) {
          console.log("Router: summary exists, ending");
          return;
        }
        console.log("Router: no summary, routing to codeAgent");
        return codeAgent;
      },
    });

    // Compose an enriched instruction including customization
    const customization = (event.data as any).customization as
      | {
          analytics?: { provider: string; code?: string };
          components?: Record<string, { enabled: boolean; prompt?: string; border?: { enabled: boolean; prompt?: string } }>;
        }
      | undefined;

    const selectedComponents = Object.entries(customization?.components || {})
      .filter(([, cfg]) => cfg.enabled)
      .map(([key, cfg]) => ({ key, prompt: cfg.prompt, borderPrompt: cfg.border?.prompt }));

    const enrichedInstruction = [
      event.data.value,
      selectedComponents.length
        ? `\n\nComponents to include (in order if applicable):\n${selectedComponents
            .map(
              (c, i) => ` ${i + 1}. ${c.key}${c.prompt ? `\n    prompt: ${c.prompt}` : ""}${c.borderPrompt ? `\n    border: ${c.borderPrompt}` : ""}`
            )
            .join("\n")}`
        : "",
      customization?.analytics && customization.analytics.provider !== "none"
        ? `\n\nAnalytics: ${customization.analytics.provider}${customization.analytics.code ? ` (${customization.analytics.code.slice(0, 40)}...)` : ""}`
        : "",
    ]
      .filter(Boolean)
      .join("");

    const result = await network.run(enrichedInstruction, { state });
    console.log("Completed network.run", result.state.data.summary ? "success" : "error");

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: azureOpenAICompat({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
        apiKey: process.env.AZURE_OPENAI_API_KEY!,
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT!,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
        defaultParameters: {
          temperature: 0.1,
        },
      }),
    });

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: azureOpenAICompat({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
        apiKey: process.env.AZURE_OPENAI_API_KEY!,
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT!,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
        defaultParameters: {
          temperature: 0.1,
        },
      }),
    });

  const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
      result.state.data.summary
    );
  logAssistantTexts("fragment-title-generator", fragmentTitleOutput);
    console.log("Completed fragmentTitleGenerator.run");

  const { output: responseOutput } = await responseGenerator.run(
      result.state.data.summary
    );
  logAssistantTexts("response-generator", responseOutput);
    console.log("Completed responseGenerator.run");

    const isError =
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;

    // Best-effort analytics injection (Next.js App Router friendly)
    if (!isError && customization?.analytics && customization?.analytics?.provider !== "none") {
      await step.run("inject-analytics", async () => {
        try {
          const raw = (customization?.analytics?.code || "").trim();
          if (!raw) return;
          // Strip <script> wrapper if present
          const m = raw.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
          const code = (m ? m[1] : raw).trim();

          const files = result.state.data.files || {};
          const candidates = Object.keys(files);
          const layoutPath = candidates.find((p) => /app\/layout\.(tsx|jsx|ts|js)$/i.test(p));
          const sandbox = await getSandbox(sandboxId);

          if (layoutPath) {
            // 1) Write app/analytics.tsx component
            const analyticsPath = "app/analytics.tsx";
            const analyticsContent = `"use client";\nimport Script from 'next/script';\nexport default function AppAnalytics() {\n  return (\n    <>\n      <Script id=\"custom-analytics\" strategy=\"afterInteractive\" dangerouslySetInnerHTML={{ __html: \`${code.replace(/`/g, "\\`")}\` }} />\n    </>\n  );\n}\n`;
            await sandbox.files.write(analyticsPath, analyticsContent);
            result.state.data.files[analyticsPath] = analyticsContent;

            // 2) Inject import and <AppAnalytics /> into layout
            const layoutRaw = files[layoutPath] as string;
            const hasImport = /from\s+['"]@\/app\/analytics['"]/m.test(layoutRaw) || /from\s+['"]\.\/analytics['"]/m.test(layoutRaw);
            let nextLayout = layoutRaw;
            if (!hasImport) {
              // Insert import after first import or at top
              if (/^import\s/m.test(nextLayout)) {
                nextLayout = nextLayout.replace(/^(import[\s\S]*?;\s*)/m, `$1\nimport AppAnalytics from '@/app/analytics';\n`);
              } else {
                nextLayout = `import AppAnalytics from '@/app/analytics';\n` + nextLayout;
              }
            }
            if (!/\<AppAnalytics\s*\/>/m.test(nextLayout)) {
              // Try to drop right after opening <body ...>
              const bodyIdx = nextLayout.search(/<body[^>]*>/i);
              if (bodyIdx !== -1) {
                const insertPos = nextLayout.indexOf('>', bodyIdx) + 1;
                nextLayout = nextLayout.slice(0, insertPos) + `\n      <AppAnalytics />` + nextLayout.slice(insertPos);
              } else {
                // Fallback: before {children}
                nextLayout = nextLayout.replace(/(\{\s*children\s*\})/m, `<AppAnalytics />\n      $1`);
              }
            }
            await sandbox.files.write(layoutPath, nextLayout);
            result.state.data.files[layoutPath] = nextLayout;
            return;
          }

          // Fallbacks: try raw head injection or create app/head.tsx
          let targetPath: string | undefined;
          let updatedContent: string | undefined;
          for (const p of candidates) {
            const content = files[p] as string;
            if (content.includes("</head>")) {
              updatedContent = content.replace(/<\/head>/i, `\n  {/* Analytics */}\n  <script>\n${code}\n  </script>\n</head>`);
              targetPath = p;
              break;
            }
          }
          if (!updatedContent) {
            targetPath = "app/head.tsx";
            updatedContent = `export default function Head() {\n  return (\n    <>\n      {/* Analytics */}\n      <script>\n${code}\n      </script>\n    </>\n  );\n}\n`;
          }
          if (targetPath && updatedContent) {
            await sandbox.files.write(targetPath, updatedContent);
            result.state.data.files[targetPath] = updatedContent;
          }
        } catch (err) {
          console.warn("Analytics injection failed", err);
        }
      });
    }

    // Post-process: fix common export issues (versions, tailwind/shadcn, missing UI stubs)
    if (!isError) {
      await step.run("postprocess-project", async () => {
        const sandbox = await getSandbox(sandboxId);

        // Helper: safe read
        const readSafe = async (p: string) => {
          try {
            return await sandbox.files.read(p);
          } catch {
            return undefined;
          }
        };

        // 0) Ensure 'use client' directive is the very first line when present
        try {
          const moveUseClientToTop = (src: string) => {
            if (!/['"]use client['"]/m.test(src)) return src;
            // Remove all occurrences of the directive and re-insert at the top
            const withoutAll = src.replace(/^[\s;]*["']use client["']\s*;?\s*/gm, "");
            return `"use client";\n` + withoutAll.replace(/^\s+/, "");
          };
          const entries = Object.entries(result.state.data.files || {});
          for (const [path, content] of entries) {
            if (typeof content !== "string") continue;
            if (!/\.(tsx|jsx)$/i.test(path)) continue;
            const fixed = moveUseClientToTop(content);
            if (fixed !== content) {
              await sandbox.files.write(path, fixed);
              result.state.data.files[path] = fixed;
            }
          }
        } catch (e) {
          console.warn("postprocess: move 'use client' to top failed", e);
        }

        // 1) Sanitize package.json: versions like ^latest/~latest, invalid package names, fix next-themes
        try {
          const pkgPath = "package.json";
          const pkgRaw = await readSafe(pkgPath);
          if (pkgRaw) {
            const pkg = JSON.parse(pkgRaw);
            const fix = (deps?: Record<string, string>) => {
              if (!deps) return;
              for (const k of Object.keys(deps)) {
                const v = deps[k];
                // Remove clearly invalid package names (import paths accidentally added to deps)
                if (/\//.test(k) && !k.startsWith("@")) {
                  delete deps[k];
                  continue;
                }
                if (k === "next/font/google" || k === "motion/react") {
                  delete deps[k];
                  continue;
                }
                // Normalize invalid tags
                if (typeof v === "string") {
                  const vv = v.trim();
                  if (/^\^latest$/i.test(vv) || /^~latest$/i.test(vv)) {
                    deps[k] = "latest";
                  }
                  // next-themes bogus versions – set to a known good range
                  if (k === "next-themes") {
                    if (!/^\d/.test(vv) && !/^~?\^?\d/.test(vv)) {
                      deps[k] = "^0.3.0";
                    }
                  }
                }
              }
            };
            fix(pkg.dependencies);
            fix(pkg.devDependencies);
            fix(pkg.peerDependencies);
            fix(pkg.optionalDependencies);
            const nextRaw = JSON.stringify(pkg, null, 2) + "\n";
            if (nextRaw !== pkgRaw) {
              await sandbox.files.write(pkgPath, nextRaw);
              result.state.data.files[pkgPath] = nextRaw;
            }
          }
        } catch (e) {
          console.warn("postprocess: package.json sanitize failed", e);
        }

        // 2) Ensure Tailwind config and shadcn tokens (prefer CJS for compatibility)
        try {
          const twPaths = [
            "tailwind.config.cjs",
            "tailwind.config.js",
            "tailwind.config.mjs",
            "tailwind.config.ts",
          ];
          let twPath: string | undefined;
          let twRaw: string | undefined;
          for (const p of twPaths) {
            const r = await readSafe(p);
            if (r) {
              twPath = p;
              twRaw = r;
              break;
            }
          }
          const shadcnTwCjs = `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  darkMode: ['class'],\n  content: [\n    './app/**/*.{ts,tsx}',\n    './components/**/*.{ts,tsx}',\n    './pages/**/*.{ts,tsx}',\n    './src/**/*.{ts,tsx}',\n  ],\n  theme: {\n    extend: {\n      colors: {\n        border: 'hsl(var(--border))',\n        input: 'hsl(var(--input))',\n        ring: 'hsl(var(--ring))',\n        background: 'hsl(var(--background))',\n        foreground: 'hsl(var(--foreground))',\n        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },\n        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },\n        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },\n        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },\n        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },\n        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },\n        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },\n      },\n      borderRadius: {\n        lg: 'var(--radius)',\n        md: 'calc(var(--radius) - 2px)',\n        sm: 'calc(var(--radius) - 4px)',\n      },\n    },\n  },\n  plugins: [],\n}\n`;
          const needsWrite = !twRaw || !/colors:\s*\{[\s\S]*border:/m.test(twRaw) || !/content:\s*\[/m.test(twRaw);
          if (needsWrite) {
            const pathToWrite = twPath && twPath.endsWith(".cjs") ? twPath : "tailwind.config.cjs";
            await sandbox.files.write(pathToWrite, shadcnTwCjs);
            result.state.data.files[pathToWrite] = shadcnTwCjs;
          }
        } catch (e) {
          console.warn("postprocess: tailwind config ensure failed", e);
        }

        // 2.5) Ensure next.config images allows picsum.photos
        try {
          const jsPath = "next.config.js";
          const mjsPath = "next.config.mjs";
          const jsRaw = await readSafe(jsPath);
          const mjsRaw = await readSafe(mjsPath);

          if (!jsRaw && !mjsRaw) {
            const cfg = `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  images: { domains: ['picsum.photos'] },\n};\nmodule.exports = nextConfig;\n`;
            await sandbox.files.write(jsPath, cfg);
            result.state.data.files[jsPath] = cfg;
          } else if (jsRaw && !/picsum\.photos/.test(jsRaw)) {
            const patched = `${jsRaw}\n// Ensure picsum.photos domain for next/image\nmodule.exports.images = module.exports.images || {};\nmodule.exports.images.domains = Array.from(new Set([...(module.exports.images.domains || []), 'picsum.photos']));\n`;
            await sandbox.files.write(jsPath, patched);
            result.state.data.files[jsPath] = patched;
          }
        } catch (e) {
          console.warn("postprocess: ensure next.config images failed", e);
        }

        // 3) Ensure globals.css has CSS variables for shadcn
        try {
          const gPath = "app/globals.css";
          const gRaw = await readSafe(gPath);
          const baseCss = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n@layer base {\n  :root {\n    --background: 0 0% 100%;\n    --foreground: 222.2 84% 4.9%;\n    --card: 0 0% 100%;\n    --card-foreground: 222.2 84% 4.9%;\n    --popover: 0 0% 100%;\n    --popover-foreground: 222.2 84% 4.9%;\n    --primary: 221.2 83.2% 53.3%;\n    --primary-foreground: 210 40% 98%;\n    --secondary: 210 40% 96.1%;\n    --secondary-foreground: 222.2 47.4% 11.2%;\n    --muted: 210 40% 96.1%;\n    --muted-foreground: 215.4 16.3% 46.9%;\n    --accent: 210 40% 96.1%;\n    --accent-foreground: 222.2 47.4% 11.2%;\n    --destructive: 0 84.2% 60.2%;\n    --destructive-foreground: 210 40% 98%;\n    --border: 214.3 31.8% 91.4%;\n    --input: 214.3 31.8% 91.4%;\n    --ring: 221.2 83.2% 53.3%;\n    --radius: 0.5rem;\n  }\n  .dark {\n    --background: 222.2 84% 4.9%;\n    --foreground: 210 40% 98%;\n    --card: 222.2 84% 4.9%;\n    --card-foreground: 210 40% 98%;\n    --popover: 222.2 84% 4.9%;\n    --popover-foreground: 210 40% 98%;\n    --primary: 217.2 91.2% 59.8%;\n    --primary-foreground: 222.2 47.4% 11.2%;\n    --secondary: 217.2 32.6% 17.5%;\n    --secondary-foreground: 210 40% 98%;\n    --muted: 217.2 32.6% 17.5%;\n    --muted-foreground: 215 20.2% 65.1%;\n    --accent: 217.2 32.6% 17.5%;\n    --accent-foreground: 210 40% 98%;\n    --destructive: 0 62.8% 30.6%;\n    --destructive-foreground: 0 85.7% 97.3%;\n    --border: 217.2 32.6% 17.5%;\n    --input: 217.2 32.6% 17.5%;\n    --ring: 224.3 76.3% 48%;\n  }\n}\n`;
          if (!gRaw || !/:root\s*\{[\s\S]*--background:/m.test(gRaw)) {
            const out = gRaw ? `${baseCss}\n${gRaw}` : baseCss;
            await sandbox.files.write(gPath, out);
            result.state.data.files[gPath] = out;
          }
        } catch (e) {
          console.warn("postprocess: globals.css ensure failed", e);
        }

        // 4) Ensure tsconfig paths for @/*
        try {
          const tsPath = "tsconfig.json";
          const tsRaw = await readSafe(tsPath);
          if (tsRaw) {
            const ts = JSON.parse(tsRaw);
            ts.compilerOptions = ts.compilerOptions || {};
            ts.compilerOptions.baseUrl = ts.compilerOptions.baseUrl || ".";
            ts.compilerOptions.paths = ts.compilerOptions.paths || {};
            if (!ts.compilerOptions.paths["@/*"]) {
              ts.compilerOptions.paths["@/*"] = ["./*"];
            }
            const next = JSON.stringify(ts, null, 2) + "\n";
            if (next !== tsRaw) {
              await sandbox.files.write(tsPath, next);
              result.state.data.files[tsPath] = next;
            }
          }
        } catch (e) {
          console.warn("postprocess: tsconfig ensure failed", e);
        }

        // 5) Ensure lib/utils.ts with cn
        try {
          const utilPath = "lib/utils.ts";
          const utilRaw = await readSafe(utilPath);
          if (!utilRaw) {
            const content = `import { type ClassValue } from 'clsx';\nimport { clsx } from 'clsx';\nimport { twMerge } from 'tailwind-merge';\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n`;
            await sandbox.files.write(utilPath, content);
            result.state.data.files[utilPath] = content;
          }
        } catch (e) {
          console.warn("postprocess: utils.ts ensure failed", e);
        }

        // 6) Stub missing UI components referenced anywhere in the project
        try {
          const importRegex = new RegExp(String.raw`import\s+([^'";]+)\s+from\s+["']@/components/ui/([^"']+)["'];?`, "g");
          const modules = new Map<string, string[]>();
          for (const [path, content] of Object.entries(result.state.data.files)) {
            if (typeof content !== "string") continue;
            if (!/(\.tsx|\.ts|\.jsx|\.js)$/i.test(path)) continue;
            const matches = content.matchAll(importRegex);
            for (const m of matches) {
              const spec = m[1].trim();
              const mod = m[2].trim();
              const names: string[] = [];
              const named = spec.match(/\{([^}]+)\}/);
              if (named) {
                for (const n of named[1].split(",")) names.push(n.trim().split(/\s+as\s+/)[0]);
              }
              const defMatch = spec.replace(named?.[0] || "", "").trim();
              if (defMatch && defMatch !== ",") names.push("default:" + defMatch);
              const prev = modules.get(mod) || [];
              modules.set(mod, prev.concat(names));
            }
          }
          for (const [mod, names] of modules) {
            const target = `components/ui/${mod}.tsx`;
            const exists = await readSafe(target);
            if (!exists) {
              if (mod === "accordion") {
                // Write a real shadcn-style accordion using Radix (no CSS files required)
                const content = `"use client";\n\nimport * as React from "react";\nimport * as AccordionPrimitive from "@radix-ui/react-accordion";\nimport { ChevronDown } from "lucide-react";\nimport { cn } from "@/lib/utils";\n\nconst Accordion = AccordionPrimitive.Root;\n\nconst AccordionItem = React.forwardRef<\n  HTMLDivElement,\n  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>\n>(({ className, ...props }, ref) => (\n  <AccordionPrimitive.Item\n    ref={ref}\n    className={cn("border-b", className)}\n    {...props}\n  />\n));\nAccordionItem.displayName = "AccordionItem";\n\nconst AccordionTrigger = React.forwardRef<\n  HTMLButtonElement,\n  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>\n>(({ className, children, ...props }, ref) => (\n  <AccordionPrimitive.Header className="flex">\n    <AccordionPrimitive.Trigger\n      ref={ref}\n      className={cn(\n        "flex flex-1 items-center justify-between py-4 text-left font-medium transition-all hover:underline",\n        className\n      )}\n      {...props}\n    >\n      {children}\n      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />\n    </AccordionPrimitive.Trigger>\n  </AccordionPrimitive.Header>\n));\nAccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;\n\nconst AccordionContent = React.forwardRef<\n  HTMLDivElement,\n  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>\n>(({ className, children, ...props }, ref) => (\n  <AccordionPrimitive.Content\n    ref={ref}\n    className={cn(\n      "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",\n      className\n    )}\n    {...props}\n  >\n    <div className="pb-4 pt-0">{children}</div>\n  </AccordionPrimitive.Content>\n));\nAccordionContent.displayName = AccordionPrimitive.Content.displayName;\n\nexport { Accordion, AccordionItem, AccordionTrigger, AccordionContent };\n`;
                await sandbox.files.write(target, content);
                result.state.data.files[target] = content;

                // Ensure dependency exists in package.json
                try {
                  const pkgPath = "package.json";
                  const pkgRaw = await readSafe(pkgPath);
                  if (pkgRaw) {
                    const pkg = JSON.parse(pkgRaw);
                    pkg.dependencies = pkg.dependencies || {};
                    if (!pkg.dependencies["@radix-ui/react-accordion"]) {
                      pkg.dependencies["@radix-ui/react-accordion"] = "latest";
                      const nextRaw = JSON.stringify(pkg, null, 2) + "\n";
                      await sandbox.files.write(pkgPath, nextRaw);
                      result.state.data.files[pkgPath] = nextRaw;
                    }
                  }
                } catch (e) {
                  console.warn("postprocess: add @radix-ui/react-accordion failed", e);
                }
              } else {
                // Fallback: lightweight stub
                const exports: string[] = [];
                const defaultName = names.find((n) => n.startsWith("default:"))?.split(":")[1];
                if (defaultName) {
                  exports.push(`const ${defaultName} = (props: any) => <div {...props} />;\nexport default ${defaultName};`);
                }
                const named = names.filter((n) => !n.startsWith("default:"));
                for (const n of named) {
                  if (!n) continue;
                  exports.push(`export const ${n} = (props: any) => <div {...props} />;`);
                }
                const stub = `"use client";\nimport React from 'react';\n${exports.join("\n")}\n`;
                await sandbox.files.write(target, stub);
                result.state.data.files[target] = stub;
              }
            }
          }
        } catch (e) {
          console.warn("postprocess: stub ui components failed", e);
        }

  // 7) Ensure shadcn components.json exists (helps users extend components later)
        try {
          const cfgPath = "components.json";
          const existing = await readSafe(cfgPath);
          if (!existing) {
            // Detect tailwind config file name written earlier
            const twJs = await readSafe("tailwind.config.js");
            const twCjs = await readSafe("tailwind.config.cjs");
            const twFile = twJs ? "tailwind.config.js" : twCjs ? "tailwind.config.cjs" : "tailwind.config.js";
            const cfg = {
              $schema: "https://ui.shadcn.com/schema.json",
              style: "default",
              rsc: true,
              tsx: true,
              tailwind: {
                config: twFile,
                css: "app/globals.css",
                baseColor: "slate",
                cssVariables: true,
                prefix: "",
              },
              aliases: { components: "@/components", utils: "@/lib/utils" },
            } as any;
            const raw = JSON.stringify(cfg, null, 2) + "\n";
            await sandbox.files.write(cfgPath, raw);
            result.state.data.files[cfgPath] = raw;
          }
        } catch (e) {
          console.warn("postprocess: components.json ensure failed", e);
        }

        // 8) Defensive: backgrounds shouldn't block clicks (don't force z-index to avoid hiding effects).
        try {
          const entries = Object.entries(result.state.data.files);
          for (const [path, content] of entries) {
            if (!/\.(tsx|jsx)$/.test(path)) continue;
            if (typeof content !== "string") continue;
            // Add pointer-events-none and select-none to common decorative background wrappers
            let next = content.replace(
              /(className=\"[^\"]*\babsolute\b[^\"]*\binset-0\b[^\"]*)(\")/g,
              (m, p1, p2) =>
                p1.includes("pointer-events-none") ? m : `${p1} pointer-events-none select-none${p2}`
            );
            if (next !== content) {
              await sandbox.files.write(path, next);
              result.state.data.files[path] = next;
            }
          }
        } catch (e) {
          console.warn("postprocess: background safety patch failed", e);
        }

        // 9) Ensure runtime deps for animations exist and are installed in sandbox
        try {
          const entries = Object.entries(result.state.data.files);
          let needsFramer = false;
          let needsSlot = false;
          for (const [path, content] of entries) {
            if (!/\.(tsx|ts|jsx|js)$/.test(path)) continue;
            if (typeof content !== "string") continue;
            if (/from\s+['"]framer-motion['"]/m.test(content)) needsFramer = true;
            if (/from\s+['"]@radix-ui\/react-slot['"]/m.test(content)) needsSlot = true;
          }
          const pkgPath = "package.json";
          const pkgRaw = await readSafe(pkgPath);
          if (pkgRaw) {
            const pkg = JSON.parse(pkgRaw);
            pkg.dependencies = pkg.dependencies || {};
            let changed = false;
            if (needsFramer && !pkg.dependencies["framer-motion"]) {
              pkg.dependencies["framer-motion"] = "latest";
              changed = true;
            }
            if (needsSlot && !pkg.dependencies["@radix-ui/react-slot"]) {
              pkg.dependencies["@radix-ui/react-slot"] = "latest";
              changed = true;
            }
            if (changed) {
              const nextRaw = JSON.stringify(pkg, null, 2) + "\n";
              await sandbox.files.write(pkgPath, nextRaw);
              result.state.data.files[pkgPath] = nextRaw;
              // Install deps in sandbox so preview can run animations
              try {
                await sandbox.commands.run("npm i --no-audit --no-fund");
              } catch (e) {
                console.warn("sandbox npm install failed", e);
              }
            }
          }
        } catch (e) {
          console.warn("postprocess: ensure animation deps failed", e);
        }

        // 10) Fallback demo page: do NOT overwrite app/page.tsx; create demo route only if root page is missing
        try {
          const bgComp = await readSafe("components/ui/background-paths.tsx");
          if (bgComp) {
            const pagePath = "app/page.tsx";
            const pageRaw = await readSafe(pagePath);
            if (!pageRaw) {
              const demoPath = "app/demos/background-paths/page.tsx";
              const demo = `import { BackgroundPaths } from '@/components/ui/background-paths';

export default function Page() {
  return <BackgroundPaths title="Background Paths" />;
}
`;
              await sandbox.files.write(demoPath, demo);
              result.state.data.files[demoPath] = demo;
            }
          }
        } catch (e) {
          console.warn("postprocess: fallback BackgroundPaths demo failed", e);
        }
      });
    }

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      console.log("Running get-sandbox-url");
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      console.log("Completed get-sandbox-url", host);
      return `https://${host}`;
    });

  await step.run("save-result", async () => {
      console.log("Running save-result");
      if (isError) {
        const errorMessage = await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again.",
            role: "ASSISTANT",
            type: "ERROR",
          },
        });
        console.log("Completed save-result with error", errorMessage.id);
        return errorMessage;
      }

  const successMessage = await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: parseAgentOutput(responseOutput),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl,
              title: parseAgentOutput(fragmentTitleOutput),
              files: result.state.data.files,
            },
          },
        },
      });
      console.log("Completed save-result with success", successMessage.id);
      return successMessage;
    });
    console.log("Completed code-agent function");
    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  }
);
