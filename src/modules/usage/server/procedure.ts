import { getUsageStatus } from "@/lib/usage";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const usageRouter = createTRPCRouter({
  status: protectedProcedure.query(async () => {
    console.log("Starting usage.status");
    try {
      const usage = await getUsageStatus();
      console.log("Completed usage.status", usage);
      return usage;
    } catch {
      console.log("Error in usage.status");
      return null;
    }
  }),
});
