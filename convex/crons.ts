import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Retention runs daily and off-peak. It deletes; it is the job most worth
// having a predictable, reviewable schedule.
crons.daily("retention cleanup", { hourUTC: 3, minuteUTC: 15 }, internal.maintenance.applyRetentionPolicy);

// Alerting runs hourly rather than continuously: the alert itself is rate
// limited to one an hour, so checking more often could not deliver more.
crons.hourly("error alerts", { minuteUTC: 5 }, internal.observability.sendAlerts);

export default crons;
