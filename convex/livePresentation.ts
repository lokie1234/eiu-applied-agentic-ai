import { query, mutation } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import type { QueryCtx, MutationCtx } from './_generated/server';
import { applyLivePatch } from '../lib/livePresentationProtocol';

async function authorize(ctx: QueryCtx | MutationCtx, sectionId: string, enabled = true) {
  const user = await ctx.auth.getUserIdentity();
  let sections: unknown = [];
  try { sections = JSON.parse(String(user?.sections)); } catch { /* Invalid claims deny access. */ }
  if (!user || user.role !== 'admin' || !Array.isArray(sections) || !sections.includes(sectionId)) throw new ConvexError('Administrator section access required.');
  if(enabled && user.liveSections !== undefined){let live:unknown;try{live=JSON.parse(String(user.liveSections));}catch{/* Invalid claims deny access. */}if(!Array.isArray(live)||!live.includes(sectionId))throw new ConvexError('Live is disabled for this section.');}
  return user;
}
const device = (value: string) => { if (!/^[a-zA-Z0-9-]{16,100}$/.test(value)) throw new ConvexError('Invalid device.'); };
export const view = query({ args: { sectionId: v.string() }, handler: async (ctx, { sectionId }) => {
  await authorize(ctx, sectionId);
  const room = await ctx.db.query('livePresentations').withIndex('room', q => q.eq('sectionId', sectionId)).unique();
  return room ? { active: room.active && Date.now() - room.updatedAt < 86400000, owner: room.owner, epoch: room.epoch, revision: room.revision, sequence:room.sequence, patch: room.patch, updatedAt: room.updatedAt } : null;
} });
export const snapshot = query({ args: { sectionId: v.string() }, handler: async (ctx, { sectionId }) => {
  await authorize(ctx, sectionId);
  const room = await ctx.db.query('livePresentations').withIndex('room', q => q.eq('sectionId', sectionId)).unique();
  const snapshot = await ctx.db.query('liveSnapshots').withIndex('room', q => q.eq('sectionId', sectionId)).unique();
  return room?.active ? { epoch: room.epoch, revision: room.revision, sequence:room.sequence, updatedAt:room.updatedAt, document: snapshot?.document || '' } : null;
} });
export const start = mutation({ args: { sectionId: v.string(), deviceId: v.string(), epoch: v.string() }, handler: async (ctx, args) => {
  await authorize(ctx, args.sectionId); device(args.deviceId); device(args.epoch);
  const room = await ctx.db.query('livePresentations').withIndex('room', q => q.eq('sectionId', args.sectionId)).unique(), now = Date.now();
  if(room?.active&&room.owner===args.deviceId&&room.epoch===args.epoch)return {epoch:args.epoch,sequence:room.sequence};
  if (room?.active && room.owner !== args.deviceId && now - room.updatedAt < 30000) throw new ConvexError('Another device is controlling this section. Stop Live there first.');
  const rateCount = room && now-room.rateStart<1000 ? room.rateCount+1 : 1;
  if(rateCount>25)throw new ConvexError('Please wait before starting Live again.');
  const value = { sectionId: args.sectionId, owner: args.deviceId, epoch: args.epoch, active: true, revision: 0, sequence: 0, updatedAt: now, patch: '', rateStart: rateCount===1?now:room!.rateStart, rateCount };
  const snapshot = await ctx.db.query('liveSnapshots').withIndex('room', q => q.eq('sectionId', args.sectionId)).unique();
  if(snapshot) await ctx.db.delete(snapshot._id);
  if (room) await ctx.db.replace(room._id, value); else await ctx.db.insert('livePresentations', value);
  return { epoch: args.epoch, sequence:0 };
} });
export const update = mutation({ args: { sectionId: v.string(), deviceId: v.string(), epoch: v.string(), sequence: v.number(), patch: v.string() }, handler: async (ctx, args) => {
  await authorize(ctx, args.sectionId);device(args.deviceId);
  const room = await ctx.db.query('livePresentations').withIndex('room', q => q.eq('sectionId', args.sectionId)).unique();
  if (!room?.active || room.owner !== args.deviceId || room.epoch !== args.epoch) throw new ConvexError('This device no longer controls Live.');
  if (!Number.isSafeInteger(args.sequence) || args.sequence <= room.sequence) return { revision: room.revision };
  const now = Date.now(), count = now - room.rateStart >= 1000 ? 1 : room.rateCount + 1;
  if (count > 25) throw new ConvexError('Live update limit reached.');
  let snapshot: string;
  const stored = args.patch ? await ctx.db.query('liveSnapshots').withIndex('room', q => q.eq('sectionId', args.sectionId)).unique() : null;
  try { snapshot = args.patch ? applyLivePatch(stored?.document || '', args.patch) : ''; } catch { throw new ConvexError('Invalid or oversized Live slide.'); }
  const revision = room.revision + (args.patch ? 1 : 0);
  if(args.patch) { if(stored)await ctx.db.patch(stored._id,{document:snapshot});else await ctx.db.insert('liveSnapshots',{sectionId:args.sectionId,document:snapshot}); }
  await ctx.db.patch(room._id, { patch: args.patch || room.patch, revision, sequence: args.sequence, updatedAt: now, rateStart: count === 1 ? now : room.rateStart, rateCount: count });
  return { revision };
} });
export const stop = mutation({ args: { sectionId: v.string(), deviceId: v.string(), epoch: v.string() }, handler: async (ctx, args) => {
  await authorize(ctx, args.sectionId, false);device(args.deviceId);
  const room = await ctx.db.query('livePresentations').withIndex('room', q => q.eq('sectionId', args.sectionId)).unique();
  if (room?.owner === args.deviceId && room.epoch === args.epoch) {
    await ctx.db.patch(room._id, { active: false, patch: '', peers:[], updatedAt: Date.now() });
    const snapshot=await ctx.db.query('liveSnapshots').withIndex('room', q=>q.eq('sectionId',args.sectionId)).unique();if(snapshot)await ctx.db.delete(snapshot._id);
  }
  return { success: true };
} });
export const peers = query({args:{sectionId:v.string()},handler:async(ctx,{sectionId})=>{
  await authorize(ctx,sectionId);const room=await ctx.db.query('livePresentations').withIndex('room',q=>q.eq('sectionId',sectionId)).unique();
  return room?.active?{owner:room.owner,epoch:room.epoch,peers:room.peers||[]}:null;
}});
export const signal = mutation({args:{sectionId:v.string(),epoch:v.string(),peerId:v.string(),deviceId:v.string(),kind:v.union(v.literal('offer'),v.literal('answer'),v.literal('leave')),sdp:v.optional(v.string())},handler:async(ctx,args)=>{
  await authorize(ctx,args.sectionId);device(args.peerId);device(args.deviceId);
  const room=await ctx.db.query('livePresentations').withIndex('room',q=>q.eq('sectionId',args.sectionId)).unique();
  if(!room?.active||room.epoch!==args.epoch)throw new ConvexError('Live session ended.');
  if(args.kind==='answer'&&room.owner!==args.deviceId)throw new ConvexError('Controller required.');
  if(args.sdp&&args.sdp.length>20000)throw new ConvexError('Invalid peer description.');
  const peers=room.peers||[],old=peers.find(peer=>peer.id===args.peerId),now=Date.now();
  const rateCount=now-room.rateStart>=1000?1:room.rateCount+1;
  if(rateCount>25)throw new ConvexError('Live signaling rate limit reached.');
  if(old&&now-old.updatedAt<100&&args.kind==='offer')throw new ConvexError('Peer signaling limit reached.');
  if(args.kind==='leave'){await ctx.db.patch(room._id,{peers:peers.filter(peer=>peer.id!==args.peerId),rateCount,rateStart:rateCount===1?now:room.rateStart});return;}
  if(args.kind==='answer'){if(!old)throw new ConvexError('Peer not found.');old.answer=args.sdp||'';old.updatedAt=now;}
  else if(old){old.offer=args.sdp||'';delete old.answer;old.updatedAt=now;}
  else{if(peers.length>=4)throw new ConvexError('Live supports up to four following devices.');peers.push({id:args.peerId,offer:args.sdp||'',updatedAt:now});}
  await ctx.db.patch(room._id,{peers,rateCount,rateStart:rateCount===1?now:room.rateStart});
}});
