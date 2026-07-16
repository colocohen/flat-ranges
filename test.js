/**
 * flat-ranges test suite
 *
 * Two layers:
 *   1. Unit tests — explicit expectations for every public function,
 *      including edge cases (empty arrays, empty ranges, touching
 *      half-open boundaries).
 *   2. Property-based fuzz — thousands of random cases verified
 *      against a naive reference implementation built on boolean
 *      coverage over a small integer domain. If the fast code and
 *      the obviously-correct code ever disagree, the test fails and
 *      prints the exact reproducing input.
 *
 * Run: node test.js
 */
'use strict';

var fr = require('./index.js');

var passed = 0, failed = 0;

function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function check(name, actual, expected) {
  if (eq(actual, expected)) { passed++; }
  else {
    failed++;
    console.error('FAIL: ' + name);
    console.error('  expected: ' + JSON.stringify(expected));
    console.error('  actual:   ' + JSON.stringify(actual));
  }
}

// ════════════════════════════════════════════════════════
//  1. Unit tests
// ════════════════════════════════════════════════════════

// ---- add ----
(function () {
  var r = [];
  check('add into empty returns true', fr.add(r, [0, 10]), true);
  check('add into empty', r, [0, 10]);

  r = [0, 5, 20, 25];
  fr.add(r, [4, 21]);
  check('add bridging merge', r, [0, 25]);

  r = [0, 5];
  check('add touching (half-open) merges', fr.add(r, [5, 10]), true);
  check('add touching result', r, [0, 10]);

  r = [0, 5];
  fr.add(r, [6, 10]);
  check('add with 1-unit gap stays separate', r, [0, 5, 6, 10]);

  r = [0, 100];
  check('add fully-contained returns false', fr.add(r, [10, 20]), false);
  check('add fully-contained unchanged', r, [0, 100]);

  r = [10, 20];
  fr.add(r, [0, 5]);
  check('add before first', r, [0, 5, 10, 20]);

  r = [10, 20];
  fr.add(r, [30, 40]);
  check('add after last (append fast path)', r, [10, 20, 30, 40]);

  r = [10, 20];
  fr.add(r, [20, 30]);
  check('extend last range (fast path)', r, [10, 30]);

  r = [10, 20];
  check('add empty range is no-op', fr.add(r, [5, 5]), false);

  r = [];
  fr.add(r, [30, 40, 0, 10, 20, 25]);   // unsorted batch
  check('add unsorted batch', r, [0, 10, 20, 25, 30, 40]);

  // large batch path (> threshold)
  r = [];
  var batch = [];
  for (var i = 9; i >= 0; i--) batch.push(i * 10, i * 10 + 5);
  fr.add(r, batch);
  check('add large reverse-sorted batch', r,
    [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95]);
})();

// ---- remove ----
(function () {
  var r = [0, 100];
  fr.remove(r, [10, 20, 50, 60]);
  check('remove punches holes', r, [0, 10, 20, 50, 60, 100]);

  r = [0, 10, 20, 30];
  check('remove miss (outside span) returns false', fr.remove(r, [100, 110]), false);
  check('remove miss unchanged', r, [0, 10, 20, 30]);

  r = [0, 10, 20, 30];
  check('remove in interior gap returns false', fr.remove(r, [12, 18]), false);
  check('remove in gap unchanged', r, [0, 10, 20, 30]);

  r = [0, 10];
  fr.remove(r, [0, 10]);
  check('remove everything', r, []);

  r = [0, 10];
  fr.remove(r, [0, 5]);
  check('remove left edge', r, [5, 10]);

  r = [0, 10];
  fr.remove(r, [5, 10]);
  check('remove right edge', r, [0, 5]);

  r = [];
  check('remove from empty returns false', fr.remove(r, [0, 10]), false);
})();

// ---- merge / invert ----
(function () {
  check('merge overlapping', fr.merge([0, 5, 3, 8]), [0, 8]);
  check('merge touching', fr.merge([0, 5, 5, 8]), [0, 8]);
  check('merge separate', fr.merge([0, 5, 6, 8]), [0, 5, 6, 8]);
  check('merge skips empty', fr.merge([0, 5, 7, 7, 9, 12]), [0, 5, 9, 12]);

  check('invert basic', fr.invert([10, 20, 30, 40], 0, 50), [0, 10, 20, 30, 40, 50]);
  check('invert of empty', fr.invert([], 0, 50), [0, 50]);
  check('invert full coverage', fr.invert([0, 50], 0, 50), []);
})();

// ---- intersect ----
(function () {
  check('intersect basic', fr.intersect([0, 10, 20, 30], [5, 25]), [5, 10, 20, 25]);
  check('intersect touching is empty (half-open)', fr.intersect([0, 10], [10, 20]), []);
  check('intersect identical', fr.intersect([0, 10], [0, 10]), [0, 10]);
  check('intersect with empty', fr.intersect([0, 10], []), []);
  check('intersect disjoint', fr.intersect([0, 5], [10, 15]), []);
  check('intersect nested', fr.intersect([0, 100], [10, 20, 30, 40]), [10, 20, 30, 40]);
})();

// ---- subtract_clip / length ----
(function () {
  check('subtract_clip', fr.subtract_clip([20, 40], [0, 50]), [0, 20, 40, 50]);
  check('subtract_clip empty base', fr.subtract_clip([], [0, 50]), [0, 50]);
  check('length', fr.length([0, 10, 20, 30]), 20);
  check('length of empty', fr.length([]), 0);
})();

// ---- contains / overlaps / equal ----
(function () {
  check('contains inside', fr.contains([0, 10, 20, 30], 5), true);
  check('contains at to (half-open)', fr.contains([0, 10, 20, 30], 10), false);
  check('contains at from', fr.contains([0, 10, 20, 30], 20), true);
  check('contains empty', fr.contains([], 5), false);

  check('overlaps hit', fr.overlaps([0, 10, 20, 30], 5, 15), true);
  check('overlaps exact gap (half-open)', fr.overlaps([0, 10, 20, 30], 10, 20), false);
  check('overlaps spanning gap', fr.overlaps([0, 10, 20, 30], 9, 21), true);
  check('overlaps empty query', fr.overlaps([0, 10], 5, 5), false);
  check('overlaps empty ranges', fr.overlaps([], 0, 10), false);

  check('equal true', fr.equal([0, 5, 10, 15], [0, 5, 10, 15]), true);
  check('equal false value', fr.equal([0, 5], [0, 6]), false);
  check('equal false length', fr.equal([0, 5], [0, 5, 10, 15]), false);
  check('equal both empty', fr.equal([], []), true);
})();

// ---- unknown / first_unknown ----
(function () {
  check('unknown basic', fr.unknown([0, 30], [60, 100], 0, 100), [30, 60]);
  check('unknown all known', fr.unknown([0, 100], [], 0, 100), []);
  check('unknown nothing known', fr.unknown([], [], 0, 100), [0, 100]);

  check('first_unknown basic', fr.first_unknown([0, 30], [60, 100], 0, 100), [30, 60]);
  check('first_unknown clipped', fr.first_unknown([0, 30], [60, 100], 0, 100, 16), [30, 46]);
  check('first_unknown none', fr.first_unknown([0, 100], [], 0, 100), null);
  check('first_unknown at min', fr.first_unknown([10, 20], [], 0, 100), [0, 10]);
  check('first_unknown interleaved cover',
    fr.first_unknown([0, 10, 20, 30], [10, 20, 30, 45], 0, 100), [45, 100]);
})();

// ---- have / not-have ----
(function () {
  var have = [], notHave = [40, 60];
  fr.add_have(have, notHave, [0, 100]);
  check('add_have skips notHave', have, [0, 40, 60, 100]);
  check('add_have leaves notHave', notHave, [40, 60]);

  have = [0, 50]; notHave = [];
  fr.add_not_have(have, notHave, [30, 80]);
  check('add_not_have skips have', notHave, [50, 80]);

  have = [0, 50]; notHave = [50, 70];
  fr.set_have(have, notHave, [30, 100]);
  check('set_have replaces have', have, [30, 100]);
  check('set_have moves lost to notHave', notHave, [0, 30]);

  have = [20, 40]; notHave = [0, 20, 40, 60];
  fr.set_not_have(have, notHave, [50, 80]);
  check('set_not_have replaces notHave', notHave, [50, 80]);
  check('set_not_have moves lost to have', have, [0, 50]);

  // idempotence: applying the same set twice → second returns false
  have = [0, 10]; notHave = [];
  fr.set_have(have, notHave, [0, 10]);
  check('set_have idempotent returns false', fr.set_have(have, notHave, [0, 10]), false);
})();

// ════════════════════════════════════════════════════════
//  2. Property-based fuzz vs naive reference
// ════════════════════════════════════════════════════════
//
// The reference represents coverage as a boolean array over
// [0, DOMAIN). Slow but obviously correct.

var DOMAIN = 200;

function toBits(ranges) {
  var bits = new Array(DOMAIN).fill(false);
  for (var i = 0; i < ranges.length; i += 2) {
    for (var v = Math.max(0, ranges[i]); v < Math.min(DOMAIN, ranges[i + 1]); v++) bits[v] = true;
  }
  return bits;
}

function toRanges(bits) {
  var out = [], start = -1;
  for (var v = 0; v <= DOMAIN; v++) {
    var on = v < DOMAIN && bits[v];
    if (on && start === -1) start = v;
    if (!on && start !== -1) { out.push(start, v); start = -1; }
  }
  return out;
}

function randNormalized(maxPairs) {
  var bits = new Array(DOMAIN).fill(false);
  var pairs = 1 + (Math.random() * maxPairs | 0);
  for (var i = 0; i < pairs; i++) {
    var from = Math.random() * DOMAIN | 0;
    var len = 1 + (Math.random() * 25 | 0);
    for (var v = from; v < Math.min(DOMAIN, from + len); v++) bits[v] = true;
  }
  return toRanges(bits);
}

function randRawBatch(maxPairs) {
  // unsorted, possibly-overlapping, possibly-empty ranges
  var out = [];
  var pairs = 1 + (Math.random() * maxPairs | 0);
  for (var i = 0; i < pairs; i++) {
    var from = Math.random() * DOMAIN | 0;
    var to = from + (Math.random() * 25 | 0);   // may be empty (from===to)
    out.push(from, Math.min(to, DOMAIN));
  }
  return out;
}

var FUZZ_ITERS = 5000;
var fuzzFails = 0;

function fuzzFail(op, ctx) {
  fuzzFails++; failed++;
  if (fuzzFails <= 5) console.error('FUZZ FAIL [' + op + ']: ' + JSON.stringify(ctx));
}

for (var t = 0; t < FUZZ_ITERS; t++) {
  var base = randNormalized(8);
  var bits = toBits(base);

  // -- add (single + batch) --
  var batch = t % 2 === 0 ? randRawBatch(1) : randRawBatch(8);
  var r1 = base.slice();
  fr.add(r1, batch.slice());
  var refBits = bits.slice();
  for (var i = 0; i < batch.length; i += 2)
    for (var v = batch[i]; v < batch[i + 1]; v++) refBits[v] = true;
  if (!eq(r1, toRanges(refBits))) fuzzFail('add', { base: base, batch: batch, got: r1, want: toRanges(refBits) });

  // -- remove (sorted, per contract) --
  var rem = randNormalized(5);
  var r2 = base.slice();
  fr.remove(r2, rem);
  refBits = bits.slice();
  for (var i = 0; i < rem.length; i += 2)
    for (var v = rem[i]; v < rem[i + 1]; v++) refBits[v] = false;
  if (!eq(r2, toRanges(refBits))) fuzzFail('remove', { base: base, rem: rem, got: r2, want: toRanges(refBits) });

  // -- intersect --
  var other = randNormalized(6);
  var got = fr.intersect(base, other);
  var otherBits = toBits(other);
  refBits = bits.map(function (b, idx) { return b && otherBits[idx]; });
  if (!eq(got, toRanges(refBits))) fuzzFail('intersect', { a: base, b: other, got: got, want: toRanges(refBits) });

  // -- invert --
  got = fr.invert(base, 0, DOMAIN);
  refBits = bits.map(function (b) { return !b; });
  if (!eq(got, toRanges(refBits))) fuzzFail('invert', { base: base, got: got, want: toRanges(refBits) });

  // -- subtract_clip --
  got = fr.subtract_clip(base, other);
  refBits = otherBits.map(function (b, idx) { return b && !bits[idx]; });
  if (!eq(got, toRanges(refBits))) fuzzFail('subtract_clip', { base: base, sub: other, got: got, want: toRanges(refBits) });

  // -- length / contains / overlaps --
  var refLen = bits.reduce(function (s, b) { return s + (b ? 1 : 0); }, 0);
  if (fr.length(base) !== refLen) fuzzFail('length', { base: base, got: fr.length(base), want: refLen });

  var val = Math.random() * DOMAIN | 0;
  if (fr.contains(base, val) !== !!bits[val]) fuzzFail('contains', { base: base, val: val });

  var qf = Math.random() * DOMAIN | 0, qt = qf + (Math.random() * 30 | 0);
  var refOv = false;
  for (var v = qf; v < Math.min(qt, DOMAIN); v++) if (bits[v]) { refOv = true; break; }
  if (fr.overlaps(base, qf, qt) !== refOv) fuzzFail('overlaps', { base: base, from: qf, to: qt });

  // -- unknown / first_unknown --
  var nh = fr.subtract_clip(base, randNormalized(4));     // disjoint from base by construction
  got = fr.unknown(base, nh, 0, DOMAIN);
  var nhBits = toBits(nh);
  refBits = bits.map(function (b, idx) { return !b && !nhBits[idx]; });
  if (!eq(got, toRanges(refBits))) fuzzFail('unknown', { have: base, nh: nh, got: got, want: toRanges(refBits) });

  var fu = fr.first_unknown(base, nh, 0, DOMAIN);
  var wantRanges = toRanges(refBits);
  var wantFu = wantRanges.length ? [wantRanges[0], wantRanges[1]] : null;
  if (!eq(fu, wantFu)) fuzzFail('first_unknown', { have: base, nh: nh, got: fu, want: wantFu });

  // -- set_have invariants --
  var h = base.slice(), n2 = nh.slice();
  var newHave = randNormalized(5);
  fr.set_have(h, n2, newHave.slice());
  // invariant 1: h equals normalised newHave
  if (!eq(h, newHave)) fuzzFail('set_have h', { got: h, want: newHave });
  // invariant 2: n2 == (base ∪ nh) \ newHave
  var unionBits = bits.map(function (b, idx) { return b || nhBits[idx]; });
  var newHaveBits = toBits(newHave);
  refBits = unionBits.map(function (b, idx) { return b && !newHaveBits[idx]; });
  if (!eq(n2, toRanges(refBits))) fuzzFail('set_have nh', { got: n2, want: toRanges(refBits) });
  // invariant 3: have and notHave never overlap
  if (fr.intersect(h, n2).length !== 0) fuzzFail('set_have overlap invariant', { h: h, nh: n2 });
}

// ════════════════════════════════════════════════════════
//  Results
// ════════════════════════════════════════════════════════
console.log('');
console.log('unit + fuzz assertions passed: ' + passed);
if (failed > 0) {
  console.error('FAILED: ' + failed);
  process.exit(1);
} else {
  console.log('all tests passed ✓  (' + FUZZ_ITERS + ' fuzz iterations)');
}
