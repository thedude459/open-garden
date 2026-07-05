import { performance } from "node:perf_hooks";
import { sortByZIndex } from "../lib/planner/layers";

function buildItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    z_index: index % 7,
  }));
}

function simulateDragProjection(items: typeof buildItems extends (...args: never[]) => infer R ? R : never) {
  const sorted = sortByZIndex(items);
  return sorted.map((item) => ({ ...item, projected: true }));
}

const ITEM_COUNT = 50;
const SAMPLES = 200;
const durations: number[] = [];

for (let sample = 0; sample < SAMPLES; sample += 1) {
  const items = buildItems(ITEM_COUNT);
  const start = performance.now();
  simulateDragProjection(items);
  durations.push(performance.now() - start);
}

durations.sort((a, b) => a - b);
const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;

console.log(`planner-canvas bench (${ITEM_COUNT} sprites, ${SAMPLES} samples)`);
console.log(`p95: ${p95.toFixed(3)}ms`);

if (p95 >= 100) {
  console.error("SC-003a target missed: p95 must be < 100ms");
  process.exit(1);
}
