import { Sandbox } from "@e2b/code-interpreter";
import {
  createAgent,
  createNetwork,
  createState,
  createTool,
  type Message,
  openai,
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

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    console.log("Starting code-agent function", event.data);
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
      model: openai({
        model: "gpt-4.1",
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

    const result = await network.run(event.data.value, { state });
    console.log("Completed network.run", result.state.data.summary ? "success" : "error");

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({
        model: "gpt-4o",
        defaultParameters: {
          temperature: 0.1,
        },
      }),
    });

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: openai({
        model: "gpt-4o",
        defaultParameters: {
          temperature: 0.1,
        },
      }),
    });

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
      result.state.data.summary
    );
    console.log("Completed fragmentTitleGenerator.run");

    const { output: responseOutput } = await responseGenerator.run(
      result.state.data.summary
    );
    console.log("Completed responseGenerator.run");

    const isError =
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;

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
