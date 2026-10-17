import assert from "node:assert/strict";
import test from "node:test";
import {
  CROWD_PEOPLE,
  ENTRANCE_DURATION,
  crowdProgress,
  crowdSpeed,
  sampleCrowdMotion,
} from "../src/components/BinaryCharacter/crowdMotion.ts";

const EPSILON = 1e-10;
const times = Array.from({ length: 1201 }, (_, i) => i * ENTRANCE_DURATION / 1200);
const person = (id: string) => {
  const found = CROWD_PEOPLE.find((entry) => entry.id === id);
  assert.ok(found, `Person ${id} must exist`);
  return found;
};

test("A–G appear once, with B/D in front and five independent background people", () => {
  assert.deepEqual(CROWD_PEOPLE.map(({ id }) => id).sort(), ["A", "B", "C", "D", "E", "F", "G"]);
  assert.deepEqual(CROWD_PEOPLE.filter(({ plane }) => plane === "front").map(({ id }) => id).sort(), ["B", "D"]);
  assert.deepEqual(CROWD_PEOPLE.filter(({ plane }) => plane === "back").map(({ id }) => id).sort(), ["A", "C", "E", "F", "G"]);
});

test("G stays separate above/left of D, with individual stride and shared rightward travel", () => {
  const g = person("G");
  const d = person("D");
  assert.ok(g.neck[0] < d.neck[0] && g.neck[1] < d.neck[1]);
  assert.notEqual(g.phase, d.phase);
  assert.notEqual(g.stride, d.stride);
  assert.ok(g.startX < 0 && d.startX < 0);
  assert.ok(person("B").startX > 0);
  for (const entry of [g, d]) {
    assert.ok(sampleCrowdMotion(1, entry).x > sampleCrowdMotion(0, entry).x);
  }
  assert.ok(sampleCrowdMotion(1, person("B")).x < sampleCrowdMotion(0, person("B")).x);
});

test("progress is finite, bounded, monotonic, and clamps out-of-range time", () => {
  let previous = 0;
  for (const t of [-Infinity, -1, ...times, ENTRANCE_DURATION + 10, Infinity]) {
    const value = crowdProgress(t);
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `Invalid progress at ${t}`);
    assert.ok(value + EPSILON >= previous, `Progress reversed at ${t}`);
    previous = value;
  }
  assert.equal(crowdProgress(NaN), 0);
  assert.equal(crowdProgress(0), 0);
  assert.equal(crowdProgress(ENTRANCE_DURATION), 1);
});

test("speed has one rise, a finite plateau, then one fall to rest", () => {
  const speeds = times.map(crowdSpeed);
  const peak = Math.max(...speeds);
  const firstPeak = speeds.findIndex((value) => Math.abs(value - peak) < EPSILON);
  const lastPeak = speeds.findLastIndex((value) => Math.abs(value - peak) < EPSILON);
  assert.ok(peak > 0 && peak <= 1);
  assert.ok(firstPeak > 0 && lastPeak > firstPeak && lastPeak < speeds.length - 1);
  for (let i = 1; i <= firstPeak; i++) assert.ok(speeds[i] + EPSILON >= speeds[i - 1]);
  for (let i = firstPeak; i <= lastPeak; i++) assert.ok(Math.abs(speeds[i] - peak) < EPSILON);
  for (let i = lastPeak + 1; i < speeds.length; i++) assert.ok(speeds[i] <= speeds[i - 1] + EPSILON);
  for (const t of [-Infinity, -1, 0, ENTRANCE_DURATION, Infinity, NaN]) assert.equal(crowdSpeed(t), 0);
});

test("every person starts displaced and lands exactly without lateral overshoot", () => {
  for (const entry of CROWD_PEOPLE) {
    assert.ok(Math.hypot(entry.startX, entry.startY) >= 10, `${entry.id} needs meaningful travel`);
    const initial = sampleCrowdMotion(0, entry);
    assert.equal(initial.x, entry.startX);
    assert.equal(initial.y, entry.startY);
    let previousDistance = Math.abs(initial.x);
    for (const t of times) {
      const pose = sampleCrowdMotion(t, entry);
      assert.ok(Math.abs(pose.x) <= previousDistance + EPSILON, `${entry.id} bounced at ${t}`);
      assert.ok(pose.x * entry.startX >= 0, `${entry.id} overshot at ${t}`);
      previousDistance = Math.abs(pose.x);
    }
    for (const t of [ENTRANCE_DURATION, ENTRANCE_DURATION + 1, Infinity]) {
      const pose = sampleCrowdMotion(t, entry);
      assert.equal(pose.progress, 1);
      assert.equal(pose.scale, 1);
      for (const key of ["x", "y", "speed", "bodyAngle", "headAngle", "shoulderLift"] as const) {
        assert.equal(Math.abs(pose[key]), 0, `${entry.id}.${key} remains active at ${t}`);
      }
    }
  }
});

test("poses remain finite for normal, negative, and non-finite time inputs", () => {
  for (const entry of CROWD_PEOPLE) {
    for (const t of [-Infinity, -10, NaN, ...times, Infinity]) {
      for (const [key, value] of Object.entries(sampleCrowdMotion(t, entry))) {
        assert.ok(Number.isFinite(value), `${entry.id}.${key} is not finite at ${t}`);
      }
    }
  }
});

test("the final approach is continuous with the exact original pose", () => {
  for (const entry of CROWD_PEOPLE) {
    const nearEnd = sampleCrowdMotion(ENTRANCE_DURATION - 0.001, entry);
    assert.ok(Math.abs(nearEnd.x) < 0.001 && Math.abs(nearEnd.y) < 0.001);
    assert.ok(Math.abs(nearEnd.scale - 1) < 0.00001);
    assert.ok(Math.abs(nearEnd.bodyAngle) < 0.00001 && Math.abs(nearEnd.headAngle) < 0.00001);
    assert.ok(Math.abs(nearEnd.shoulderLift) < 0.001);
  }
});
