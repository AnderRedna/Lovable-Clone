import { messagesRouter } from "@/modules/messages/server/procedures";
import { projectsRouter } from "@/modules/projects/server/procedures";
import { promptsRouter } from "@/modules/prompts/server/procedures";
import { usageRouter } from "@/modules/usage/server/procedure";
import { createTRPCRouter } from "../init";

export const appRouter = createTRPCRouter({
  messages: messagesRouter,
  projects: projectsRouter,
  prompts: promptsRouter,
  usage: usageRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
