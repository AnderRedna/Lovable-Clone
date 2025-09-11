import { z } from "zod";

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { consumeCredits } from "@/lib/usage";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";

export const messagesRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "projectId is required" }),
      })
    )
    .query(async ({ input, ctx }) => {
      console.log("Starting messages.getMany", input);
      const messages = await prisma.message.findMany({
        where: {
          projectId: input.projectId,
          project: {
            userId: ctx.auth.userId,
          },
        },
        orderBy: {
          updatedAt: "asc",
        },
        include: {
          fragment: true,
        },
      });
      console.log("Completed messages.getMany", messages.length, "messages");
      return messages;
    }),
  create: protectedProcedure
    .input(
      z.object({
        value: z.string().min(1, { message: "Value is required" }),
        projectId: z.string().min(1, { message: "projectId is required" }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      console.log("Starting messages.create", input);
      const existingProject = await prisma.project.findUnique({
        where: {
          id: input.projectId,
          userId: ctx.auth.userId,
        },
      });

      if (!existingProject) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      try {
        if (process.env.DISABLE_CREDIT_CHECK !== 'true') {
          await consumeCredits();
        } else {
          console.log("Credit check disabled, skipping consumeCredits");
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Something went wrong.",
          });
        } else {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You ran out of credits",
          });
        }
      }

      const createdMessage = await prisma.message.create({
        data: {
          projectId: existingProject.id,
          content: input.value,
          role: "USER",
          type: "RESULT",
        },
      });

  // Decide whether to create or edit based on existing fragments
  const hasFragment = await prisma.message.findFirst({
        where: {
          projectId: existingProject.id,
          role: "ASSISTANT",
          type: "RESULT",
          fragment: { isNot: null },
        },
      });
  const eventName = hasFragment ? "code-agent/edit" : "code-agent/run";
  const sendResult = await inngest.send({
        name: eventName,
        data: {
          value: input.value,
          projectId: existingProject.id,
        },
      });
  console.log("Inngest event sent (messages.create)", sendResult);
  console.log("Completed messages.create", createdMessage.id);
      return createdMessage;
    }),
});
