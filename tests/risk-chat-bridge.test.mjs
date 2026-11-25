import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { loadTS } from './helpers/mis301-fixture.mjs';

test('chat progress survives iframe navigation and resets only with the section deck', () => {
  const window = new Window({ url: 'https://lesson.test' });
  let cleanup;
  let serial = 0;
  const bridge = loadTS('components/deck/useRiskChatBridge.ts', {
    react: { useLayoutEffect: effect => { cleanup = effect(); } },
  }, { window, crypto: { randomUUID: () => `epoch-${++serial}` } });
  const sectionId = '961a0a16-0dc0-486e-a501-d965a3f3c7ce';
  const requestId = `${sectionId}:2`;
  const responses = [];
  const makeFrame = () => ({ dataset: { requestId }, contentWindow: { postMessage: message => responses.push(structuredClone(message)) } });
  const frame = { current: makeFrame() };
  const emit = (data, source = frame.current.contentWindow) => window.dispatchEvent(new window.MessageEvent('message', { data, source }));
  const load = () => { emit({ type: 'eiu-risk-chat-load', requestId }); return responses.at(-1); };
  const save = (count, epoch) => emit({ type: 'eiu-risk-chat-save', requestId, count, epoch });
  try {
    bridge.useRiskChatBridge(sectionId, frame);
    const first = load();
    assert.equal(first.count, 0);
    save(3, first.epoch);
    const reopened = load();
    assert.equal(reopened.count, 3);
    save(4, first.epoch); // A superseded popup cannot write.
    save(5, reopened.epoch);
    save(1, reopened.epoch);
    save(3.5, reopened.epoch);
    assert.equal(load().count, 3);
    frame.current.dataset.requestId = `${sectionId}:3`;
    const responseCount = responses.length;
    load();
    assert.equal(responses.length, responseCount, 'other slides cannot read chat state');
    const oldWindow = frame.current.contentWindow;
    frame.current = makeFrame();
    emit({ type: 'eiu-risk-chat-load', requestId }, oldWindow);
    assert.equal(responses.length, responseCount, 'an old iframe cannot request state');
    const navigated = load();
    assert.equal(navigated.count, 3);
    save(4, navigated.epoch);
    assert.equal(load().count, 4);
    for (const exampleId of ['privacy', 'originality', 'reliance']) {
      emit({ type: 'eiu-risk-chat-load', requestId, exampleId });
      const scene = responses.at(-1);
      assert.equal(scene.count, 0);
      assert.equal(scene.exampleId, exampleId);
      emit({ type: 'eiu-risk-chat-save', requestId, exampleId, epoch: scene.epoch, count: 3 });
      emit({ type: 'eiu-risk-chat-save', requestId, exampleId, epoch: scene.epoch, count: 4 });
      emit({ type: 'eiu-risk-chat-load', requestId, exampleId });
      assert.equal(responses.at(-1).count, 3, 'each scene has its own bounded progress');
    }
    const validResponses = responses.length;
    emit({ type: 'eiu-risk-chat-load', requestId, exampleId: '__proto__' });
    emit({ type: 'eiu-risk-chat-load', requestId, exampleId: 'unregistered' });
    assert.equal(responses.length, validResponses);
    assert.equal(load().count, 4, 'visual stories do not change chat progress');
    cleanup();
    bridge.useRiskChatBridge(sectionId, frame);
    assert.equal(load().count, 0, 'leaving and reopening the section starts a new conversation');
    emit({ type: 'eiu-risk-chat-load', requestId, exampleId: 'privacy' });
    assert.equal(responses.at(-1).count, 0, 'section exit also resets the visual stories');
  } finally {
    cleanup?.();
    window.happyDOM.abort();
  }
});
