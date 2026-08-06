const test = require('node:test');
const assert = require('node:assert/strict');

const CombinedStatus = require('../dist/src/models/combined-status').default;

test('updateSlackStatus preserves active Teams override state', () => {
  const combinedStatus = new CombinedStatus('working', 'Working', '', '');
  combinedStatus.updateTeamsOverrideState(true);

  const nextStatus = combinedStatus.updateSlackStatus(
    { displayImageName: 'working', displayText: 'Working' },
    { emoji: ':speech_balloon:', text: 'Working', expiration: 0 },
    { emoji: ':speech_balloon:', text: 'Working', expiration: 0 },
    false
  );

  assert.equal(nextStatus.teamsOverride.isActive, true);
  assert.equal(nextStatus.teamsOverride.startedAt, combinedStatus.teamsOverride.startedAt);
  assert.equal(nextStatus.teamsOverride.lastHeartbeatAt, combinedStatus.teamsOverride.lastHeartbeatAt);
});
