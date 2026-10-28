import { httpRouter, httpActionGeneric as httpAction, makeFunctionReference } from "convex/server";
const http = httpRouter();
http.route({ path: "/signals", method: "POST", handler: httpAction(async (ctx, request) => {
  const secret = process.env.EIU_REALTIME_BRIDGE_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Forbidden", { status: 403 });
  const { rows } = await request.json();
  if (!Array.isArray(rows) || rows.length > 1000) return new Response("Invalid data", { status: 400 });
  await ctx.runMutation(makeFunctionReference<"mutation">("realtime:publish"), { rows });
  return Response.json({ success: true });
}) });
http.route({ path: "/classroom", method: "POST", handler: httpAction(async (ctx, request) => {
  const secret = process.env.EIU_REALTIME_BRIDGE_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Forbidden", { status: 403 });
  const payload = await request.json();
  await ctx.runMutation(makeFunctionReference<"mutation">("classroom:replace"), payload);
  return Response.json({ success: true });
}) });
http.route({ path: "/classroom/answer", method: "POST", handler: httpAction(async (ctx, request) => {
  const secret = process.env.EIU_REALTIME_BRIDGE_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Forbidden", { status: 403 });
  await ctx.runMutation(makeFunctionReference<"mutation">("classroom:answer"), await request.json());
  return Response.json({ success: true });
}) });
export default http;
