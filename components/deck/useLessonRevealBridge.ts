"use client";

import { useLayoutEffect, type RefObject } from 'react';
import { getRevealSession, saveRevealState, syncRevealTermination, MIS311_RCA_SECTION_ID } from '@/lib/lessonRevealState';

export function useLessonRevealBridge(sectionId: string, frame: RefObject<HTMLIFrameElement | null>) {
  useLayoutEffect(() => {
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
