import { TRPCError } from "@trpc/server";
import { generateSlug } from "random-word-slugs";
import { z } from "zod";

import { analyticsProviderSchema } from "@/modules/home/ui/components/project-form/types";

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { consumeCredits } from "@/lib/usage";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const projectsRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1, { message: "id is required" }),
      })
    )
    .query(async ({ input, ctx }) => {
      console.log("Starting projects.getOne", input);
      const existingProject = await prisma.project.findUnique({
        where: {
          id: input.id,
          userId: ctx.auth.userId,
        },
      });

      if (!existingProject) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      console.log("Completed projects.getOne", existingProject.id);
      return existingProject;
    }),
  getMany: protectedProcedure.query(async ({ ctx }) => {
    console.log("Starting projects.getMany");
    const projects = await prisma.project.findMany({
      where: {
        userId: ctx.auth.userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
    console.log("Completed projects.getMany", projects.length, "projects");
    return projects;
  }),
  create: protectedProcedure
    .input(
      z.object({
        value: z.string().min(1, { message: "Value is required" }),
        customization: z
          .object({
            analytics: z.object({
              provider: analyticsProviderSchema,
              code: z.string().optional(),
            }),
            components: z.record(
              z.string(),
              z.object({
                enabled: z.boolean(),
                prompt: z.string().optional(),
                border: z
                  .object({
                    enabled: z.boolean(),
                    prompt: z.string().optional(),
                  })
                  .optional(),
              })
            ),
            theme: z
              .object({
                paletteId: z.string(),
                paletteName: z.string(),
                colors: z
                  .array(z.string().regex(/^#?[0-9A-Fa-f]{6}$/))
                  .length(4),
              })
              .optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      console.log("Starting projects.create", JSON.stringify(input));
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

      const createdProject = await prisma.project.create({
        data: {
          userId: ctx.auth.userId,
          name: generateSlug(2, { format: "kebab" }),
          messages: {
            create: {
              content: input.value,
              role: "USER",
              type: "RESULT",
            },
          },
        },
      });

  const sendResult = await inngest.send({
        name: "code-agent/run",
        data: {
          value: input.value,
          projectId: createdProject.id,
          customization: input.customization,
        },
      });
  console.log("Inngest event sent (projects.create)", sendResult);
  console.log("Completed projects.create", createdProject.id);
      return createdProject;
    }),
});
