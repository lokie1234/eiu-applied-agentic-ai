"use client";

import { useLayoutEffect, type RefObject } from 'react';
import { getRevealSession, saveRevealState, syncRevealTermination, resetLessonRevealState, MIS311_RCA_SECTION_ID, MANAGER_SECTION_ID } from '@/lib/lessonRevealState';

export function useLessonRevealBridge(sectionId: string, frame: RefObject<HTMLIFrameElement | null>) {
  useLayoutEffect(() => {
    if (sectionId === MANAGER_SECTION_ID) {
      // Reuse the existing presentation store; no identity/results or server writes.
      resetLessonRevealState(sectionId);
      let ended = false;
      const receive = (event: MessageEvent) => {
        const target = frame.current, message = event.data;
        if (ended || !target || event.source !== target.contentWindow || !message ||
            message.type !== 'eiu-orientation-load' || message.requestId !== target.dataset.requestId ||
            message.requestId !== `${sectionId}:3`) return;
        const session = getRevealSession(sectionId), play = session.state.orientationPlayed !== true;
        // Claim at first display so interrupted or recreated slides never replay.
        saveRevealState(sectionId, session.epoch, { ...session.state, orientationPlayed: true });
        target.contentWindow?.postMessage({ type: 'eiu-orientation-state', requestId: message.requestId, play }, '*');
      };
      const terminate = (event: Event) => {
        if ((event as CustomEvent<{ sectionId?: string }>).detail?.sectionId !== sectionId) return;
        ended = true;
        frame.current?.contentWindow?.postMessage({ type: 'eiu-section-terminated', requestId: frame.current.dataset.requestId }, '*');
        resetLessonRevealState(sectionId);
      };
      window.addEventListener('message', receive);
      window.addEventListener('eiu-section-terminated', terminate);
      return () => { ended = true; window.removeEventListener('message', receive); window.removeEventListener('eiu-section-terminated', terminate); resetLessonRevealState(sectionId); };
    }
    if (sectionId !== MIS311_RCA_SECTION_ID) return;
    let ended = false;
    const controller = new AbortController();
    const initialized = fetch(`/api/sections/${encodeURIComponent(sectionId)}/control`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      .then(async response => {
        if (!response.ok) return;
        const value = await response.json();
        if (!ended && !controller.signal.aborted && value.success && value.enabled !== false && (value.terminationToken == null || typeof value.terminationToken === 'string')) {
          syncRevealTermination(sectionId, value.terminationToken ?? null);
        }
      }).catch(() => { /* Navigation state remains available offline. */ });
    const receive = (event: MessageEvent) => {
      const target = frame.current;
      const message = event.data;
      if (ended || !target || event.source !== target.contentWindow || !message
        || message.requestId !== target.dataset.requestId || message.requestId !== `${sectionId}:2`) return;
      if (message.type === 'eiu-reveal-load') {
        void initialized.then(() => {
          if (ended || frame.current !== target || target.dataset.requestId !== message.requestId || controller.signal.aborted) return;
          const session = getRevealSession(sectionId);
          target.contentWindow?.postMessage({ type: 'eiu-reveal-state', requestId: message.requestId, epoch: session.epoch, state: session.state }, '*');
        });
      } else if (message.type === 'eiu-reveal-save' && typeof message.epoch === 'string') {
        saveRevealState(sectionId, message.epoch, message.state);
      }
    };
    const terminate = (event: Event) => {
      if ((event as CustomEvent<{ sectionId?: string }>).detail?.sectionId !== sectionId) return;
      ended = true;
      controller.abort();
      const target = frame.current;
      target?.contentWindow?.postMessage({ type: 'eiu-section-terminated', requestId: target.dataset.requestId }, '*');
    };
    window.addEventListener('message', receive);
    window.addEventListener('eiu-section-terminated', terminate);
    return () => { controller.abort(); window.removeEventListener('message', receive); window.removeEventListener('eiu-section-terminated', terminate); };
  }, [sectionId, frame]);
}
