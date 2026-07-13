import {
  audienceItems,
  bonuses,
  careerSteps,
  programDays,
  registrationGifts,
  stats,
} from '../src/content/landing.ts';

const expectedCounts = new Map([
  ['audienceItems', [audienceItems, 6]],
  ['programDays', [programDays, 3]],
  ['careerSteps', [careerSteps, 5]],
  ['stats', [stats, 3]],
  ['bonuses', [bonuses, 4]],
  ['registrationGifts', [registrationGifts, 6]],
]);

for (const [name, [items, expected]] of expectedCounts) {
  if (items.length !== expected) {
    throw new Error(`${name}: expected ${expected}, received ${items.length}`);
  }
}

for (const day of programDays) {
  if (day.points.length < 5 || !day.giftTitle || !day.giftDescription) {
    throw new Error(`program day ${day.day} is incomplete`);
  }
}

console.log('content validation passed');
