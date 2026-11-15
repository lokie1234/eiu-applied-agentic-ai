import { query, mutation } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import type { QueryCtx, MutationCtx } from './_generated/server';

async function authorize(ctx: QueryCtx | MutationCtx, sectionId: string, enabled = true) {
  const user = await ctx.auth.getUserIdentity();
  let sections: unknown = [];
  try { sections = JSON.parse(String(user?.sections)); } catch { /* Invalid claims deny access. */ }
  if (!user || user.role !== 'admin' || !Array.isArray(sections) || !sections.includes(sectionId)) throw new ConvexError('Administrator section access required.');
  if(enabled && user.liveSections !== undefined){let live:unknown;try{live=JSON.parse(String(user.liveSections));}catch{/* Invalid claims deny access. */}if(!Array.isArray(live)||!live.includes(sectionId))throw new ConvexError('Live is disabled for this section.');}
  return user;
}
const device = (value: string) => { if (!/^[a-zA-Z0-9-]{16,100}$/.test(value)) throw new ConvexError('Invalid device.'); };
// Retired compatibility endpoints. Never read or write the former large snapshots.
// Existing tabs fall back to Supabase; a reload uses the private Broadcast client.
const migrated = () => { throw new ConvexError('Live moved to Supabase. Reload this page.'); };
export const view = query({args:{sectionId:v.string()},handler:async(ctx,{sectionId})=>{await authorize(ctx,sectionId);return null;}});
export const snapshot = query({args:{sectionId:v.string()},handler:async(ctx,{sectionId})=>{await authorize(ctx,sectionId);return null;}});
export const peers = query({args:{sectionId:v.string()},handler:async(ctx,{sectionId})=>{await authorize(ctx,sectionId);return null;}});
export const start = mutation({args:{sectionId:v.string(),deviceId:v.string(),epoch:v.string()},handler:async(ctx,args)=>{await authorize(ctx,args.sectionId);device(args.deviceId);device(args.epoch);return migrated();}});
export const update = mutation({args:{sectionId:v.string(),deviceId:v.string(),epoch:v.string(),sequence:v.number(),patch:v.string()},handler:async(ctx,args)=>{await authorize(ctx,args.sectionId);return migrated();}});
export const signal = mutation({args:{sectionId:v.string(),epoch:v.string(),peerId:v.string(),deviceId:v.string(),kind:v.union(v.literal('offer'),v.literal('answer'),v.literal('leave')),sdp:v.optional(v.string())},handler:async(ctx,args)=>{await authorize(ctx,args.sectionId);return migrated();}});
export const stop = mutation({args:{sectionId:v.string(),deviceId:v.string(),epoch:v.string()},handler:async(ctx,args)=>{await authorize(ctx,args.sectionId,false);return {success:true};}});
