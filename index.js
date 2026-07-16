/**
 * flat-ranges v2.2.0
 * Lightweight utility for managing flat range lists: [from1, to1, from2, to2, ...]
 *
 * All ranges are half-open intervals [from, to) where from < to.
 * Empty ranges (from === to) are silently skipped.
 *
 * Merge semantics (v2.1.0 and later):
 *   Two ranges merge only when they overlap OR touch exactly (to === from).
 *   This matches standard half-open interval semantics: [0, 5) and [5, 10)
 *   merge because they touch at 5; but [0, 5) and [6, 10) stay separate
 *   because position 5 isn't in either range.
 *
 * v2.2.0 performance notes:
 *   - addOne has an O(1) append fast path (the most common real-world
 *     workload: chunks arriving in order at the tail).
 *   - Arrays are grown with push() rather than `.length = n + 2`.
 *     Growing via .length creates holes and permanently converts the
 *     array to V8's HOLEY elements kind, slowing every later read.
 *   - remove() has an O(1) fast-reject when the removal window falls
 *     entirely outside the covered span, and never touches the array
 *     when nothing changed.
 *   - Deliberately NOT using copyWithin: measured ~10x slower than a
 *     plain indexed loop for this access pattern on V8.
 *
 * UMD — works with CommonJS (require), AMD (define), ES modules (import), and browser globals.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    var api = factory();
    module.exports = api;
    module.exports.default = api;
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    root.flatRanges = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // ────────────────────────────────────────────────────
  //  Internal: insert a single [from, to) into sorted ranges.
  //  Uses binary search to find the merge zone — O(log n + k)
  //  where k is the number of ranges absorbed by the merge.
  //  Zero allocations on the hot path.
  //
  //  Merge rule: ranges merge when they overlap or touch exactly
  //  (existing.to === new.from, or new.to === existing.from).
  // ────────────────────────────────────────────────────
  function addOne(ranges, from, to) {
    if (from >= to) return false;
    var n = ranges.length;

    if (n === 0) {
      ranges.push(from, to);
      return true;
    }

    // ── Append fast path ──────────────────────────────
    // The most common real-world workload (download chunks,
    // media buffering, log ingestion) appends at or near the
    // end. Handle it in O(1) without binary search.
    var lastTo = ranges[n - 1];
    if (from > lastTo) {
      ranges.push(from, to);          // strictly after — pure append
      return true;
    }
    if (from >= ranges[n - 2]) {
      // touches or overlaps only the last range — extend it
      if (to <= lastTo) return false; // fully contained, no change
      ranges[n - 1] = to;
      return true;
    }

    // Binary search: first pair whose `to` >= from (could merge at start).
    // Anything with to < from is strictly before and can't merge.
    var lo = 0, hi = (n >> 1);
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (ranges[(mid << 1) + 1] < from) lo = mid + 1;
      else hi = mid;
    }
    var mergeStart = lo;

    // Binary search: first pair whose `from` > to (past merge zone).
    // Anything with from <= to still overlaps or touches.
    lo = mergeStart; hi = (n >> 1);
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (ranges[mid << 1] <= to) lo = mid + 1;
      else hi = mid;
    }
    var mergeEnd = lo;

    if (mergeStart === mergeEnd) {
      // No overlap/adjacency — pure insert, shift right by 2.
      //
      // IMPORTANT: grow with push(), NOT `ranges.length = n + 2`.
      // Growing via .length creates holes, which permanently
      // converts the array to V8's HOLEY elements kind and slows
      // down every subsequent read (~3x measured on sequential
      // builds). push() keeps the array PACKED.
      var ins = mergeStart << 1;
      ranges.push(ranges[n - 2], ranges[n - 1]);
      for (var i = n - 1; i >= ins + 2; i--) {
        ranges[i] = ranges[i - 2];
      }
      ranges[ins] = from;
      ranges[ins + 1] = to;
      return true;
    }

    // Compute merged bounds
    var ms2 = mergeStart << 1;
    var newFrom = from < ranges[ms2] ? from : ranges[ms2];
    var me2 = ((mergeEnd - 1) << 1) + 1;
    var newTo = to > ranges[me2] ? to : ranges[me2];

    // Check: did anything actually change?
    if (mergeEnd - mergeStart === 1 && newFrom === ranges[ms2] && newTo === ranges[ms2 + 1]) {
      return false;
    }

    // Write merged pair
    ranges[ms2] = newFrom;
    ranges[ms2 + 1] = newTo;

    // Collapse: remove absorbed pairs
    var removeCount = (mergeEnd - mergeStart - 1) << 1;
    if (removeCount > 0) {
      var dst = ms2 + 2;
      var src = mergeEnd << 1;
      while (src < n) {
        ranges[dst++] = ranges[src++];
      }
      ranges.length = n - removeCount;
    }

    return true;
  }

  // ────────────────────────────────────────────────────
  //  Internal: sort a flat range array by `from`.
  //  Returns a new sorted flat array. Skips empty ranges.
  // ────────────────────────────────────────────────────
  function sortFlat(arr) {
    var pairs = (arr.length >> 1);
    var indices = new Array(pairs);
    var count = 0;
    for (var i = 0; i < pairs; i++) {
      if (arr[i << 1] < arr[(i << 1) + 1]) {
        indices[count++] = i;
      }
    }
    indices.length = count;
    indices.sort(function (a, b) { return arr[a << 1] - arr[b << 1]; });

    var sorted = new Array(count << 1);
    for (var i = 0; i < count; i++) {
      var idx = indices[i] << 1;
      sorted[i << 1] = arr[idx];
      sorted[(i << 1) + 1] = arr[idx + 1];
    }
    return sorted;
  }

  // ────────────────────────────────────────────────────
  //  Internal: two-pointer merge of two SORTED flat range
  //  arrays into a single merged array. O(n + m).
  //
  //  Merge rule: ranges merge when they overlap or touch exactly.
  // ────────────────────────────────────────────────────
  function mergeTwoSorted(a, b) {
    var result = [];
    var i = 0, j = 0;
    var na = a.length, nb = b.length;
    var from, to;

    while (i < na || j < nb) {
      // Pick the range with the smaller `from`
      if (i < na && (j >= nb || a[i] <= b[j])) {
        from = a[i]; to = a[i + 1]; i += 2;
      } else {
        from = b[j]; to = b[j + 1]; j += 2;
      }
      if (from >= to) continue;

      if (result.length > 0 && from <= result[result.length - 1]) {
        if (to > result[result.length - 1]) {
          result[result.length - 1] = to;
        }
      } else {
        result.push(from, to);
      }
    }
    return result;
  }

  // ────────────────────────────────────────────────────
  //  add(ranges, newRanges)
  //
  //  Small newRanges (≤6 pairs): addOne loop — O(k * (log n + m))
  //  Large newRanges: sort + two-pointer merge — O((n+k) log(n+k))
  // ────────────────────────────────────────────────────
  var ADD_ONE_THRESHOLD = 12; // pairs * 2

  function add(ranges, newRanges) {
    if (newRanges.length === 0) return false;

    // Fast path: single range (most common case)
    if (newRanges.length === 2) {
      return addOne(ranges, newRanges[0], newRanges[1]);
    }

    // Small batch: addOne loop avoids sort overhead
    if (newRanges.length <= ADD_ONE_THRESHOLD) {
      var changed = false;
      for (var i = 0; i < newRanges.length; i += 2) {
        if (addOne(ranges, newRanges[i], newRanges[i + 1])) {
          changed = true;
        }
      }
      return changed;
    }

    // Large batch: sort newRanges, merge two sorted lists
    var sorted = sortFlat(newRanges);
    var merged = mergeTwoSorted(ranges, sorted);

    var changed = false;
    if (merged.length !== ranges.length) {
      changed = true;
    } else {
      for (var i = 0; i < merged.length; i++) {
        if (merged[i] !== ranges[i]) {
          changed = true;
          break;
        }
      }
    }

    ranges.length = merged.length;
    for (var i = 0; i < merged.length; i++) {
      ranges[i] = merged[i];
    }

    return changed;
  }

  // ────────────────────────────────────────────────────
  //  remove(ranges, removeRanges)
  //  Two-pointer sweep, O(n + m). Inlined iteration
  //  (no closure/function overhead).
  // ────────────────────────────────────────────────────
  function remove(ranges, removeRanges) {
    var rn = removeRanges.length;
    var n = ranges.length;
    if (rn === 0 || n === 0) return false;

    // ── Fast reject ───────────────────────────────────
    // Removal window entirely before or after our span →
    // nothing can change. O(1), ~9x measured speedup for
    // the common "remove misses everything" case.
    if (removeRanges[rn - 1] <= ranges[0] || removeRanges[0] >= ranges[n - 1]) {
      return false;
    }

    var result = [];
    var i = 0, j = 0;
    var changed = false;
    var curFrom, curTo;

    // Advance to first non-empty range
    while (i < n && ranges[i] >= ranges[i + 1]) i += 2;
    if (i >= n) return false;
    curFrom = ranges[i]; curTo = ranges[i + 1]; i += 2;

    while (j < rn) {
      var bFrom = removeRanges[j];
      var bTo = removeRanges[j + 1];

      if (bFrom >= bTo) { j += 2; continue; }

      if (curTo <= bFrom) {
        // Current entirely before removal — keep, advance range
        result.push(curFrom, curTo);
        // Next non-empty range
        while (i < n && ranges[i] >= ranges[i + 1]) i += 2;
        if (i >= n) { curFrom = curTo = -1; break; }
        curFrom = ranges[i]; curTo = ranges[i + 1]; i += 2;
      } else if (curFrom >= bTo) {
        // Removal entirely before current — advance removal
        j += 2;
      } else {
        changed = true;
        if (curFrom < bFrom) {
          result.push(curFrom, bFrom);
        }
        if (curTo > bTo) {
          // Right tail survives — recheck against next removal
          curFrom = bTo;
          j += 2;
        } else {
          // Range fully consumed — advance range
          while (i < n && ranges[i] >= ranges[i + 1]) i += 2;
          if (i >= n) { curFrom = curTo = -1; break; }
          curFrom = ranges[i]; curTo = ranges[i + 1]; i += 2;
        }
      }
    }

    // Flush current + remaining ranges
    if (curFrom < curTo) {
      result.push(curFrom, curTo);
    }
    while (i < n) {
      if (ranges[i] < ranges[i + 1]) {
        result.push(ranges[i], ranges[i + 1]);
      }
      i += 2;
    }

    if (!changed) {
      if (result.length !== n) {
        changed = true;
      } else {
        for (var k = 0; k < result.length; k++) {
          if (ranges[k] !== result[k]) { changed = true; break; }
        }
      }
      // Nothing changed → don't touch the array at all.
      // Skipping the writeback gives ~3.5x on "removal falls
      // in a gap" and keeps the caller's array untouched.
      if (!changed) return false;
    }

    ranges.length = result.length;
    for (var k = 0; k < result.length; k++) {
      ranges[k] = result[k];
    }

    return changed;
  }

  // ────────────────────────────────────────────────────
  //  merge(flatRanges)
  //  Input must be sorted. Returns new array.
  // ────────────────────────────────────────────────────
  function merge(flatRanges) {
    var result = [];
    for (var i = 0; i < flatRanges.length; i += 2) {
      var from = flatRanges[i];
      var to = flatRanges[i + 1];
      if (from >= to) continue;
      var rn = result.length;
      if (rn > 0 && from <= result[rn - 1]) {
        if (to > result[rn - 1]) result[rn - 1] = to;
      } else {
        result.push(from, to);
      }
    }
    return result;
  }

  // ────────────────────────────────────────────────────
  //  invert(ranges, fullStart, fullEnd)
  // ────────────────────────────────────────────────────
  function invert(ranges, fullStart, fullEnd) {
    var result = [];
    var last = fullStart;

    for (var i = 0; i < ranges.length; i += 2) {
      var from = ranges[i];
      var to = ranges[i + 1];
      if (from >= to) continue;
      if (from > last) result.push(last, from);
      if (to > last) last = to;
    }

    if (last < fullEnd) result.push(last, fullEnd);
    return result;
  }

  // ────────────────────────────────────────────────────
  //  subtract_clip(baseRanges, subtractRanges)
  //  Returns subtractRanges \ baseRanges. No mutation.
  // ────────────────────────────────────────────────────
  function subtract_clip(baseRanges, subtractRanges) {
    if (baseRanges.length === 0) return subtractRanges.slice();
    if (subtractRanges.length === 0) return [];
    var copy = subtractRanges.slice();
    remove(copy, baseRanges);
    return copy;
  }

  // ────────────────────────────────────────────────────
  //  length(ranges)
  // ────────────────────────────────────────────────────
  function length(ranges) {
    var total = 0;
    for (var i = 0; i < ranges.length; i += 2) {
      var span = ranges[i + 1] - ranges[i];
      if (span > 0) total += span;
    }
    return total;
  }

  // ────────────────────────────────────────────────────
  //  contains(ranges, value)
  //  Test whether `value` falls inside any range. O(log n)
  //  via binary search, zero allocations.
  //
  //    contains([0, 10, 20, 30], 5)  → true
  //    contains([0, 10, 20, 30], 10) → false  (half-open)
  //    contains([0, 10, 20, 30], 25) → true
  //    contains([], 5)               → false
  // ────────────────────────────────────────────────────
  function contains(ranges, value) {
    var pairs = ranges.length >> 1;
    if (pairs === 0) return false;

    // Find the largest pair index whose `from` is ≤ value
    var lo = 0, hi = pairs - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (ranges[mid << 1] <= value) lo = mid;
      else hi = mid - 1;
    }
    var idx = lo << 1;
    return ranges[idx] <= value && value < ranges[idx + 1];
  }

  // ────────────────────────────────────────────────────
  //  intersect(a, b)
  //  Returns ranges covered by BOTH a and b. Two-pointer
  //  sweep, O(n + m), no mutation. Both inputs must be
  //  sorted and non-overlapping (the library invariant).
  //
  //    intersect([0, 10, 20, 30], [5, 25])  → [5, 10, 20, 25]
  //    intersect([0, 10], [10, 20])         → []  (half-open: touch ≠ overlap)
  // ────────────────────────────────────────────────────
  function intersect(a, b) {
    var result = [];
    var i = 0, j = 0;
    var na = a.length, nb = b.length;
    while (i < na && j < nb) {
      var from = a[i] > b[j] ? a[i] : b[j];
      var to = a[i + 1] < b[j + 1] ? a[i + 1] : b[j + 1];
      if (from < to) result.push(from, to);
      // advance whichever range ends first
      if (a[i + 1] < b[j + 1]) i += 2;
      else j += 2;
    }
    return result;
  }

  // ────────────────────────────────────────────────────
  //  overlaps(ranges, from, to)
  //  Boolean test: does [from, to) overlap ANY range?
  //  O(log n) binary search, zero allocations. Use this
  //  instead of subtract_clip/intersect when you only
  //  need a yes/no answer.
  //
  //    overlaps([0, 10, 20, 30], 5, 15)  → true
  //    overlaps([0, 10, 20, 30], 10, 20) → false  (half-open)
  // ────────────────────────────────────────────────────
  function overlaps(ranges, from, to) {
    if (from >= to) return false;
    var pairs = ranges.length >> 1;
    // Find first pair whose `to` > from
    var lo = 0, hi = pairs;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (ranges[(mid << 1) + 1] <= from) lo = mid + 1;
      else hi = mid;
    }
    return lo < pairs && ranges[lo << 1] < to;
  }

  // ────────────────────────────────────────────────────
  //  equal(a, b)
  //  Element-wise comparison of two flat range arrays.
  //  Assumes both are normalised (sorted, merged) — which
  //  is always true for arrays maintained by this library.
  // ────────────────────────────────────────────────────
  function equal(a, b) {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // ────────────────────────────────────────────────────
  //  first_unknown(have, notHave, min, max[, maxLen])
  //  Returns the FIRST unknown gap in [min, max) as a
  //  [from, to] pair, or null if everything is known.
  //  Optionally clips the gap to maxLen units.
  //
  //  This is the allocation-free answer to "what chunk
  //  should I request next?" — unlike unknown(), it does
  //  not build the full result array.
  //
  //    first_unknown([0, 30], [60, 100], 0, 100)        → [30, 60]
  //    first_unknown([0, 30], [60, 100], 0, 100, 16)    → [30, 46]
  //    first_unknown([0, 100], [], 0, 100)              → null
  // ────────────────────────────────────────────────────
  function first_unknown(have_ranges, not_have_ranges, min, max, maxLen) {
    var pos = min;
    var i = 0, j = 0;
    var nh = have_ranges.length, nn = not_have_ranges.length;

    // Advance pos past every covering range (from either list)
    var advanced = true;
    while (advanced && pos < max) {
      advanced = false;
      while (i < nh && have_ranges[i + 1] <= pos) i += 2;
      if (i < nh && have_ranges[i] <= pos) {
        pos = have_ranges[i + 1];
        advanced = true;
      }
      while (j < nn && not_have_ranges[j + 1] <= pos) j += 2;
      if (j < nn && not_have_ranges[j] <= pos) {
        pos = not_have_ranges[j + 1];
        advanced = true;
      }
    }
    if (pos >= max) return null;

    // pos is unknown — gap ends at the nearest covering range or max
    var end = max;
    if (i < nh && have_ranges[i] < end) end = have_ranges[i];
    if (j < nn && not_have_ranges[j] < end) end = not_have_ranges[j];
    if (maxLen != null && end - pos > maxLen) end = pos + maxLen;

    return [pos, end];
  }

  // ────────────────────────────────────────────────────
  //  unknown(have, notHave, min, max)
  // ────────────────────────────────────────────────────
  function unknown(have_ranges, not_have_ranges, min, max) {
    // Both inputs are already sorted — use mergeTwoSorted directly
    var all = mergeTwoSorted(have_ranges, not_have_ranges);
    return invert(all, min, max);
  }

  // ────────────────────────────────────────────────────
  //  Have / Not-Have state management
  // ────────────────────────────────────────────────────

  function add_have(knownHave, knownNotHave, newHave) {
    if (newHave.length === 0) return false;
    var clean = subtract_clip(knownNotHave, newHave);
    if (clean.length === 0) return false;
    return add(knownHave, clean);
  }

  function add_not_have(knownHave, knownNotHave, newNotHave) {
    if (newNotHave.length === 0) return false;
    var clean = subtract_clip(knownHave, newNotHave);
    if (clean.length === 0) return false;
    return add(knownNotHave, clean);
  }

  /**
   * set_have: authoritatively sets knownHave to newHave.
   *
   * Optimised single-pass logic:
   *   newKnownNotHave = (knownHave ∪ knownNotHave) \ newHave
   *   knownHave       = normalised newHave
   */
  function set_have(knownHave, knownNotHave, newHave) {
    var changed = false;

    // Merge old have+notHave (both sorted), then remove newHave → new notHave
    var combined = mergeTwoSorted(knownHave, knownNotHave);
    remove(combined, newHave);

    // Update knownNotHave
    if (combined.length !== knownNotHave.length) {
      changed = true;
    } else {
      for (var i = 0; i < combined.length; i++) {
        if (combined[i] !== knownNotHave[i]) { changed = true; break; }
      }
    }
    knownNotHave.length = combined.length;
    for (var i = 0; i < combined.length; i++) knownNotHave[i] = combined[i];

    // Normalise newHave into knownHave
    var tmp = [];
    add(tmp, newHave);

    if (tmp.length !== knownHave.length) {
      changed = true;
    } else {
      for (var i = 0; i < tmp.length; i++) {
        if (tmp[i] !== knownHave[i]) { changed = true; break; }
      }
    }
    knownHave.length = tmp.length;
    for (var i = 0; i < tmp.length; i++) knownHave[i] = tmp[i];

    return changed;
  }

  /**
   * set_not_have: authoritatively sets knownNotHave to newNotHave.
   *
   *   newKnownHave    = (knownHave ∪ knownNotHave) \ newNotHave
   *   knownNotHave    = normalised newNotHave
   */
  function set_not_have(knownHave, knownNotHave, newNotHave) {
    var changed = false;

    var combined = mergeTwoSorted(knownHave, knownNotHave);
    remove(combined, newNotHave);

    // Update knownHave
    if (combined.length !== knownHave.length) {
      changed = true;
    } else {
      for (var i = 0; i < combined.length; i++) {
        if (combined[i] !== knownHave[i]) { changed = true; break; }
      }
    }
    knownHave.length = combined.length;
    for (var i = 0; i < combined.length; i++) knownHave[i] = combined[i];

    // Normalise newNotHave into knownNotHave
    var tmp = [];
    add(tmp, newNotHave);

    if (tmp.length !== knownNotHave.length) {
      changed = true;
    } else {
      for (var i = 0; i < tmp.length; i++) {
        if (tmp[i] !== knownNotHave[i]) { changed = true; break; }
      }
    }
    knownNotHave.length = tmp.length;
    for (var i = 0; i < tmp.length; i++) knownNotHave[i] = tmp[i];

    return changed;
  }

  return {
    add: add,
    remove: remove,
    merge: merge,
    invert: invert,
    intersect: intersect,
    subtract_clip: subtract_clip,
    length: length,
    contains: contains,
    overlaps: overlaps,
    equal: equal,
    unknown: unknown,
    first_unknown: first_unknown,
    add_have: add_have,
    add_not_have: add_not_have,
    set_have: set_have,
    set_not_have: set_not_have
  };

}));
