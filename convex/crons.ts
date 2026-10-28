import { cronJobs, makeFunctionReference } from "convex/server";
const crons = cronJobs();
crons.interval("repair missed notifications", { seconds: 30 }, makeFunctionReference<"action">("realtime:reconcile"));
crons.daily("expire request counters", { hourUTC: 19, minuteUTC: 0 }, makeFunctionReference<"mutation">("realtime:cleanup"));
export default crons;
