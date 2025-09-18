import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { IMPROVE_PROMPT } from "@/prompt";

// Reuse the same Azure OpenAI compat layer used in the code agent
import { inngest } from "@/inngest/client";

// Local copy of the minimal Azure adapter from inngest/functions.ts to avoid cross-module import issues
const azureOpenAICompat = (opts: {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}) => {
  const endpoint = opts.endpoint.replace(/\/$/, "");
  const url = `${endpoint}/openai/deployments/${opts.deployment}/chat/completions?api-version=${opts.apiVersion}`;
  return {
    url,
    headers: {
      "api-key": opts.apiKey,
      "content-type": "application/json",
    },
  };
};

async function callAzureChat(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>): Promise<string> {
  // Use GPT-4.1 for the "improve" button
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_4_1_API_KEY || process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_4_1_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_4_1_API_VERSION || process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview";

  if (!endpoint || !apiKey || !deployment) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Azure OpenAI env vars missing" });
  }

  const cfg = azureOpenAICompat({ endpoint, apiKey, deployment, apiVersion });
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: cfg.headers,
    body: JSON.stringify({
      messages,
      temperature: 0.4,
      max_tokens: 300,
      stream: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TRPCError({ code: "BAD_REQUEST", message: `Azure OpenAI error: ${res.status} ${text}` });
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Empty response from model" });
  }
  return content;
}

export const promptsRouter = createTRPCRouter({
  improve: protectedProcedure
    .input(z.object({ value: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const sys = "Você é um assistente que melhora prompts de landing pages.";
      const user = IMPROVE_PROMPT.replace("{user_prompt}", input.value);
      const improved = await callAzureChat([
        { role: "system", content: sys },
        { role: "user", content: user },
      ]);
      return { value: improved };
    }),
});
