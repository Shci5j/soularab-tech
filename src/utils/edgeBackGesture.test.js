import test from 'node:test';
import assert from 'node:assert/strict';
import { isEdgeBackSwipe } from './edgeBackGesture.js';

test('accepts a rightward swipe starting at the left edge', () => {
  assert.equal(isEdgeBackSwipe({ startX: 8, startY: 120, endX: 90, endY: 130, viewportWidth: 400 }), true);
});

test('accepts a leftward swipe starting at the right edge', () => {
  assert.equal(isEdgeBackSwipe({ startX: 392, startY: 120, endX: 300, endY: 125, viewportWidth: 400 }), true);
});

test('rejects a swipe that starts away from both edges', () => {
  assert.equal(isEdgeBackSwipe({ startX: 80, startY: 120, endX: 180, endY: 120, viewportWidth: 400 }), false);
});

test('rejects a swipe shorter than the minimum distance', () => {
  assert.equal(isEdgeBackSwipe({ startX: 8, startY: 120, endX: 55, endY: 120, viewportWidth: 400 }), false);
});

test('rejects predominantly vertical movement', () => {
  assert.equal(isEdgeBackSwipe({ startX: 8, startY: 20, endX: 100, endY: 140, viewportWidth: 400 }), false);
});

test('rejects invalid viewport dimensions', () => {
  assert.equal(isEdgeBackSwipe({ startX: 8, startY: 20, endX: 100, endY: 20, viewportWidth: 0 }), false);
});
