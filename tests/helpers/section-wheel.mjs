import React from 'react';
import {loadTS,practice} from './mis301-fixture.mjs';
export const sectionWheelTest=loadTS('lib/sectionWheel.ts');
export const sectionWheelTestContext={SectionWheelContext:React.createContext(null)};

// Keep ad-hoc VM loaders on one shared context and the real scope helpers.
export function sectionWheelDependency(name) {
  if (name === '@/lib/sectionWheel') return sectionWheelTest;
  if (name === './SectionWheelContext' || name === '@/components/deck/SectionWheelContext') return sectionWheelTestContext;
}

// Non-MIS-301 fixtures do not open the assignment classroom or notebook.
// Individual tests can override any entry when exercising those bridges.
export const inactiveLessonDependencies = {
  '@/lib/realtime/classroom': { syncClassroomEntry: async () => {}, notifyClassroom() {} },
  '@/lib/mis301Practice': practice,
  '@/lib/mis311Spotlight': loadTS('lib/mis311Spotlight.ts'),
  '@/lib/lessonRevealState': loadTS('lib/lessonRevealState.ts'),
  '@/lib/mis311Presentation': loadTS('lib/mis311Presentation.ts'),
  '@/lib/livePresentationDom': loadTS('lib/livePresentationDom.ts'),
  './useLessonRevealBridge': { useLessonRevealBridge() {} },
  './useMis311PresentationBridge': { useMis311PresentationBridge() {} },
  '@/components/deck/useMis301NotebookBridge': { clearMis301Notebook() {} },
  './useMis301NotebookBridge': { useMis301NotebookBridge() {} },
  './useLessonPracticeBridge': { useLessonPracticeBridge: () => null },
};
