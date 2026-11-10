// @ts-nocheck -- run with bun test
import { expect, it } from 'bun:test';
import { ANALYSIS_START_GAP_MS, createAnalysisQueue } from './analysisQueue';

it('spaces even instant analyses by the start gap', async () => {
  let clock = 0;
  const starts: number[] = [];
  const queue = createAnalysisQueue(ANALYSIS_START_GAP_MS, () => clock, async (ms) => { clock += ms; });
  await Promise.all(Array.from({ length: 15 }, () => queue(async () => { starts.push(clock); })));
  expect(ANALYSIS_START_GAP_MS).toBe(5000);
  expect(starts.slice(0, 3)).toEqual([0, 5000, 10000]);
  expect(starts.filter((t) => t < 60000)).toHaveLength(12);
});

it('continues after a failed analysis without dropping spacing', async () => {
  let clock = 0;
  const queue = createAnalysisQueue(5000, () => clock, async (ms) => { clock += ms; });
  await queue(async () => { throw new Error('failure'); }).catch(() => {});
  expect(await queue(async () => clock)).toBe(5000);
});