import test from 'node:test';
import assert from 'node:assert/strict';
import { COSMETIC_FRAMES, COSMETIC_TITLES } from './cosmetics.js';

test('cosmetics catalog defines default frame and title available to all users', () => {
  const defaultFrame = COSMETIC_FRAMES.find(f => f.id === 'frame-default');
  assert.ok(defaultFrame);
  assert.strictEqual(defaultFrame.isUnlocked(0, 1), true);

  const defaultTitle = COSMETIC_TITLES.find(t => t.id === 'title-initiate');
  assert.ok(defaultTitle);
  assert.strictEqual(defaultTitle.isUnlocked(0, 1), true);
});

test('cosmetics unlock conditions require level or XP milestones', () => {
  const cyanFrame = COSMETIC_FRAMES.find(f => f.id === 'frame-cyan');
  assert.strictEqual(cyanFrame.isUnlocked(0, 1), false);
  assert.strictEqual(cyanFrame.isUnlocked(100, 1), true);
  assert.strictEqual(cyanFrame.isUnlocked(0, 2), true);

  const goldFrame = COSMETIC_FRAMES.find(f => f.id === 'frame-gold');
  assert.strictEqual(goldFrame.isUnlocked(50, 2), false);
  assert.strictEqual(goldFrame.isUnlocked(300, 2), true);
  assert.strictEqual(goldFrame.isUnlocked(0, 4), true);

  const voidFrame = COSMETIC_FRAMES.find(f => f.id === 'frame-void');
  assert.strictEqual(voidFrame.isUnlocked(200, 3), false);
  assert.strictEqual(voidFrame.isUnlocked(500, 4), true);
});

test('cosmetics titles unlock upon mission completion evidence', () => {
  const superpositionTitle = COSMETIC_TITLES.find(t => t.id === 'title-superposition');
  assert.strictEqual(superpositionTitle.isUnlocked(0, 1, []), false);
  assert.strictEqual(superpositionTitle.isUnlocked(0, 1, [{ id: 'build-superposition', status: 'completed' }]), true);

  const entanglementTitle = COSMETIC_TITLES.find(t => t.id === 'title-entanglement');
  assert.strictEqual(entanglementTitle.isUnlocked(0, 1, []), false);
  assert.strictEqual(entanglementTitle.isUnlocked(0, 1, [{ id: 'build-bell-state', status: 'completed' }]), true);
});
