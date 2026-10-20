export type CrowdId = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface CrowdPerson {
  id: CrowdId;
  plane: "back" | "front";
  startX: number;
  startY: number;
  depth: number;
  neck: readonly [number, number];
  shoulderY: number;
  stride: number;
  phase: number;
  weight: number;
}

// Back to front. G is the upper-left head behind D, as marked by the user.
export const CROWD_PEOPLE: readonly CrowdPerson[] = [
  { id: "A", plane: "back", startX: 18, startY: 0, depth: 0, neck: [22, 460], shoulderY: 530, stride: 0.6, phase: 0.5, weight: 0.3 },
  { id: "F", plane: "back", startX: -48, startY: 4, depth: 0.012, neck: [365, 465], shoulderY: 560, stride: 0.9, phase: 1.8, weight: 0.55 },
  { id: "C", plane: "back", startX: -40, startY: 5, depth: 0.018, neck: [600, 470], shoulderY: 550, stride: 0.85, phase: 3.3, weight: 0.6 },
  { id: "E", plane: "back", startX: -48, startY: 2, depth: 0.008, neck: [1510, 475], shoulderY: 560, stride: 1.2, phase: 2.4, weight: 0.75 },
  { id: "G", plane: "back", startX: -130, startY: 4, depth: 0.012, neck: [1210, 425], shoulderY: 520, stride: 0.95, phase: 4.8, weight: 0.5 },
  { id: "B", plane: "front", startX: 200, startY: 0, depth: 0.006, neck: [270, 465], shoulderY: 590, stride: 1.4, phase: 0.6, weight: 1 },
  { id: "D", plane: "front", startX: -100, startY: 3, depth: 0.014, neck: [1270, 490], shoulderY: 590, stride: 1.15, phase: 3.1, weight: 0.85 },
];

export const ENTRANCE_DURATION = 3;
// Preserve the approved curve's proportions when changing the total playback time.
const ACCELERATION_END = ENTRANCE_DURATION * (0.38 / 3);
const SLOWDOWN_START = ENTRANCE_DURATION * (0.95 / 3);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const x = clamp(n); return x * x * (3 - 2 * x); };

export function crowdSpeed(t: number): number {
  if (t <= 0 || t >= ENTRANCE_DURATION || !Number.isFinite(t)) return 0;
  if (t < ACCELERATION_END) return smooth(t / ACCELERATION_END);
  if (t < SLOWDOWN_START) return 1;
  return Math.pow(1 - smooth((t - SLOWDOWN_START) / (ENTRANCE_DURATION - SLOWDOWN_START)), 1.8);
}

const SAMPLES = 600;
const distance = new Float64Array(SAMPLES + 1);
for (let i = 1; i <= SAMPLES; i++) {
  distance[i] = distance[i - 1] + (crowdSpeed((i - 1) * ENTRANCE_DURATION / SAMPLES) + crowdSpeed(i * ENTRANCE_DURATION / SAMPLES)) / 2;
}

export function crowdProgress(t: number): number {
  if (t <= 0 || Number.isNaN(t)) return 0;
  if (t >= ENTRANCE_DURATION) return 1;
  const sample = t / ENTRANCE_DURATION * SAMPLES;
  const index = Math.floor(sample);
  return (distance[index] + (distance[index + 1] - distance[index]) * (sample - index)) / distance[SAMPLES];
}

export function sampleCrowdMotion(t: number, person: CrowdPerson) {
  const progress = crowdProgress(t);
  const remaining = 1 - progress;
  const speed = crowdSpeed(t);
  const phase = person.phase + progress * person.stride * Math.PI * 2;
  const weight = person.weight * speed;
  return {
    progress, speed,
    x: person.startX * remaining,
    y: person.startY * remaining + (1 - Math.cos(phase * 2)) * 1.4 * weight,
    scale: 1 + person.depth * remaining,
    bodyAngle: Math.sin(phase) * 0.009 * weight,
    headAngle: -Math.sin(phase + 0.3) * 0.008 * weight,
    shoulderLift: Math.sin(phase) * 2.4 * weight,
  };
}
