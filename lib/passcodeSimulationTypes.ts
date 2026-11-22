export type PasscodeSimulation = {
  credentialId:string;
  label:string;
  mode:'learner'|'facilitator';
  sections:Array<{id:string;canFacilitate:boolean}>;
};
export type SimulationCredential = {
  id:string;code:string;kind:'global'|'folder'|'course'|'section';label:string;
  mode:'learner'|'facilitator';available:boolean;courseCount:number;sectionCount:number;
};
