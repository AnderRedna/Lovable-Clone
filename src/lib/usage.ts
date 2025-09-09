import { RateLimiterPrisma } from "rate-limiter-flexible";
import { auth } from "@clerk/nextjs/server";

import prisma from "./prisma";

const FREE_POINTS = 1;
const PRO_POINTS = 2;
const DURATION = 30 * 24 * 60 * 60; // 30 days
const GENERATION_COST = 1;

export async function getUsageTracker() {
  console.log("Starting getUsageTracker");
  const { has } = await auth();
  const hasProAccess = has({ plan: "pro" });

  const usageTracker = new RateLimiterPrisma({
    storeClient: prisma,
    tableName: "Usage",
    points: hasProAccess ? PRO_POINTS : FREE_POINTS,
    duration: DURATION,
  });
  console.log("Completed getUsageTracker", hasProAccess);
  return usageTracker;
}

export async function consumeCredits() {
  console.log("Starting consumeCredits");
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not autheticated");
  }

  const usageTracker = await getUsageTracker();
  const result = await usageTracker.consume(userId, GENERATION_COST);
  console.log("Completed consumeCredits", result);
  return result;
}

export async function getUsageStatus() {
  console.log("Starting getUsageStatus");
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not autheticated");
  }

  const usageTracker = await getUsageTracker();
  const result = await usageTracker.get(userId);
  console.log("Completed getUsageStatus", result);
  return result;
}
