// Shared defaults preserve the two existing classroom wheels during migration.
export const ASSIGNMENT_WHEEL_SECTION_ID = '71c4d32e-7d80-4ae6-9576-13a0840ccd45';
export const DEFAULT_WHEEL_SECTIONS = [ASSIGNMENT_WHEEL_SECTION_ID, '2cbb9354-a267-4103-9d14-99662d0e6bb1'];
export function sectionWheelEnabled(sectionId: string, settings?: Record<string, boolean>) {
  return typeof settings?.[sectionId] === 'boolean' ? settings[sectionId] : DEFAULT_WHEEL_SECTIONS.includes(sectionId);
}
export const validWheelCount = (value:unknown):value is number => typeof value==='number' && Number.isSafeInteger(value) && value>=1;
export const wheelLegacySection=(courseSlug:string|undefined,sectionKey:string|undefined)=>courseSlug==='applied-agentic-ai'&&['section1','section2'].includes(sectionKey||'')?sectionKey:undefined;
