import { queryGeneric, mutationGeneric, internalMutationGeneric, makeFunctionReference, type DataModelFromSchemaDefinition, type QueryBuilder, type MutationBuilder, type GenericQueryCtx } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import schema from './schema';
import { MIS311_SPOTLIGHT_SECTION_ID, SPOTLIGHT_SPIN_MS, spotlightRevealAt, spotlightFinishedAt, spotlightSlide, type SpotlightDraw } from '../lib/mis311Spotlight';
import { ASSIGNMENT_WHEEL_SECTION_ID, DEFAULT_WHEEL_SECTIONS, validWheelCount } from '../lib/sectionWheel';
type Model = DataModelFromSchemaDefinition<typeof schema>;
const query = queryGeneric as QueryBuilder<Model, 'public'>;
const mutation = mutationGeneric as MutationBuilder<Model, 'public'>;
const internalMutation = internalMutationGeneric as MutationBuilder<Model, 'internal'>;
function result({ requestId, slide, subject, username, targets, createdAt, revealAt }: SpotlightDraw): SpotlightDraw {
  return { requestId, slide, subject, username, ...(targets?{targets}:{}), createdAt, revealAt };
}
async function authorize(ctx: { auth: GenericQueryCtx<Model>['auth'] }, sectionId: string) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) throw new ConvexError('Section access denied.');
  let scopes: unknown, teaching: unknown, wheels: unknown;
  try { scopes = JSON.parse(String(user.sections)); teaching = JSON.parse(String(user.teaching)); wheels=user.wheelSections===undefined?DEFAULT_WHEEL_SECTIONS:JSON.parse(String(user.wheelSections)); } catch { throw new ConvexError('Invalid section scope.'); }
  if (!Array.isArray(scopes) || !scopes.includes(sectionId) || !Array.isArray(teaching) || !Array.isArray(wheels) || !wheels.includes(sectionId)) throw new ConvexError('Section access denied.');
  return { subject: user.subject, teaching: user.role === 'admin' || teaching.includes(sectionId) };
}
export const view = query({ args: { sectionId: v.string() }, handler: async (ctx, { sectionId }) => {
  const user = await authorize(ctx, sectionId);
  const room = await ctx.db.query('classroom').withIndex('room', q => q.eq('sectionId', sectionId)).unique();
  const enabled=room?.wheelEnabled!==false;
  const rows = enabled ? (await ctx.db.query('spotlight').withIndex('room', q => q.eq('sectionId', sectionId)).take(5)).filter(row => row.epoch === room?.epoch) : [];
  // Learner subscriptions never depend on heartbeats or fetch the whole presence table.
  const counts = user.teaching ? await ctx.db.query('counts').withIndex('room', q => q.eq('sectionId', sectionId)).unique() : null;
  const active = new Set(counts?.subjects || []);
  const draws = rows.flatMap(row=>{
    if(Math.max(row.createdAt + 120_000, spotlightFinishedAt(row) + 10_000)<=Date.now())return [];
    const selected=(row.targets||[{subject:row.subject,username:row.username}]).filter(target=>room?.members.some(member=>member.subject===target.subject));
    if(user.teaching)return selected.length?[{...result(row),targets:selected}]:[];
    const self=selected.find(target=>target.subject===user.subject);
    return self?[{requestId:row.requestId,slide:row.slide,...self,createdAt:row.createdAt,revealAt:spotlightRevealAt(row,(row.targets || [self]).findIndex(target=>target.subject===self.subject))}]:[];
  });
  return { ready: Boolean(room)&&enabled, enabled, count:room?.wheelCount ?? (sectionId===ASSIGNMENT_WHEEL_SECTION_ID?7:1), teaching: user.teaching, viewerSubject: user.subject, epoch: room?.epoch || '',
    revision: (room?.version || 0) + Math.max(0, ...rows.map(row => row.createdAt)), draws,
    members: user.teaching ? (room?.members || []).filter(member => active.has(member.subject)).map(member => ({ id: member.subject, username: member.username })) : [] };
} });
export const draw = mutation({ args: { sectionId: v.string(), slide: v.number(), requestId: v.string(), epoch: v.string() }, handler: async (ctx, args) => {
  const user = await authorize(ctx, args.sectionId);
  if (!user.teaching) throw new ConvexError('Teaching access required.');
  if (args.sectionId===ASSIGNMENT_WHEEL_SECTION_ID)throw new ConvexError('Use the assignment wheel for this section.');
  if (!(args.slide===0 || args.sectionId===MIS311_SPOTLIGHT_SECTION_ID&&spotlightSlide(args.slide)) || !/^[a-f0-9-]{36}$/i.test(args.requestId)) throw new ConvexError('Invalid draw settings.');
  const room = await ctx.db.query('classroom').withIndex('room', q => q.eq('sectionId', args.sectionId)).unique();
  if (!room || args.epoch !== room.epoch) return { code: 'STALE_CLASSROOM', message: 'The section session changed. Reopen the slide.' };
  if(room.wheelEnabled===false)throw new ConvexError('Class Spotlight is disabled for this section.');
  const now = Date.now();
  const replay = await ctx.db.query('spotlightRequests').withIndex('request', q => q.eq('sectionId', args.sectionId).eq('requestId', args.requestId)).unique();
  if (replay && replay.epoch === room.epoch && replay.expiresAt > now) {
    if (replay.slide !== args.slide) throw new ConvexError('Invalid draw settings.');
    return { ...result(replay), members: [] };
  }
  const rows = await ctx.db.query('spotlight').withIndex('room', q => q.eq('sectionId', args.sectionId)).take(5);
  const previous = rows.find(row => row.slide === args.slide);
  const key = `spotlight:${args.sectionId}:${user.subject}`;
  const rate = await ctx.db.query('limits').withIndex('person', q => q.eq('subject', key)).unique();
  if (rate && rate.blockedUntil > now) return { retryAfter: Math.ceil((rate.blockedUntil - now) / 1000) };
  const count = !rate || now - rate.start >= 60_000 ? 1 : rate.count + 1;
  const limit = { count, start: count === 1 ? now : rate!.start, blockedUntil: count > 10 ? now + 60_000 : 0 };
  if (rate) await ctx.db.patch(rate._id, limit); else await ctx.db.insert('limits', { subject: key, ...limit });
  if (limit.blockedUntil) return { retryAfter: 60 };
  // Returning business errors retains the limiter write even for busy/empty rooms.
  if (rows.some(row => row.epoch === room.epoch && spotlightFinishedAt(row) > now)) return { code: 'DRAW_BUSY', message: 'A draw is already spinning. Please wait for the result.' };
  const presence = await ctx.db.query('presence').withIndex('room', q => q.eq('sectionId', args.sectionId)).take(1201);
  const active = new Set(presence.filter(row => row.expiresAt > now).map(row => row.subject));
  const members = [...new Map(room.members.filter(member => active.has(member.subject)).map(member => [member.subject, member])).values()];
  if (!members.length) return { code: 'NO_LEARNERS', message: 'Waiting for signed-in learners to open this section.' };
  const preferred=room.wheelTargets||[];
  if(preferred.some(id=>!members.some(member=>member.subject===id)))return {code:'TARGET_UNAVAILABLE',message:'A selected learner is no longer eligible. Update the target names in settings.'};
  const pool=preferred.length?preferred.map(id=>members.find(member=>member.subject===id)!):[...members],targets=[];
  const take=preferred.length||Math.min(room.wheelCount||1,members.length);
  while(targets.length<take)targets.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  const winner=targets[0],index=members.findIndex(member=>member.subject===winner.subject);
  const selected = { sectionId: args.sectionId, slide: args.slide, epoch: room.epoch, requestId: args.requestId,
    subject: winner.subject, username: winner.username, targets, createdAt: now, revealAt: now + SPOTLIGHT_SPIN_MS };
  if (previous) await ctx.db.patch(previous._id, selected); else await ctx.db.insert('spotlight', selected);
  // Keep retry records off the live rows read by every learner, and expire them.
  if (replay) await ctx.db.delete(replay._id);
  const retention = Math.max(120_000, spotlightFinishedAt(selected) - now + 10_000);
  const id = await ctx.db.insert('spotlightRequests', { ...selected, expiresAt: now + retention });
  await ctx.scheduler.runAfter(retention, makeFunctionReference<'mutation'>('spotlight:expireRequest'), { id });
  // The animation needs at most twelve labels, not another roster query.
  const start = Math.max(0, index - 5);
  return { ...result(selected), members: members.slice(start, start + 12).map(member => ({ id: member.subject, username: member.username })) };
} });
export const configure = mutation({args:{sectionId:v.string(),epoch:v.string(),count:v.number(),targetSubjects:v.optional(v.array(v.string()))},handler:async(ctx,args)=>{
  const user=await authorize(ctx,args.sectionId);if(!user.teaching)throw new ConvexError('Teaching access required.');
  if(!validWheelCount(args.count))throw new ConvexError('Choose a positive whole number of learners.');
  const room=await ctx.db.query('classroom').withIndex('room',q=>q.eq('sectionId',args.sectionId)).unique();
  if(!room||room.epoch!==args.epoch)return {code:'STALE_CLASSROOM',message:'The section session changed.'};
  if(room.wheelEnabled===false)throw new ConvexError('Class Spotlight is disabled for this section.');
  const key=`spotlight-config:${args.sectionId}:${user.subject}`,now=Date.now();
  const limit=await ctx.db.query('limits').withIndex('person',q=>q.eq('subject',key)).unique();
  if(limit&&now-limit.start<2000)return {retryAfter:2};
  if(limit)await ctx.db.patch(limit._id,{start:now,count:1,blockedUntil:0});else await ctx.db.insert('limits',{subject:key,start:now,count:1,blockedUntil:0});
  if(args.sectionId===ASSIGNMENT_WHEEL_SECTION_ID&&room.draw)return {message:'Reset the assignment draw before changing the group size.'};
  const active=await ctx.db.query('spotlight').withIndex('room',q=>q.eq('sectionId',args.sectionId)).take(5);
  if(active.some(row=>row.epoch===room.epoch&&spotlightFinishedAt(row)>Date.now()))return {message:'Wait for the current spin to finish.'};
  const targets=args.targetSubjects||[];
  if(targets.length>1200||new Set(targets).size!==targets.length||targets.some(id=>!room.members.some(member=>member.subject===id)))throw new ConvexError('Choose existing learner names.');
  if(targets.length){const presence=await ctx.db.query('presence').withIndex('room',q=>q.eq('sectionId',args.sectionId)).take(1201);const active=new Set(presence.filter(row=>row.expiresAt>Date.now()).map(row=>row.subject));if(args.sectionId!==ASSIGNMENT_WHEEL_SECTION_ID&&targets.some(id=>!active.has(id)))return {message:'A selected learner is no longer online. Refresh the names.'};}
  const wheelCount=targets.length||args.count;await ctx.db.patch(room._id,{wheelCount,wheelTargets:targets});return {count:wheelCount};
}});
export const settings=query({args:{sectionId:v.string()},handler:async(ctx,{sectionId})=>{
  const user=await authorize(ctx,sectionId);if(!user.teaching)throw new ConvexError('Teaching access required.');
  const room=await ctx.db.query('classroom').withIndex('room',q=>q.eq('sectionId',sectionId)).unique();
  if(room?.wheelEnabled===false)throw new ConvexError('Class Spotlight is disabled for this section.');
  return {count:room?.wheelCount??(sectionId===ASSIGNMENT_WHEEL_SECTION_ID?7:1),targetSubjects:room?.wheelTargets||[]};
}});
export const expireRequest = internalMutation({ args: { id: v.id('spotlightRequests') }, handler: async (ctx, { id }) => {
  const request = await ctx.db.get(id);
  if (request && request.expiresAt <= Date.now()) await ctx.db.delete(id);
} });
