var flatRanges = require('./index.js');

var add = flatRanges.add;
var remove = flatRanges.remove;
var merge = flatRanges.merge;
var invert = flatRanges.invert;
var subtract_clip = flatRanges.subtract_clip;
var length = flatRanges.length;
var unknown = flatRanges.unknown;
var add_have = flatRanges.add_have;
var add_not_have = flatRanges.add_not_have;
var set_have = flatRanges.set_have;
var set_not_have = flatRanges.set_not_have;

var passed = 0;
var failed = 0;
var totalAssertions = 0;

function deepEqual(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function assert(actual, expected, label) {
  totalAssertions++;
  if (deepEqual(actual, expected)) {
    passed++;
  } else {
    failed++;
    console.log('  \u2717 ' + label);
    console.log('    expected:', JSON.stringify(expected));
    console.log('    actual:  ', JSON.stringify(actual));
  }
}

function assertVal(actual, expected, label) {
  totalAssertions++;
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.log('  \u2717 ' + label);
    console.log('    expected:', expected);
    console.log('    actual:  ', actual);
  }
}

function section(name) {
  console.log('\n\u2501\u2501\u2501 ' + name + ' \u2501\u2501\u2501');
}

// ═══════════════════════════════════════════════════════════
//  add
// ═══════════════════════════════════════════════════════════
section('add');

(function () {
  var r = [];
  add(r, [5, 10]);
  assert(r, [5, 10], 'add to empty');
})();

(function () {
  var r = [0, 5];
  add(r, [10, 15]);
  assert(r, [0, 5, 10, 15], 'add non-overlapping');
})();

(function () {
  var r = [0, 5];
  add(r, [3, 8]);
  assert(r, [0, 8], 'add overlapping');
})();

(function () {
  var r = [0, 5];
  add(r, [5, 10]);
  assert(r, [0, 10], 'add adjacent (touching)');
})();

(function () {
  var r = [0, 3, 7, 10];
  add(r, [2, 8]);
  assert(r, [0, 10], 'add bridging two ranges');
})();

(function () {
  var r = [0, 5];
  add(r, [1, 3]);
  assert(r, [0, 5], 'add subset — no change');
})();

(function () {
  var r = [0, 5];
  var changed = add(r, [1, 3]);
  assertVal(changed, false, 'add subset returns false');
})();

(function () {
  var r = [0, 5];
  var changed = add(r, [10, 15]);
  assertVal(changed, true, 'add new range returns true');
})();

(function () {
  var r = [];
  add(r, [10, 15, 0, 5]);
  assert(r, [0, 5, 10, 15], 'add unsorted input — gets sorted');
})();

(function () {
  var r = [0, 5];
  add(r, []);
  assert(r, [0, 5], 'add empty newRanges — no change');
})();

(function () {
  var r = [];
  add(r, [3, 3]);
  assert(r, [], 'add empty range (from === to) — skipped');
})();

(function () {
  // addOne fast path: insert at beginning
  var r = [10, 20, 30, 40];
  add(r, [0, 5]);
  assert(r, [0, 5, 10, 20, 30, 40], 'addOne: insert at beginning');
})();

(function () {
  // addOne fast path: insert in middle gap
  var r = [0, 5, 20, 30];
  add(r, [10, 15]);
  assert(r, [0, 5, 10, 15, 20, 30], 'addOne: insert in middle gap');
})();

(function () {
  // addOne fast path: insert at end
  var r = [0, 5, 10, 15];
  add(r, [50, 60]);
  assert(r, [0, 5, 10, 15, 50, 60], 'addOne: insert at end');
})();

(function () {
  // addOne fast path: merge spanning all ranges
  var r = [0, 3, 5, 8, 10, 13];
  add(r, [-1, 20]);
  assert(r, [-1, 20], 'addOne: merge spanning all');
})();

(function () {
  // Large batch: triggers sort+merge path (> 12 elements)
  var r = [100, 200];
  var big = [];
  for (var i = 0; i < 20; i++) {
    big.push(i * 10, i * 10 + 5);
  }
  add(r, big);
  // Should merge 0-5,10-15,...,190-195 with 100-200
  var expected = [];
  add(expected, big);
  add(expected, [100, 200]);
  assert(r, expected.slice(), 'add large batch — sort+merge path');
})();

// ═══════════════════════════════════════════════════════════
//  remove
// ═══════════════════════════════════════════════════════════
section('remove');

(function () {
  var r = [0, 10];
  remove(r, [3, 7]);
  assert(r, [0, 3, 7, 10], 'remove middle — splits range');
})();

(function () {
  var r = [0, 10];
  remove(r, [2, 4, 6, 8]);
  assert(r, [0, 2, 4, 6, 8, 10], 'remove multiple from one range');
})();

(function () {
  var r = [0, 10];
  remove(r, [0, 5]);
  assert(r, [5, 10], 'remove left part');
})();

(function () {
  var r = [0, 10];
  remove(r, [5, 10]);
  assert(r, [0, 5], 'remove right part');
})();

(function () {
  var r = [0, 10];
  remove(r, [0, 10]);
  assert(r, [], 'remove entire range');
})();

(function () {
  var r = [0, 10];
  remove(r, [-5, 15]);
  assert(r, [], 'remove superset');
})();

(function () {
  var r = [0, 5, 10, 15];
  remove(r, [3, 12]);
  assert(r, [0, 3, 12, 15], 'remove spanning two ranges');
})();

(function () {
  var r = [0, 10];
  remove(r, [20, 30]);
  assert(r, [0, 10], 'remove non-overlapping — no change');
})();

(function () {
  var r = [0, 10];
  var changed = remove(r, [20, 30]);
  assertVal(changed, false, 'remove non-overlapping returns false');
})();

(function () {
  var r = [0, 10];
  var changed = remove(r, [3, 7]);
  assertVal(changed, true, 'remove overlap returns true');
})();

(function () {
  var r = [0, 3, 5, 8, 10, 13, 15, 18];
  remove(r, [1, 2, 6, 7, 11, 12, 16, 17]);
  assert(r, [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18],
    'remove many small cuts from many ranges');
})();

(function () {
  var r = [0, 100];
  remove(r, [10, 20, 30, 40, 50, 60, 70, 80]);
  assert(r, [0, 10, 20, 30, 40, 50, 60, 70, 80, 100],
    'remove swiss-cheese pattern');
})();

(function () {
  var r = [];
  remove(r, [0, 5]);
  assert(r, [], 'remove from empty — no change');
})();

(function () {
  var r = [0, 10];
  remove(r, []);
  assert(r, [0, 10], 'remove empty removeRanges — no change');
})();

// ═══════════════════════════════════════════════════════════
//  merge
// ═══════════════════════════════════════════════════════════
section('merge');

(function () {
  assert(merge([0, 5, 3, 8]), [0, 8], 'merge overlapping');
})();

(function () {
  assert(merge([0, 5, 5, 10]), [0, 10], 'merge touching');
})();

(function () {
  assert(merge([0, 5, 10, 15]), [0, 5, 10, 15], 'merge non-overlapping');
})();

(function () {
  assert(merge([]), [], 'merge empty');
})();

(function () {
  assert(merge([5, 5, 0, 3]), [0, 3], 'merge skips empty ranges');
})();

// ═══════════════════════════════════════════════════════════
//  invert
// ═══════════════════════════════════════════════════════════
section('invert');

(function () {
  assert(invert([2, 5, 8, 10], 0, 15), [0, 2, 5, 8, 10, 15], 'invert basic');
})();

(function () {
  assert(invert([], 0, 10), [0, 10], 'invert empty — full domain');
})();

(function () {
  assert(invert([0, 10], 0, 10), [], 'invert full coverage — empty');
})();

(function () {
  assert(invert([0, 5], 0, 10), [5, 10], 'invert left half');
})();

(function () {
  assert(invert([5, 10], 0, 10), [0, 5], 'invert right half');
})();

(function () {
  assert(invert([0, 10], 0, 5), [], 'invert — ranges exceed domain');
})();

// ═══════════════════════════════════════════════════════════
//  subtract_clip
// ═══════════════════════════════════════════════════════════
section('subtract_clip');

(function () {
  assert(subtract_clip([3, 7], [0, 10]), [0, 3, 7, 10], 'subtract_clip — removes overlap');
})();

(function () {
  assert(subtract_clip([0, 10], [0, 10]), [], 'subtract_clip — full overlap');
})();

(function () {
  assert(subtract_clip([20, 30], [0, 10]), [0, 10], 'subtract_clip — no overlap');
})();

(function () {
  assert(subtract_clip([], [0, 10]), [0, 10], 'subtract_clip — empty base');
})();

(function () {
  var sub = [0, 10];
  subtract_clip([3, 7], sub);
  assert(sub, [0, 10], 'subtract_clip — does not mutate input');
})();

// ═══════════════════════════════════════════════════════════
//  length
// ═══════════════════════════════════════════════════════════
section('length');

(function () {
  assertVal(length([0, 5, 10, 15]), 10, 'length two ranges');
})();

(function () {
  assertVal(length([]), 0, 'length empty');
})();

(function () {
  assertVal(length([0, 100]), 100, 'length single range');
})();

// ═══════════════════════════════════════════════════════════
//  unknown
// ═══════════════════════════════════════════════════════════
section('unknown');

(function () {
  assert(unknown([0, 5], [10, 15], 0, 20), [5, 10, 15, 20], 'unknown basic');
})();

(function () {
  assert(unknown([10, 20], [0, 5], 0, 30), [5, 10, 20, 30],
    'unknown — have after notHave (unsorted concat fix)');
})();

(function () {
  assert(unknown([], [], 0, 10), [0, 10], 'unknown — everything unknown');
})();

(function () {
  assert(unknown([0, 10], [10, 20], 0, 20), [], 'unknown — everything known');
})();

// ═══════════════════════════════════════════════════════════
//  add_have
// ═══════════════════════════════════════════════════════════
section('add_have');

(function () {
  var have = [], notHave = [5, 10];
  add_have(have, notHave, [0, 15]);
  assert(have, [0, 5, 10, 15], 'add_have — skips notHave region');
  assert(notHave, [5, 10], 'add_have — notHave unchanged');
})();

(function () {
  var have = [0, 5], notHave = [];
  var changed = add_have(have, notHave, [0, 5]);
  assertVal(changed, false, 'add_have — duplicate returns false');
})();

(function () {
  var have = [], notHave = [];
  add_have(have, notHave, [10, 20]);
  assert(have, [10, 20], 'add_have — both empty');
})();

// ═══════════════════════════════════════════════════════════
//  add_not_have
// ═══════════════════════════════════════════════════════════
section('add_not_have');

(function () {
  var have = [5, 10], notHave = [];
  add_not_have(have, notHave, [0, 15]);
  assert(notHave, [0, 5, 10, 15], 'add_not_have — skips have region');
  assert(have, [5, 10], 'add_not_have — have unchanged');
})();

(function () {
  var have = [], notHave = [0, 5];
  var changed = add_not_have(have, notHave, [0, 5]);
  assertVal(changed, false, 'add_not_have — duplicate returns false');
})();

// ═══════════════════════════════════════════════════════════
//  set_have
// ═══════════════════════════════════════════════════════════
section('set_have');

(function () {
  var have = [0, 10], notHave = [];
  set_have(have, notHave, [0, 5]);
  assert(have, [0, 5], 'set_have — shrink have');
  assert(notHave, [5, 10], 'set_have — lost ranges move to notHave');
})();

(function () {
  var have = [], notHave = [5, 15];
  set_have(have, notHave, [0, 20]);
  assert(have, [0, 20], 'set_have — authoritative override of notHave');
  assert(notHave, [], 'set_have — notHave cleared by authority');
})();

(function () {
  var have = [0, 10], notHave = [10, 15];
  set_have(have, notHave, [5, 15]);
  assert(have, [5, 15], 'set_have — partial overlap both sides');
  assert(notHave, [0, 5], 'set_have — old have outside new → notHave');
})();

(function () {
  var have = [0, 10], notHave = [];
  var changed = set_have(have, notHave, [0, 10]);
  assertVal(changed, false, 'set_have — same data returns false');
})();

(function () {
  var have = [], notHave = [];
  set_have(have, notHave, []);
  assert(have, [], 'set_have — set empty on empty');
  assert(notHave, [], 'set_have — notHave stays empty');
})();

(function () {
  var have = [0, 5, 10, 15], notHave = [];
  set_have(have, notHave, [3, 12]);
  assert(have, [3, 12], 'set_have — complex transition');
  assert(notHave, [0, 3, 12, 15], 'set_have — multiple fragments to notHave');
})();

// ═══════════════════════════════════════════════════════════
//  set_not_have
// ═══════════════════════════════════════════════════════════
section('set_not_have');

(function () {
  var have = [], notHave = [0, 10];
  set_not_have(have, notHave, [0, 5]);
  assert(notHave, [0, 5], 'set_not_have — shrink notHave');
  assert(have, [5, 10], 'set_not_have — lost ranges move to have');
})();

(function () {
  var have = [5, 15], notHave = [];
  set_not_have(have, notHave, [0, 20]);
  assert(notHave, [0, 20], 'set_not_have — authoritative override of have');
  assert(have, [], 'set_not_have — have cleared by authority');
})();

(function () {
  var have = [], notHave = [0, 10];
  var changed = set_not_have(have, notHave, [0, 10]);
  assertVal(changed, false, 'set_not_have — same data returns false');
})();

(function () {
  var have = [10, 15], notHave = [0, 10];
  set_not_have(have, notHave, [5, 20]);
  assert(notHave, [5, 20], 'set_not_have — partial overlap both sides');
  assert(have, [0, 5], 'set_not_have — old notHave outside new → have');
})();

// ═══════════════════════════════════════════════════════════
//  Integrity: have ∩ notHave = ∅
// ═══════════════════════════════════════════════════════════
section('Integrity: have \u2229 notHave = \u2205');

function hasOverlap(a, b) {
  for (var i = 0; i < a.length; i += 2) {
    for (var j = 0; j < b.length; j += 2) {
      if (a[i] < b[j + 1] && a[i + 1] > b[j]) return true;
    }
  }
  return false;
}

(function () {
  var have = [0, 50], notHave = [50, 100];
  add_have(have, notHave, [30, 70]);
  assertVal(hasOverlap(have, notHave), false, 'add_have — no overlap');
})();

(function () {
  var have = [0, 50], notHave = [50, 100];
  add_not_have(have, notHave, [30, 70]);
  assertVal(hasOverlap(have, notHave), false, 'add_not_have — no overlap');
})();

(function () {
  var have = [0, 30, 60, 100], notHave = [30, 60];
  set_have(have, notHave, [20, 80]);
  assertVal(hasOverlap(have, notHave), false, 'set_have — no overlap');
})();

(function () {
  var have = [30, 60], notHave = [0, 30, 60, 100];
  set_not_have(have, notHave, [20, 80]);
  assertVal(hasOverlap(have, notHave), false, 'set_not_have — no overlap');
})();

// ═══════════════════════════════════════════════════════════
//  Edge cases
// ═══════════════════════════════════════════════════════════
section('Edge cases');

(function () {
  var r = [0, 1000000];
  remove(r, [1, 2, 100, 200, 999998, 999999]);
  assert(r, [0, 1, 2, 100, 200, 999998, 999999, 1000000],
    'large range with small removals');
})();

(function () {
  var r = [];
  add(r, [5, 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11]);
  assert(r, [0, 11], 'add many overlapping unsorted — single merged range');
})();

(function () {
  var r = [10, 20];
  remove(r, [12, 14, 14, 16, 16, 18]);
  assert(r, [10, 12, 18, 20], 'remove contiguous removals');
})();

(function () {
  var r = [0, 10];
  remove(r, [0, 10, 0, 10]);
  assert(r, [], 'remove duplicate removal ranges');
})();

// ═══════════════════════════════════════════════════════════
//  UMD module shape
// ═══════════════════════════════════════════════════════════
section('UMD module shape');

(function () {
  var methods = [
    'add', 'remove', 'merge', 'invert', 'subtract_clip',
    'length', 'unknown', 'add_have', 'add_not_have',
    'set_have', 'set_not_have'
  ];
  var allPresent = true;
  for (var i = 0; i < methods.length; i++) {
    if (typeof flatRanges[methods[i]] !== 'function') {
      allPresent = false;
      break;
    }
  }
  assertVal(allPresent, true, 'all 11 methods exported');
  assertVal(typeof flatRanges.default, 'object', 'default export exists');
  assertVal(typeof flatRanges.default.add, 'function', 'default.add is a function');
})();

// ═══════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════

console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
if (failed === 0) {
  console.log('\u2713 All ' + passed + ' assertions passed!');
} else {
  console.log('\u2717 ' + failed + ' of ' + totalAssertions + ' assertions FAILED');
}
console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

if (failed > 0) { process.exit(1); }

// ═══════════════════════════════════════════════════════════
//  Performance benchmarks
// ═══════════════════════════════════════════════════════════

console.log('\n\u2501\u2501\u2501 Performance benchmarks \u2501\u2501\u2501\n');

function bench(label, setup, fn, iterations) {
  // warmup
  for (var w = 0; w < 100; w++) fn(setup());

  var start = performance.now();
  for (var i = 0; i < iterations; i++) fn(setup());
  var elapsed = performance.now() - start;
  var opsPerSec = Math.round(iterations / (elapsed / 1000));
  console.log('  ' + label + ': ' + opsPerSec.toLocaleString() + ' ops/sec (' + elapsed.toFixed(1) + 'ms / ' + iterations + ' iters)');
}

// Benchmark 1: add single range to large array
bench(
  'add 1 range into 10,000 ranges',
  function () {
    var r = [];
    for (var i = 0; i < 10000; i++) r.push(i * 3, i * 3 + 1);
    return r;
  },
  function (r) { add(r, [15000, 15002]); },
  50000
);

// Benchmark 2: add single range that merges many
bench(
  'add 1 range merging 1,000 ranges',
  function () {
    var r = [];
    for (var i = 0; i < 1000; i++) r.push(i * 3, i * 3 + 1);
    return r;
  },
  function (r) { add(r, [0, 3000]); },
  10000
);

// Benchmark 3: remove multiple holes from large range
bench(
  'remove 100 holes from [0, 100000)',
  function () { return [0, 100000]; },
  function (r) {
    var holes = [];
    for (var i = 0; i < 100; i++) holes.push(i * 1000 + 100, i * 1000 + 200);
    remove(r, holes);
  },
  50000
);

// Benchmark 4: sequential add — simulate streaming data
bench(
  'sequential add: 1,000 single ranges',
  function () { return []; },
  function (r) {
    for (var i = 0; i < 1000; i++) add(r, [i * 2, i * 2 + 1]);
  },
  1000
);

// Benchmark 5: set_have with large arrays
bench(
  'set_have: 500 ranges, new state = 500 ranges',
  function () {
    var have = [], notHave = [];
    for (var i = 0; i < 500; i++) have.push(i * 4, i * 4 + 2);
    for (var i = 0; i < 500; i++) notHave.push(i * 4 + 2, i * 4 + 4);
    return { have: have, notHave: notHave };
  },
  function (s) {
    var newHave = [];
    for (var i = 0; i < 500; i++) newHave.push(i * 4 + 1, i * 4 + 3);
    set_have(s.have, s.notHave, newHave);
  },
  5000
);

// Benchmark 6: unknown on large state
bench(
  'unknown: 5,000 have + 5,000 notHave',
  function () {
    var have = [], notHave = [];
    for (var i = 0; i < 5000; i++) have.push(i * 6, i * 6 + 2);
    for (var i = 0; i < 5000; i++) notHave.push(i * 6 + 2, i * 6 + 4);
    return { have: have, notHave: notHave };
  },
  function (s) { unknown(s.have, s.notHave, 0, 30000); },
  5000
);

console.log('');
