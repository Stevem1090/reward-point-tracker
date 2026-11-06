import { describe, expect, it } from 'bun:test';
import { arrangeFromPlan, validatePlan } from './photos';
import { applyAnalysis, arrangement, newItem, orderedImages, replanPhotos, resetPhotos, setPhotos } from './batch';
import { normaliseAnalysis } from './analysis';

const e = (photoId: number, deg = 0, c = 'high', role = 'detail') => ({ photoId, role, rotateClockwiseDegrees: deg, rotationConfidence: c, note: 'x' });
const img = (n: string) => ({ name: n, type: 'image/jpeg' as const, base64: n });

describe('photo plan', () => {
  it('needs every photo exactly once with valid degrees', () => {
    expect(validatePlan([e(3), e(2), e(1)], 3)).not.toBeNull();
    expect(validatePlan([e(1), e(1), e(2)], 3)).toBeNull();
    expect(validatePlan([e(1), e(2)], 3)).toBeNull();
    expect(validatePlan([e(1), e(2, 45)], 2)).toBeNull();
    expect(validatePlan([e(1), e(4)], 2)).toBeNull();
  });
  it('label-first photos come back in the AI order; low confidence is not rotated', () => {
    const plan = validatePlan([e(3, 90, 'high', 'full_flat_lay'), e(2, 180, 'low'), e(1, 270, 'medium', 'label')], 3)!;
    expect(arrangeFromPlan(plan, [0, 1, 2])).toEqual([
      { src: 2, rotate: 90, role: 'full_flat_lay', autoDeg: 90, checkRotation: undefined },
      { src: 1, rotate: 0, role: 'detail', autoDeg: undefined, checkRotation: true },
      { src: 0, rotate: 270, role: 'label', autoDeg: 270, checkRotation: undefined },
    ]);
  });
  it('invalid plan keeps original order and flags photo_plan_invalid', () => {
    const a = normaliseAnalysis({ photos: [e(1), e(1)], flags: [] }, 2);
    expect(a.photos).toBeNull();
    expect(a.flags).toContain('photo_plan_invalid');
    const it2 = applyAnalysis(newItem([img('a'), img('b')], '', ''), a);
    expect(arrangement(it2).map((p) => p.src)).toEqual([0, 1]);
  });
  it('manual changes survive re-analysis until "Re-order photos again"', () => {
    const a = normaliseAnalysis({ photos: [e(2), e(1)], flags: [] }, 2);
    let it2 = applyAnalysis(newItem([img('a'), img('b')], '', ''), a);
    expect(orderedImages(it2).map((i) => i.base64)).toEqual(['b', 'a']);
    it2 = setPhotos(it2, [{ src: 0, rotate: 90 }, { src: 1, rotate: 0 }]);
    it2 = applyAnalysis(it2, a);
    expect(arrangement(it2)).toEqual([{ src: 0, rotate: 90 }, { src: 1, rotate: 0 }]);
    expect(arrangement(replanPhotos(it2)).map((p) => p.src)).toEqual([1, 0]);
    expect(arrangement(resetPhotos(it2))).toEqual([{ src: 0, rotate: 0 }, { src: 1, rotate: 0 }]);
  });
  it('a removed photo stays removed when re-planning', () => {
    const a = normaliseAnalysis({ photos: [e(3), e(2), e(1)], flags: [] }, 3);
    const it2 = setPhotos(applyAnalysis(newItem([img('a'), img('b'), img('c')], '', ''), a), [{ src: 0, rotate: 0 }, { src: 2, rotate: 0 }]);
    expect(arrangement(replanPhotos(it2)).map((p) => p.src)).toEqual([2, 0]);
  });
});
