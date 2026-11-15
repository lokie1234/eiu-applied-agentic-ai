"use client";

import { useEffect, type RefObject } from 'react';
import { MIS311_MODELLING_SECTION_ID, resetMis311Presentation, saveMis311PresentationState } from '@/lib/mis311Presentation';

export function useMis311PresentationBridge(sectionId: string, frame: RefObject<HTMLIFrameElement | null>) {
  useEffect(() => {
    if (sectionId !== MIS311_MODELLING_SECTION_ID) return;
    let ended = false;
    const receive = (event: MessageEvent) => {
      const target = frame.current, message = event.data;
      if (ended || !target || event.source !== target.contentWindow || !message ||
          message.type !== 'eiu-presentation-state' || message.requestId !== target.dataset.requestId) return;
      const match = /^b7bd6b13-c654-412b-badb-12853350e148:(2|3|5|6)$/.exec(message.requestId);
      if (match && Number.isInteger(message.page)) saveMis311PresentationState(sectionId, Number(match[1]), message.page, message.state);
    };
    const endFrame = () => {
      if (ended) return;
      ended = true;
      const target = frame.current;
      target?.contentWindow?.postMessage({ type: 'eiu-section-terminated', requestId: target.dataset.requestId }, '*');
    };
    const terminate = (event: Event) => {
      if ((event as CustomEvent<{ sectionId?: string }>).detail?.sectionId !== sectionId) return;
      endFrame();
      resetMis311Presentation();
    };
    window.addEventListener('message', receive);
    window.addEventListener('eiu-section-terminated', terminate);
    window.addEventListener('eiu-mis311-presentation-reset', endFrame);
    return () => {
      ended = true;
      window.removeEventListener('message', receive);
      window.removeEventListener('eiu-section-terminated', terminate);
      window.removeEventListener('eiu-mis311-presentation-reset', endFrame);
      resetMis311Presentation();
    };
  }, [sectionId, frame]);
}
