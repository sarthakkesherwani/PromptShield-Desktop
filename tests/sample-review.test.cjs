const test = require('node:test');
const assert = require('node:assert/strict');
const {reviewSample} = require('../src/sample-review.cjs');

test('sample masks both contacts consistently and restores the original on replay', () => {
 const original = reviewSample();
 assert.equal(original.count, 2);
 const masked = reviewSample(true);
 assert.equal(masked.count, 0);
 assert.equal(masked.scanned, 6);
 assert.deepEqual(masked.cells, ['Contact','Order','[EMAIL_1]','12 notebooks','[EMAIL_1]','8 folders']);
 assert.deepEqual(reviewSample(), original);
});
