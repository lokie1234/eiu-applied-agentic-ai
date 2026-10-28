import { queryGeneric, mutationGeneric, internalMutationGeneric, internalActionGeneric, makeFunctionReference, type GenericMutationCtx, type DataModelFromSchemaDefinition, type GenericQueryCtx, type QueryBuilder, type MutationBuilder, type ActionBuilder } from "convex/server";
import schema from "./schema";
import { ConvexError, v } from "convex/values";

type DataModel = DataModelFromSchemaDefinition<typeof schema>;
type Context = GenericMutationCtx<DataModel>;
const query = queryGeneric as QueryBuilder<DataModel, "public">;
const mutation = mutationGeneric as MutationBuilder<DataModel, "public">;
const internalMutation = internalMutationGeneric as MutationBuilder<DataModel, "internal">;
const internalAction = internalActionGeneric as ActionBuilder<DataModel, "internal">;
type Identity = { subject: string; role: unknown; sections: unknown; teaching: unknown };
function scopes(identity: Identity) { try { return JSON.parse(String(identity.sections)) as string[]; } catch { return []; } }
function teaching(identity: Identity) { try { return JSON.parse(String(identity.teaching)) as string[]; } catch { return []; } }
async function identity(ctx: { auth: GenericQueryCtx<DataModel>["auth"] }) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) throw new ConvexError("Authentication required.");
  return user as unknown as Identity;
}
async function recount(ctx: Context, sectionId: string) {
  const people = await ctx.db.query("presence").withIndex("room", q => q.eq("sectionId", sectionId)).collect();
  const subjects = [...new Set(people.map(person => person.subject))];
  const online = subjects.length;
  const count = await ctx.db.query("counts").withIndex("room", q => q.eq("sectionId", sectionId)).unique();
  if (count) { if (JSON.stringify(count.subjects) !== JSON.stringify(subjects)) await ctx.db.patch(count._id, { online, subjects }); }
  else await ctx.db.insert("counts", { sectionId, online, subjects });
}

export const signals = query({ args: { sectionIds: v.array(v.string()) }, handler: async (ctx, { sectionIds }) => {
  const user = await identity(ctx), allowed = scopes(user);
  if (sectionIds.length > 500 || sectionIds.some(id => !allowed.includes(id))) throw new ConvexError("Section access denied.");
  return (await Promise.all(sectionIds.map(sectionId => ctx.db.query("signals").withIndex("scope", q => q.eq("sectionId", sectionId)).collect()))).flat();
} });
export const online = query({ args: {}, handler: async ctx => {
  const user = await identity(ctx), allowed = user.role === "admin" ? scopes(user) : teaching(user);
  return Promise.all(allowed.map(async sectionId => {
    const count = await ctx.db.query("counts").withIndex("room", q => q.eq("sectionId", sectionId)).unique();
    return { sectionId, online: count?.online || 0, subjects: count?.subjects || [] };
  }));
} });
export const pulse = mutation({ args: { sectionId: v.string(), clientId: v.string(), leave: v.optional(v.boolean()) }, handler: async (ctx, args) => {
  const user = await identity(ctx), now = Date.now();
  if (!scopes(user).includes(args.sectionId) || args.clientId.length > 120 || !args.clientId) throw new ConvexError("Section access denied.");
  if (user.role === "admin" || teaching(user).includes(args.sectionId)) return { tracked: false };
  const limit = await ctx.db.query("limits").withIndex("person", q => q.eq("subject", user.subject)).unique();
  if (limit && limit.blockedUntil > now) return { retryAfter: Math.ceil((limit.blockedUntil - now) / 1000) };
  const count = !limit || limit.blockedUntil > 0 || now - limit.start >= 60_000 ? 1 : limit.count + 1;
  const start = count === 1 ? now : limit!.start, blockedUntil = count > 12 ? now + 120_000 : 0;
  if (limit) await ctx.db.patch(limit._id, { count, start, blockedUntil });
  else await ctx.db.insert("limits", { subject: user.subject, count, start, blockedUntil });
  if (blockedUntil) return { retryAfter: 120 }; // Return, not throw: persist the block.
  const row = await ctx.db.query("presence").withIndex("person", q => q.eq("subject", user.subject).eq("sectionId", args.sectionId).eq("clientId", args.clientId)).unique();
  if (row?.expiryJob) await ctx.scheduler.cancel(row.expiryJob);
  if (args.leave) {
    if (row) { await ctx.db.delete(row._id); await recount(ctx, args.sectionId); }
    return { tracked: false };
  }
  if (!row) {
    const tabs = await ctx.db.query("presence").withIndex("person", q => q.eq("subject", user.subject)).take(7);
    if (tabs.length >= 6) return { retryAfter: 120 };
  }
  const expiresAt = now + 65_000;
  const id = row?._id || await ctx.db.insert("presence", { subject: user.subject, sectionId: args.sectionId, clientId: args.clientId, expiresAt });
  const expiryJob = await ctx.scheduler.runAfter(65_000, makeFunctionReference<"mutation">("realtime:expire"), { id, expiresAt });
  await ctx.db.patch(id, { expiresAt, expiryJob });
  if (!row) await recount(ctx, args.sectionId);
  return { tracked: true };
} });
export const expire = internalMutation({ args: { id: v.id("presence"), expiresAt: v.number() }, handler: async (ctx, { id, expiresAt }) => {
  const row = await ctx.db.get(id);
  if (row && row.expiresAt === expiresAt && row.expiresAt <= Date.now()) { await ctx.db.delete(id); await recount(ctx, row.sectionId); }
} });
export const publish = internalMutation({ args: { rows: v.array(v.object({ sectionId: v.string(), topic: v.string(), revision: v.number() })) }, handler: async (ctx, { rows }) => {
  for (const row of rows) {
    const old = await ctx.db.query("signals").withIndex("scope", q => q.eq("sectionId", row.sectionId).eq("topic", row.topic)).unique();
    if (!old) await ctx.db.insert("signals", row);
    else if (row.revision > old.revision) await ctx.db.patch(old._id, { revision: row.revision });
  }
} });
export const reconcile = internalAction({ args: {}, handler: async ctx => {
  const origin = process.env.EIU_APP_ORIGIN, secret = process.env.EIU_REALTIME_BRIDGE_SECRET;
  if (!origin || !secret) return;
  const response = await fetch(`${origin}/api/realtime/sync`, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Realtime reconciliation unavailable.");
  const data = await response.json();
  await ctx.runMutation(makeFunctionReference<"mutation">("realtime:publish"), { rows: data.rows });
  if (data.classroom) await ctx.runMutation(makeFunctionReference<"mutation">("classroom:replace"), data.classroom);
} });
export const cleanup = internalMutation({ args: {}, handler: async ctx => {
  const rows = await ctx.db.query("limits").take(1000);
  for (const row of rows) if (row.start < Date.now() - 86400_000 && row.blockedUntil < Date.now()) await ctx.db.delete(row._id);
} });
