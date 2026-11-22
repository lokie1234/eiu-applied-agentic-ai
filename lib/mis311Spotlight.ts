export const MIS311_SPOTLIGHT_COURSE_ID = '86cae0a3-9ada-4e31-b4d4-c83f50cafaf6';
export const MIS311_SPOTLIGHT_SECTION_ID = '2cbb9354-a267-4103-9d14-99662d0e6bb1';
export const MIS311_SPOTLIGHT_SLIDES = [5, 7, 8, 10] as const;
export const SPOTLIGHT_SPIN_MS = 1667;
export const SPOTLIGHT_PAUSE_MS = 200;
// revealAt is the first name's deadline; every client uses the same schedule.
export function spotlightRevealAt(draw: Pick<SpotlightDraw, 'revealAt'>, index = 0) {
  return draw.revealAt + index * (SPOTLIGHT_SPIN_MS + SPOTLIGHT_PAUSE_MS);
}
export function spotlightFinishedAt(draw: Pick<SpotlightDraw, 'revealAt' | 'targets'>) {
  return spotlightRevealAt(draw, Math.max(0, (draw.targets?.length || 1) - 1));
}
export function spotlightSlide(value: unknown): value is number {
  return value===0 || typeof value === 'number' && (MIS311_SPOTLIGHT_SLIDES as readonly number[]).includes(value);
}
export type SpotlightDraw = { requestId: string; slide: number; subject: string; username: string; targets?:Array<{subject:string;username:string}>; createdAt: number; revealAt: number };
export type SpotlightView = { ready: boolean; teaching: boolean; epoch: string; viewerSubject: string;
  revision?: number; enabled?:boolean; count?:number; members: Array<{ id: string; username: string }>; draws: SpotlightDraw[] };
