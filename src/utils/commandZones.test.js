import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_ZONES, getAvailableCommandZones } from './commandZones.js';

test('command hub exposes eight planned zones', () => {
  assert.equal(COMMAND_ZONES.length, 8);
});

test('admin tools are excluded from learner navigation', () => {
  assert.equal(getAvailableCommandZones(false).some(zone => zone.id === 'game-master'), false);
  assert.equal(getAvailableCommandZones(true).some(zone => zone.id === 'game-master'), true);
});

test('every command zone maps to an existing app route', () => {
  assert.deepEqual(
    COMMAND_ZONES.map(zone => zone.route),
    ['/dashboard', '/modules', '/circuit', '/lab', '/contests', '/mentor', '/achievements', '/admin'],
  );
});
