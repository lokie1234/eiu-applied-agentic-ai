'use client';
import { createContext, type RefObject } from 'react';
export type SectionWheelScope={sectionId:string;enabled:boolean;teaching:boolean;practice?:{code:string;templateKey?:string;background:string;frame:RefObject<HTMLIFrameElement|null>;assignmentKey:string}};
export const SectionWheelContext=createContext<SectionWheelScope|null>(null);
