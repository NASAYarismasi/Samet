import test from 'node:test';
import assert from 'node:assert/strict';
import { beginGame, registerGameStart } from '../game-bridge.js';

test('appearance handoff is saved, emitted, isolated and recoverable', async () => {
  const values = new Map();
  globalThis.localStorage = { setItem: (key, value) => values.set(key, value) };
  globalThis.window = new EventTarget();
  const host = { hidden: true, replaceChildren() { this.cleared = true; } };
  globalThis.document = { getElementById: () => host };
  let event;
  window.addEventListener('mars:new-game', e => { event = e.detail; });
  const settings = { master: 70, ambient: 50, effects: 65, resolution: 'native' };
  const fallback = await beginGame('astronaut-2', settings);
  assert.equal(fallback.connected, false);
  assert.equal(event.player.appearanceId, 'astronaut-2');
  assert.equal(JSON.parse(values.get('mars-new-game')).player.appearanceId, 'astronaut-2');

  const unregister = registerGameStart((session, mount) => {
    assert.equal(mount, host);
    assert.equal(mount.hidden, false);
    session.player.appearanceId = 'mutated';
    session.settings.master = 0;
  });
  const connected = await beginGame('astronaut-3', settings);
  assert.equal(connected.connected, true);
  assert.equal(connected.session.player.appearanceId, 'astronaut-3');
  assert.equal(settings.master, 70);
  unregister();

  const unregisterFailure = registerGameStart(() => { throw new Error('Scene failed'); });
  await assert.rejects(beginGame('astronaut-1', settings), /Scene failed/);
  assert.equal(host.hidden, true);
  assert.equal(host.cleared, true);
  unregisterFailure();
  await assert.rejects(beginGame('unknown', settings), /Invalid astronaut/);
  localStorage.setItem = () => { throw new Error('Storage disabled'); };
  assert.equal((await beginGame('astronaut-1', settings)).connected, false);
});
