/**
 * flat-ranges v1.2.0
 * Lightweight utility for managing flat range lists: [from1, to1, from2, to2, ...]
 *
 * All ranges are half-open intervals [from, to) where from < to.
 * Empty ranges (from === to) are silently skipped.
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
  // ────────────────────────────────────────────────────
  function addOne(ranges, from, to) {
    if (from >= to) return false;
    var n = ranges.length;

    if (n === 0) {
      ranges.push(from, to);
      return true;
    }

    // Binary search: first pair whose `to` >= from - 1 (could merge at start)
    var lo = 0, hi = (n >> 1);
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (ranges[(mid << 1) + 1] < from - 1) lo = mid + 1;
      else hi = mid;
    }
    var mergeStart = lo;

    // Binary search: first pair whose `from` > to + 1 (past merge zone)
    lo = mergeStart; hi = (n >> 1);
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (ranges[mid << 1] <= to + 1) lo = mid + 1;
      else hi = mid;
    }
    var mergeEnd = lo;

    if (mergeStart === mergeEnd) {
      // No overlap/adjacency — pure insert, shift right by 2
      var ins = mergeStart << 1;
      ranges.length = n + 2;
      for (var i = n + 1; i >= ins + 2; i--) {
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

      if (result.length > 0 && from <= result[result.length - 1] + 1) {
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
    if (rn === 0) return false;

    var result = [];
    var n = ranges.length;
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
    subtract_clip: subtract_clip,
    length: length,
    unknown: unknown,
    add_have: add_have,
    add_not_have: add_not_have,
    set_have: set_have,
    set_not_have: set_not_have
  };

}));
