//! flat-ranges — Rust port of flat-ranges.js v2.2.0
//!
//! Manages flat range lists: `[from1, to1, from2, to2, ...]`
//!
//! All ranges are half-open intervals `[from, to)` where `from < to`.
//! Empty ranges (`from == to`) are silently skipped.
//!
//! Merge rule: two ranges merge only when they overlap OR touch exactly
//! (`existing.to == new.from`). This matches standard half-open interval
//! semantics: `[0, 5)` and `[5, 10)` merge because they touch at 5, but
//! `[0, 5)` and `[6, 10)` stay separate.
//!
//! ## Type choice
//! We use `f64` for range endpoints so that both integers (byte offsets, IDs)
//! and non-integer values (scheduling: `12.5` = 12:30) work in one API,
//! matching the JS original. If you only need integers, use `.round() as u64`
//! at call sites.
//!
//! License: MIT

/// The core type — a sorted, non-overlapping list of `[from, to)` pairs
/// stored as `[from1, to1, from2, to2, ...]`.
pub type FlatRanges = Vec<f64>;

const ADD_ONE_THRESHOLD: usize = 12;

// ═══════════════════════════════════════════════════════════════════════
//  Internal: insert a single [from, to) into sorted ranges.
//  Binary search for the merge zone — O(log n + k).
// ═══════════════════════════════════════════════════════════════════════
fn add_one(ranges: &mut Vec<f64>, from: f64, to: f64) -> bool {
    if from >= to {
        return false;
    }
    let n = ranges.len();

    if n == 0 {
        ranges.push(from);
        ranges.push(to);
        return true;
    }

    // ── Append fast path: strictly after or touching the tail ──
    let last_to = ranges[n - 1];
    if from > last_to {
        ranges.push(from);
        ranges.push(to);
        return true;
    }
    if from >= ranges[n - 2] {
        // touches or overlaps only the last range — extend it
        if to <= last_to {
            return false; // fully contained, no change
        }
        ranges[n - 1] = to;
        return true;
    }

    // Binary search: first pair whose `to` >= from (could merge at start).
    let mut lo = 0usize;
    let mut hi = n >> 1;
    while lo < hi {
        let mid = (lo + hi) >> 1;
        if ranges[(mid << 1) + 1] < from {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    let merge_start = lo;

    // Binary search: first pair whose `from` > to (past merge zone).
    lo = merge_start;
    hi = n >> 1;
    while lo < hi {
        let mid = (lo + hi) >> 1;
        if ranges[mid << 1] <= to {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    let merge_end = lo;

    if merge_start == merge_end {
        // Pure insert — shift right by 2
        let ins = merge_start << 1;
        ranges.push(ranges[n - 2]);
        ranges.push(ranges[n - 1]);
        // Shift the tail — careful with usize underflow
        let mut i = n - 1;
        while i >= ins + 2 {
            ranges[i] = ranges[i - 2];
            if i == 0 { break; }
            i -= 1;
        }
        ranges[ins] = from;
        ranges[ins + 1] = to;
        return true;
    }

    // Compute merged bounds
    let ms2 = merge_start << 1;
    let new_from = from.min(ranges[ms2]);
    let me2 = ((merge_end - 1) << 1) + 1;
    let new_to = to.max(ranges[me2]);

    // Did anything actually change?
    if merge_end - merge_start == 1
        && new_from == ranges[ms2]
        && new_to == ranges[ms2 + 1]
    {
        return false;
    }

    ranges[ms2] = new_from;
    ranges[ms2 + 1] = new_to;

    // Collapse: remove absorbed pairs
    let remove_count = (merge_end - merge_start - 1) << 1;
    if remove_count > 0 {
        let mut dst = ms2 + 2;
        let mut src = merge_end << 1;
        while src < n {
            ranges[dst] = ranges[src];
            dst += 1;
            src += 1;
        }
        ranges.truncate(n - remove_count);
    }

    true
}

// Internal: sort a flat range array by `from`, skipping empty ranges.
fn sort_flat(arr: &[f64]) -> Vec<f64> {
    let pairs = arr.len() >> 1;
    let mut indices: Vec<usize> = (0..pairs)
        .filter(|&i| arr[i << 1] < arr[(i << 1) + 1])
        .collect();
    indices.sort_by(|&a, &b| {
        arr[a << 1].partial_cmp(&arr[b << 1]).unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut sorted = Vec::with_capacity(indices.len() << 1);
    for &idx in &indices {
        let i = idx << 1;
        sorted.push(arr[i]);
        sorted.push(arr[i + 1]);
    }
    sorted
}

// Internal: two-pointer merge of two SORTED flat range arrays. O(n + m).
fn merge_two_sorted(a: &[f64], b: &[f64]) -> Vec<f64> {
    let mut result: Vec<f64> = Vec::new();
    let mut i = 0usize;
    let mut j = 0usize;
    let na = a.len();
    let nb = b.len();

    while i < na || j < nb {
        let (from, to) = if i < na && (j >= nb || a[i] <= b[j]) {
            let v = (a[i], a[i + 1]);
            i += 2;
            v
        } else {
            let v = (b[j], b[j + 1]);
            j += 2;
            v
        };
        if from >= to {
            continue;
        }

        let rn = result.len();
        if rn > 0 && from <= result[rn - 1] {
            if to > result[rn - 1] {
                result[rn - 1] = to;
            }
        } else {
            result.push(from);
            result.push(to);
        }
    }
    result
}

// ═══════════════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════════════

/// Adds ranges and merges overlaps/adjacents. Returns `true` if `ranges`
/// changed. Input doesn't need to be sorted. Appending at or after the
/// tail is an O(1) fast path.
pub fn add(ranges: &mut Vec<f64>, new_ranges: &[f64]) -> bool {
    if new_ranges.is_empty() {
        return false;
    }

    if new_ranges.len() == 2 {
        return add_one(ranges, new_ranges[0], new_ranges[1]);
    }

    if new_ranges.len() <= ADD_ONE_THRESHOLD {
        let mut changed = false;
        let mut i = 0;
        while i < new_ranges.len() {
            if add_one(ranges, new_ranges[i], new_ranges[i + 1]) {
                changed = true;
            }
            i += 2;
        }
        return changed;
    }

    let sorted = sort_flat(new_ranges);
    let merged = merge_two_sorted(ranges, &sorted);

    let changed = merged != *ranges;
    *ranges = merged;
    changed
}

/// Removes ranges. Splits when cut in the middle.
///
/// **Contract:** `remove_ranges` must be sorted by `from` and non-overlapping
/// (always true for arrays maintained by this library). If your input might
/// be unsorted, normalise it first with `add(&mut vec![], input)`.
pub fn remove(ranges: &mut Vec<f64>, remove_ranges: &[f64]) -> bool {
    let rn = remove_ranges.len();
    let n = ranges.len();
    if rn == 0 || n == 0 {
        return false;
    }

    // Fast reject: removal window entirely outside our span
    if remove_ranges[rn - 1] <= ranges[0] || remove_ranges[0] >= ranges[n - 1] {
        return false;
    }

    let mut result: Vec<f64> = Vec::new();
    let mut i = 0usize;
    let mut j = 0usize;
    let mut changed = false;

    // Advance to first non-empty range
    while i < n && ranges[i] >= ranges[i + 1] {
        i += 2;
    }
    if i >= n {
        return false;
    }
    let mut cur_from = ranges[i];
    let mut cur_to = ranges[i + 1];
    i += 2;
    let mut exhausted = false;

    while j < rn {
        let b_from = remove_ranges[j];
        let b_to = remove_ranges[j + 1];

        if b_from >= b_to {
            j += 2;
            continue;
        }

        if cur_to <= b_from {
            // Current entirely before removal — keep, advance range
            result.push(cur_from);
            result.push(cur_to);
            while i < n && ranges[i] >= ranges[i + 1] {
                i += 2;
            }
            if i >= n {
                exhausted = true;
                break;
            }
            cur_from = ranges[i];
            cur_to = ranges[i + 1];
            i += 2;
        } else if cur_from >= b_to {
            j += 2;
        } else {
            changed = true;
            if cur_from < b_from {
                result.push(cur_from);
                result.push(b_from);
            }
            if cur_to > b_to {
                cur_from = b_to;
                j += 2;
            } else {
                while i < n && ranges[i] >= ranges[i + 1] {
                    i += 2;
                }
                if i >= n {
                    exhausted = true;
                    break;
                }
                cur_from = ranges[i];
                cur_to = ranges[i + 1];
                i += 2;
            }
        }
    }

    if !exhausted && cur_from < cur_to {
        result.push(cur_from);
        result.push(cur_to);
    }
    while i < n {
        if ranges[i] < ranges[i + 1] {
            result.push(ranges[i]);
            result.push(ranges[i + 1]);
        }
        i += 2;
    }

    if !changed {
        if result.len() != n {
            changed = true;
        } else {
            for k in 0..result.len() {
                if ranges[k] != result[k] {
                    changed = true;
                    break;
                }
            }
        }
        if !changed {
            return false;
        }
    }

    *ranges = result;
    changed
}

/// Merges overlapping/adjacent ranges. Returns a **new** array. Input must be sorted.
pub fn merge(flat_ranges: &[f64]) -> Vec<f64> {
    let mut result: Vec<f64> = Vec::new();
    let mut i = 0;
    while i < flat_ranges.len() {
        let from = flat_ranges[i];
        let to = flat_ranges[i + 1];
        i += 2;
        if from >= to {
            continue;
        }
        let rn = result.len();
        if rn > 0 && from <= result[rn - 1] {
            if to > result[rn - 1] {
                result[rn - 1] = to;
            }
        } else {
            result.push(from);
            result.push(to);
        }
    }
    result
}

/// Returns everything in `[full_start, full_end)` NOT covered by ranges.
pub fn invert(ranges: &[f64], full_start: f64, full_end: f64) -> Vec<f64> {
    let mut result: Vec<f64> = Vec::new();
    let mut last = full_start;

    let mut i = 0;
    while i < ranges.len() {
        let from = ranges[i];
        let to = ranges[i + 1];
        i += 2;
        if from >= to {
            continue;
        }
        if from > last {
            result.push(last);
            result.push(from);
        }
        if to > last {
            last = to;
        }
    }

    if last < full_end {
        result.push(last);
        result.push(full_end);
    }
    result
}

/// Returns the ranges covered by **both** `a` and `b`. Two-pointer sweep, O(n + m).
pub fn intersect(a: &[f64], b: &[f64]) -> Vec<f64> {
    let mut result: Vec<f64> = Vec::new();
    let mut i = 0;
    let mut j = 0;
    let na = a.len();
    let nb = b.len();
    while i < na && j < nb {
        let from = a[i].max(b[j]);
        let to = a[i + 1].min(b[j + 1]);
        if from < to {
            result.push(from);
            result.push(to);
        }
        if a[i + 1] < b[j + 1] {
            i += 2;
        } else {
            j += 2;
        }
    }
    result
}

/// Returns parts of `subtract_ranges` that don't overlap `base_ranges`. No mutation.
pub fn subtract_clip(base_ranges: &[f64], subtract_ranges: &[f64]) -> Vec<f64> {
    if base_ranges.is_empty() {
        return subtract_ranges.to_vec();
    }
    if subtract_ranges.is_empty() {
        return Vec::new();
    }
    let mut copy = subtract_ranges.to_vec();
    remove(&mut copy, base_ranges);
    copy
}

/// Total covered length (sum of `to - from` for each pair).
pub fn length(ranges: &[f64]) -> f64 {
    let mut total = 0.0;
    let mut i = 0;
    while i < ranges.len() {
        let span = ranges[i + 1] - ranges[i];
        if span > 0.0 {
            total += span;
        }
        i += 2;
    }
    total
}

/// Tests whether a single value falls inside any range. O(log n).
pub fn contains(ranges: &[f64], value: f64) -> bool {
    let pairs = ranges.len() >> 1;
    if pairs == 0 {
        return false;
    }
    let mut lo = 0usize;
    let mut hi = pairs - 1;
    while lo < hi {
        let mid = (lo + hi + 1) >> 1;
        if ranges[mid << 1] <= value {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    let idx = lo << 1;
    ranges[idx] <= value && value < ranges[idx + 1]
}

/// Tests whether `[from, to)` overlaps ANY range. O(log n), zero allocations.
pub fn overlaps(ranges: &[f64], from: f64, to: f64) -> bool {
    if from >= to {
        return false;
    }
    let pairs = ranges.len() >> 1;
    let mut lo = 0usize;
    let mut hi = pairs;
    while lo < hi {
        let mid = (lo + hi) >> 1;
        if ranges[(mid << 1) + 1] <= from {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    lo < pairs && ranges[lo << 1] < to
}

/// Element-wise equality of two flat range arrays.
pub fn equal(a: &[f64], b: &[f64]) -> bool {
    a == b
}

/// Returns the **first** unknown gap in `[min, max)` as `Some((from, to))`,
/// or `None` if everything is known. Optionally clips the gap to `max_len` units.
pub fn first_unknown(
    have_ranges: &[f64],
    not_have_ranges: &[f64],
    min: f64,
    max: f64,
    max_len: Option<f64>,
) -> Option<(f64, f64)> {
    let mut pos = min;
    let mut i = 0usize;
    let mut j = 0usize;
    let nh = have_ranges.len();
    let nn = not_have_ranges.len();

    let mut advanced = true;
    while advanced && pos < max {
        advanced = false;
        while i < nh && have_ranges[i + 1] <= pos {
            i += 2;
        }
        if i < nh && have_ranges[i] <= pos {
            pos = have_ranges[i + 1];
            advanced = true;
        }
        while j < nn && not_have_ranges[j + 1] <= pos {
            j += 2;
        }
        if j < nn && not_have_ranges[j] <= pos {
            pos = not_have_ranges[j + 1];
            advanced = true;
        }
    }
    if pos >= max {
        return None;
    }

    let mut end = max;
    if i < nh && have_ranges[i] < end {
        end = have_ranges[i];
    }
    if j < nn && not_have_ranges[j] < end {
        end = not_have_ranges[j];
    }
    if let Some(ml) = max_len {
        if end - pos > ml {
            end = pos + ml;
        }
    }

    Some((pos, end))
}

/// Returns ranges in `[min, max)` not in `have` or `not_have`.
pub fn unknown(have_ranges: &[f64], not_have_ranges: &[f64], min: f64, max: f64) -> Vec<f64> {
    let all = merge_two_sorted(have_ranges, not_have_ranges);
    invert(&all, min, max)
}

// ─── Have / Not-Have state management ───────────────────────────────────

/// Adds to `have`, skipping anything already in `not_have`.
pub fn add_have(have: &mut Vec<f64>, not_have: &[f64], new_have: &[f64]) -> bool {
    if new_have.is_empty() {
        return false;
    }
    let clean = subtract_clip(not_have, new_have);
    if clean.is_empty() {
        return false;
    }
    add(have, &clean)
}

/// Adds to `not_have`, skipping anything already in `have`.
pub fn add_not_have(have: &[f64], not_have: &mut Vec<f64>, new_not_have: &[f64]) -> bool {
    if new_not_have.is_empty() {
        return false;
    }
    let clean = subtract_clip(have, new_not_have);
    if clean.is_empty() {
        return false;
    }
    add(not_have, &clean)
}

/// Authoritatively replaces `have`. Lost ranges move to `not_have`.
pub fn set_have(have: &mut Vec<f64>, not_have: &mut Vec<f64>, new_have: &[f64]) -> bool {
    let mut changed = false;

    let mut combined = merge_two_sorted(have, not_have);
    remove(&mut combined, new_have);

    if combined != *not_have {
        changed = true;
    }
    *not_have = combined;

    let mut tmp: Vec<f64> = Vec::new();
    add(&mut tmp, new_have);

    if tmp != *have {
        changed = true;
    }
    *have = tmp;

    changed
}

/// Authoritatively replaces `not_have`. Lost ranges move to `have`.
pub fn set_not_have(have: &mut Vec<f64>, not_have: &mut Vec<f64>, new_not_have: &[f64]) -> bool {
    let mut changed = false;

    let mut combined = merge_two_sorted(have, not_have);
    remove(&mut combined, new_not_have);

    if combined != *have {
        changed = true;
    }
    *have = combined;

    let mut tmp: Vec<f64> = Vec::new();
    add(&mut tmp, new_not_have);

    if tmp != *not_have {
        changed = true;
    }
    *not_have = tmp;

    changed
}

// ═══════════════════════════════════════════════════════════════════════
//  Tests — verified against README examples
// ═══════════════════════════════════════════════════════════════════════
#[cfg(test)]
mod tests {
    use super::*;

    macro_rules! r {
        ($($x:expr),* $(,)?) => { vec![$($x as f64),*] };
    }

    #[test]
    fn add_into_empty() {
        let mut a: Vec<f64> = vec![];
        assert!(add(&mut a, &r![0, 10]));
        assert_eq!(a, r![0, 10]);
    }

    #[test]
    fn add_merges_overlap() {
        let mut a = r![0, 5, 20, 25];
        assert!(add(&mut a, &r![4, 21]));
        assert_eq!(a, r![0, 25]);
    }

    #[test]
    fn add_append_fast_path() {
        let mut a = r![0, 10];
        assert!(add(&mut a, &r![20, 30]));
        assert_eq!(a, r![0, 10, 20, 30]);
    }

    #[test]
    fn add_no_change_returns_false() {
        let mut a = r![0, 10, 20, 30];
        assert!(!add(&mut a, &r![5, 8]));
        assert_eq!(a, r![0, 10, 20, 30]);
    }

    #[test]
    fn add_touching_merges() {
        let mut a = r![0, 5];
        assert!(add(&mut a, &r![5, 10]));
        assert_eq!(a, r![0, 10]);
    }

    #[test]
    fn add_non_touching_stays_separate() {
        let mut a = r![0, 5];
        assert!(add(&mut a, &r![6, 10]));
        assert_eq!(a, r![0, 5, 6, 10]);
    }

    #[test]
    fn add_insert_in_middle() {
        let mut a = r![0, 5, 20, 25];
        assert!(add(&mut a, &r![10, 15]));
        assert_eq!(a, r![0, 5, 10, 15, 20, 25]);
    }

    #[test]
    fn add_large_batch() {
        let mut a = r![0, 10];
        assert!(add(&mut a, &r![50, 60, 30, 40, 70, 80, 100, 110, 90, 95, 200, 210, 220, 230]));
        assert_eq!(a, r![0, 10, 30, 40, 50, 60, 70, 80, 90, 95, 100, 110, 200, 210, 220, 230]);
    }

    #[test]
    fn remove_splits_middle() {
        let mut a = r![0, 100];
        assert!(remove(&mut a, &r![10, 20, 50, 60]));
        assert_eq!(a, r![0, 10, 20, 50, 60, 100]);
    }

    #[test]
    fn remove_fast_reject_before() {
        let mut a = r![100, 200];
        assert!(!remove(&mut a, &r![0, 50]));
        assert_eq!(a, r![100, 200]);
    }

    #[test]
    fn remove_fast_reject_after() {
        let mut a = r![0, 100];
        assert!(!remove(&mut a, &r![200, 300]));
        assert_eq!(a, r![0, 100]);
    }

    #[test]
    fn merge_overlaps() {
        assert_eq!(merge(&r![0, 5, 3, 8]), r![0, 8]);
    }

    #[test]
    fn merge_touching() {
        assert_eq!(merge(&r![0, 5, 5, 10]), r![0, 10]);
    }

    #[test]
    fn invert_readme_example() {
        assert_eq!(invert(&r![10, 20, 30, 40], 0.0, 50.0), r![0, 10, 20, 30, 40, 50]);
    }

    #[test]
    fn intersect_partial() {
        assert_eq!(intersect(&r![0, 10, 20, 30], &r![5, 25]), r![5, 10, 20, 25]);
    }

    #[test]
    fn intersect_touching_is_empty() {
        assert_eq!(intersect(&r![0, 10], &r![10, 20]), Vec::<f64>::new());
    }

    #[test]
    fn length_sums_spans() {
        assert_eq!(length(&r![0, 10, 20, 30]), 20.0);
    }

    #[test]
    fn contains_inside() {
        assert!(contains(&r![0, 10, 20, 30], 5.0));
    }

    #[test]
    fn contains_at_upper_bound_is_false() {
        assert!(!contains(&r![0, 10, 20, 30], 10.0));
    }

    #[test]
    fn contains_in_second_range() {
        assert!(contains(&r![0, 10, 20, 30], 25.0));
    }

    #[test]
    fn contains_in_gap() {
        assert!(!contains(&r![0, 10, 20, 30], 15.0));
    }

    #[test]
    fn contains_empty() {
        assert!(!contains(&r![], 5.0));
    }

    #[test]
    fn overlaps_crossing_gap() {
        assert!(overlaps(&r![0, 10, 20, 30], 5.0, 15.0));
    }

    #[test]
    fn overlaps_falls_exactly_in_gap() {
        assert!(!overlaps(&r![0, 10, 20, 30], 10.0, 20.0));
    }

    #[test]
    fn first_unknown_finds_gap() {
        assert_eq!(first_unknown(&r![0, 30], &r![60, 100], 0.0, 100.0, None), Some((30.0, 60.0)));
    }

    #[test]
    fn first_unknown_clips_to_max_len() {
        assert_eq!(first_unknown(&r![0, 30], &r![60, 100], 0.0, 100.0, Some(16.0)), Some((30.0, 46.0)));
    }

    #[test]
    fn first_unknown_all_known() {
        assert_eq!(first_unknown(&r![0, 100], &r![], 0.0, 100.0, None), None);
    }

    #[test]
    fn unknown_returns_gaps() {
        assert_eq!(unknown(&r![0, 30], &r![60, 100], 0.0, 100.0), r![30, 60]);
    }

    #[test]
    fn add_have_skips_not_have() {
        let mut have: Vec<f64> = vec![];
        let not_have = r![40, 60];
        assert!(add_have(&mut have, &not_have, &r![0, 100]));
        assert_eq!(have, r![0, 40, 60, 100]);
    }

    #[test]
    fn add_not_have_skips_have() {
        let have = r![0, 50];
        let mut not_have: Vec<f64> = vec![];
        assert!(add_not_have(&have, &mut not_have, &r![30, 80]));
        assert_eq!(not_have, r![50, 80]);
    }

    #[test]
    fn set_have_moves_lost_to_not_have() {
        let mut have = r![0, 50];
        let mut not_have = r![50, 70];
        assert!(set_have(&mut have, &mut not_have, &r![30, 100]));
        assert_eq!(have, r![30, 100]);
        assert_eq!(not_have, r![0, 30]);
    }

    #[test]
    fn set_not_have_moves_lost_to_have() {
        let mut have = r![20, 40];
        let mut not_have = r![0, 20, 40, 60];
        assert!(set_not_have(&mut have, &mut not_have, &r![50, 80]));
        assert_eq!(not_have, r![50, 80]);
        assert_eq!(have, r![0, 50]);
    }

    #[test]
    fn chunked_download_scenario() {
        let mut have: Vec<f64> = vec![];
        let mut missing: Vec<f64> = vec![];

        add_have(&mut have, &missing, &r![0, 1024]);
        add_not_have(&have, &mut missing, &r![1024, 2048]);

        assert_eq!(first_unknown(&have, &missing, 0.0, 10000.0, Some(4096.0)), Some((2048.0, 6144.0)));
        assert_eq!(length(&have), 1024.0);
    }

    #[test]
    fn scheduling_with_floats() {
        let booked = r![9.0, 10.0, 11.0, 12.5, 14.0, 15.5];
        let free = invert(&booked, 8.0, 18.0);
        assert_eq!(free, r![8.0, 9.0, 10.0, 11.0, 12.5, 14.0, 15.5, 18.0]);
        // Note: README says 6.5, but actual math is 1 + 1 + 1.5 + 2.5 = 6.0 (README typo)
        assert_eq!(length(&free), 6.0);
        assert!(!overlaps(&booked, 13.0, 13.5));
    }

    #[test]
    fn p2p_sync_scenario() {
        let mut peer_have: Vec<f64> = vec![];
        let mut peer_not_have: Vec<f64> = vec![];

        set_have(&mut peer_have, &mut peer_not_have, &r![0, 500, 800, 1000]);
        set_have(&mut peer_have, &mut peer_not_have, &r![0, 300]);
        assert_eq!(peer_have, r![0, 300]);
        assert_eq!(peer_not_have, r![300, 500, 800, 1000]);

        assert_eq!(unknown(&peer_have, &peer_not_have, 0.0, 2000.0), r![500, 800, 1000, 2000]);
    }

    #[test]
    fn equal_works() {
        assert!(equal(&r![0, 10], &r![0, 10]));
        assert!(!equal(&r![0, 10], &r![0, 20]));
    }

    #[test]
    fn subtract_clip_returns_uncovered() {
        assert_eq!(subtract_clip(&r![20, 40], &r![0, 50]), r![0, 20, 40, 50]);
    }
}
