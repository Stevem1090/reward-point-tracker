// @ts-nocheck -- run with bun test
import './testSetup';
import { expect, test } from 'bun:test';
import { writingWarnings } from './writing';
import { applyDescription, newItem } from './batch';

test('45 words is allowed; 46 produces a soft warning', () => {
  const make = (n) => Array(n - 2).fill('item').join(' ') + ' Great condition.';
  expect(writingWarnings(make(45), 2)).not.toContain('Description is over 45 words.');
  expect(writingWarnings(make(46), 2)).toContain('Description is over 45 words.');
});
test('three lines is allowed; four produces a warning', () => {
  expect(writingWarnings('Lovely coat.\nDetachable mittens.\nGreat condition.', 2)).toEqual([]);
  expect(writingWarnings('Lovely coat.\nHood.\nMittens.\nGreat condition.', 2)).toContain('Description has more than 3 lines.');
});
test('flags emoji, hashtags, markdown and 3-letter all-caps words', () => {
  const result = writingWarnings('Lovely coat 😊 #coat **NEW**.\nGreat condition.', 2);
  expect(result).toContain('Remove emojis from the description.');
  expect(result).toContain('Remove hashtags or markdown from the description.');
  expect(result).toContain('Description contains an all-capitals word.');
  expect(writingWarnings('Lovely H&M coat. Great condition.', 2)).toEqual([]);
});
for (const phrase of ['my son', 'my daughter', 'smoke free', 'pet free', 'worn once']) {
  test(`${phrase} must be supported by Notes`, () => {
    expect(writingWarnings(`${phrase}. Great condition.`, 2, '')).toContain(`“${phrase}” is not supported by your notes.`);
    expect(writingWarnings(`${phrase}. Great condition.`, 2, phrase)).not.toContain(`“${phrase}” is not supported by your notes.`);
  });
}
for (const [id, line] of [[6, 'Brand new with tags.'], [1, 'Brand new, never worn.'], [2, 'Fab condition.'], [3, 'Good, used condition.'], [4, 'Really worn in places but still useful as garden wellies.']]) {
  test(`condition ${id} must match the last line`, () => {
    expect(writingWarnings(`Lovely item.\n${line}`, id)).toEqual([]);
    expect(writingWarnings(`${line}\nLovely item.`, id)).toContain('The final line may not match the chosen condition.');
  });
}
test('description regeneration preserves all other edits and asks for review again', () => {
  const item = { ...newItem([], 'Small mark on back.', 'Next'), title: 'My edited title', description: 'Old', brandId: 123, price: '8', packageId: 2, conditionId: 3, status: 'approved' };
  const next = applyDescription(item, 'Lovely jumper.\nGood, used condition. Mark on back.');
  expect(next.description).toBe('Lovely jumper.\nGood, used condition. Mark on back.');
  expect({ ...next, description: item.description, status: item.status }).toEqual(item);
  expect(next.status).toBe('needs_review');
});