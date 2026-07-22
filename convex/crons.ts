import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.daily("retention cleanup", { hourUTC: 3, minuteUTC: 15 }, internal.maintenance.applyRetentionPolicy);
export default crons;
