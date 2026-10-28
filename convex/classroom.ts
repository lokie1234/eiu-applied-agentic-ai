import { queryGeneric, mutationGeneric, internalMutationGeneric, type DataModelFromSchemaDefinition, type QueryBuilder, type MutationBuilder, type GenericQueryCtx } from "convex/server";
import { ConvexError, v } from "convex/values";
import schema from "./schema";
import { MIS301_DEMO_LEARNERS } from "../lib/classroomDemo";
type Model = DataModelFromSchemaDefinition<typeof schema>;
const query = queryGeneric as QueryBuilder<Model, "public">;
const mutation = mutationGeneric as MutationBuilder<Model, "public">;
const internalMutation = internalMutationGeneric as MutationBuilder<Model, "internal">;
async function authorized(ctx: { auth: GenericQueryCtx<Model>["auth"] }, sectionId: string) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) throw new ConvexError("Authentication required.");
  let allowed: string[] = [], teachers: string[] = [];
  try { allowed = JSON.parse(String(user.sections)); teachers = JSON.parse(String(user.teaching)); } catch { /* Deny malformed scopes. */ }
  if (!allowed.includes(sectionId)) throw new ConvexError("Section access denied.");
  return { subject: user.subject, teaching: user.role === "admin" || teachers.includes(sectionId) };
}
export const view = query({ args: { sectionId: v.string() }, handler: async (ctx, { sectionId }) => {
  const user = await authorized(ctx, sectionId);
  const room = await ctx.db.query("classroom").withIndex("room", q => q.eq("sectionId", sectionId)).unique();
  if (!room) return { ready: false, teaching: user.teaching, members: [], items: [], draw: null };
  const answers = await ctx.db.query("practiceAnswers").withIndex("room", q => q.eq("sectionId", sectionId)).take(200);
  return { ready: true, teaching: user.teaching, practiceSession: room.epoch,
    members: user.teaching ? room.members.map(member => ({ id: member.subject, username: member.username })).sort((a, b) => a.username.localeCompare(b.username)) : [],
    draw: user.teaching && room.draw ? { names: room.draw.names, subjects: room.draw.subjects || [], requestId: room.draw.requestId, createdAt: room.draw.createdAt } : null,
    demoDraw: user.teaching && room.demoDraw ? { names: room.demoDraw.names, subjects: room.demoDraw.subjects || [], requestId: room.demoDraw.requestId, createdAt: room.demoDraw.createdAt } : null,
    items: answers.filter(answer => user.teaching || answer.subject === user.subject).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || b.recordId.localeCompare(a.recordId)).map(answer => ({ id: answer.recordId, name: answer.username, partId: answer.partId, values: answer.values, submittedAt: answer.submittedAt })),
  };
} });
export const draw = mutation({ args: { sectionId: v.string(), count: v.number(), requestId: v.string(), excluded: v.array(v.string()), demo: v.optional(v.boolean()) }, handler: async (ctx, args) => {
  const user = await authorized(ctx, args.sectionId);
  if (!user.teaching) throw new ConvexError("Teaching access required.");
  if (!Number.isInteger(args.count) || args.count < 1 || args.count > 50 || !/^[a-f0-9-]{36}$/i.test(args.requestId) || args.excluded.length > 200) throw new ConvexError("Invalid draw settings.");
  const room = await ctx.db.query("classroom").withIndex("room", q => q.eq("sectionId", args.sectionId)).unique();
  if (!room) throw new ConvexError("Classroom is not ready. Please reconnect.");
  const previousDraw = args.demo ? room.demoDraw : room.draw;
  if (previousDraw?.requestId === args.requestId) return { names: previousDraw.names, subjects: previousDraw.subjects || [], createdAt: previousDraw.createdAt, requestId: args.requestId };
  if (previousDraw) return { message: "Reset the wheel before starting a new draw." };
  const key = `draw:${user.subject}`, now = Date.now();
  const limit = await ctx.db.query("limits").withIndex("person", q => q.eq("subject", key)).unique();
  if (limit && limit.blockedUntil > now) return { retryAfter: Math.ceil((limit.blockedUntil - now) / 1000) };
  const count = !limit || limit.blockedUntil > 0 || now - limit.start >= 60_000 ? 1 : limit.count + 1;
  const blockedUntil = count > 5 ? now + 120_000 : 0;
  if (limit) await ctx.db.patch(limit._id, { count, start: count === 1 ? now : limit.start, blockedUntil });
  else await ctx.db.insert("limits", { subject: key, count, start: now, blockedUntil });
  if (blockedUntil) return { retryAfter: 120 };
  const pool = (args.demo ? MIS301_DEMO_LEARNERS.map(member => ({ subject: member.id, username: member.username })) : room.members).filter(member => !args.excluded.includes(member.subject));
  if (args.count > pool.length) return { message: `Choose between 1 and ${pool.length} available learners.` };
  const names: string[] = [], subjects: string[] = [];
  for (let i = 0; i < args.count; i++) { const selected = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; names.push(selected.username); subjects.push(selected.subject); }
  const selected = { requestId: args.requestId, names, subjects, createdAt: now };
  await ctx.db.patch(room._id, args.demo ? { demoDraw: selected } : { draw: selected });
  return { names, subjects, createdAt: now, requestId: args.requestId };
} });
export const resetDraw = mutation({ args: { sectionId: v.string(), demo: v.optional(v.boolean()) }, handler: async (ctx, { sectionId, demo }) => {
  const user = await authorized(ctx, sectionId);
  if (!user.teaching) throw new ConvexError("Teaching access required.");
  const room = await ctx.db.query("classroom").withIndex("room", q => q.eq("sectionId", sectionId)).unique();
  if (!room || !(demo ? room.demoDraw : room.draw)) return { success: true };
  const key = `wheel-reset:${user.subject}`, now = Date.now();
  const limit = await ctx.db.query("limits").withIndex("person", q => q.eq("subject", key)).unique();
  if (limit && limit.blockedUntil > now) return { retryAfter: Math.ceil((limit.blockedUntil - now) / 1000) };
  const count = !limit || limit.blockedUntil > 0 || now - limit.start >= 60_000 ? 1 : limit.count + 1;
  const blockedUntil = count > 5 ? now + 120_000 : 0;
  if (limit) await ctx.db.patch(limit._id, { count, start: count === 1 ? now : limit.start, blockedUntil });
  else await ctx.db.insert("limits", { subject: key, count, start: now, blockedUntil });
  if (blockedUntil) return { retryAfter: 120 };
  await ctx.db.patch(room._id, demo ? { demoDraw: undefined } : { draw: undefined });
  return { success: true };
} });
export const replace = internalMutation({ args: {
  sectionId: v.string(), version: v.number(), epoch: v.string(),
  members: v.array(v.object({ subject: v.string(), username: v.string() })),
  answers: v.array(v.object({ recordId: v.string(), subject: v.string(), username: v.string(), partId: v.string(), values: v.record(v.string(), v.string()), submittedAt: v.string() })),
}, handler: async (ctx, args) => {
  if (args.members.length > 200 || args.answers.length > 200) throw new ConvexError("Classroom snapshot too large.");
  const room = await ctx.db.query("classroom").withIndex("room", q => q.eq("sectionId", args.sectionId)).unique();
  if (room && room.version >= args.version) return;
  const members = args.members.slice().sort((a, b) => a.subject.localeCompare(b.subject));
  if (!room) await ctx.db.insert("classroom", { sectionId: args.sectionId, version: args.version, epoch: args.epoch, members });
  else await ctx.db.patch(room._id, { version: args.version, epoch: args.epoch,
    ...(JSON.stringify(room.members) !== JSON.stringify(members) ? { members } : {}),
    ...(room.epoch !== args.epoch || args.members.length === 0 ? { draw: undefined } : {}),
    ...(room.epoch !== args.epoch ? { demoDraw: undefined } : {}),
  });
  const previous = await ctx.db.query("practiceAnswers").withIndex("room", q => q.eq("sectionId", args.sectionId)).take(201);
  const keep = new Set(args.answers.map(answer => answer.recordId));
  for (const row of previous) if (!keep.has(row.recordId) && (room?.epoch !== args.epoch || Date.parse(row.submittedAt) <= args.version)) await ctx.db.delete(row._id);
  const known = new Set(previous.map(row => row.recordId));
  for (const answer of args.answers) if (!known.has(answer.recordId)) await ctx.db.insert("practiceAnswers", { sectionId: args.sectionId, ...answer });
  const retained = await ctx.db.query("practiceAnswers").withIndex("room", q => q.eq("sectionId", args.sectionId)).take(401);
  retained.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || b.recordId.localeCompare(a.recordId));
  for (const row of retained.slice(200)) await ctx.db.delete(row._id);
} });
export const answer = internalMutation({ args: {
  sectionId: v.string(), epoch: v.string(),
  answer: v.object({ recordId: v.string(), subject: v.string(), username: v.string(), partId: v.string(), values: v.record(v.string(), v.string()), submittedAt: v.string() }),
}, handler: async (ctx, args) => {
  const room = await ctx.db.query("classroom").withIndex("room", q => q.eq("sectionId", args.sectionId)).unique();
  // Old session deliveries must never repopulate a terminated classroom.
  if (!room || room.epoch !== args.epoch) return;
  const previous = await ctx.db.query("practiceAnswers").withIndex("record", q => q.eq("sectionId", args.sectionId).eq("recordId", args.answer.recordId)).unique();
  if (!previous && Date.parse(args.answer.submittedAt) <= room.version) return;
  if (!previous) await ctx.db.insert("practiceAnswers", { sectionId: args.sectionId, ...args.answer });
  const all = await ctx.db.query("practiceAnswers").withIndex("room", q => q.eq("sectionId", args.sectionId)).take(201);
  all.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || b.recordId.localeCompare(a.recordId));
  for (const row of all.slice(200)) await ctx.db.delete(row._id);
} });
