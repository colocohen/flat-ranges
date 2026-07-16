/**
 * flat-ranges v2.2.0 — TypeScript definitions
 *
 * Ranges are stored as flat arrays of half-open intervals:
 *   [from1, to1, from2, to2, ...]
 * where each [from, to) includes `from` and excludes `to`.
 *
 * After any library operation, range arrays are always sorted
 * and non-overlapping. Mutating functions work in place and
 * return `true` if the array changed.
 */

/**
 * A flat range list: [from1, to1, from2, to2, ...].
 * Always an even-length array of numbers.
 */
export type FlatRanges = number[];

/**
 * Adds ranges into `ranges`, merging overlapping/touching ranges.
 * `newRanges` does not need to be sorted. Mutates `ranges` in place.
 * @returns `true` if `ranges` changed.
 */
export function add(ranges: FlatRanges, newRanges: FlatRanges): boolean;

/**
 * Removes `removeRanges` from `ranges`, splitting ranges when cut
 * in the middle. Mutates `ranges` in place.
 *
 * NOTE: `removeRanges` MUST be sorted by `from` and non-overlapping.
 * @returns `true` if `ranges` changed.
 */
export function remove(ranges: FlatRanges, removeRanges: FlatRanges): boolean;

/**
 * Merges overlapping/touching ranges. Input must be sorted by `from`.
 * @returns a NEW normalised array; the input is not mutated.
 */
export function merge(flatRanges: FlatRanges): FlatRanges;

/**
 * Returns everything inside [fullStart, fullEnd) NOT covered by `ranges`.
 * @returns a NEW array; the input is not mutated.
 */
export function invert(ranges: FlatRanges, fullStart: number, fullEnd: number): FlatRanges;

/**
 * Returns the ranges covered by BOTH `a` and `b`.
 * Both inputs must be sorted and non-overlapping.
 * @returns a NEW array; inputs are not mutated.
 */
export function intersect(a: FlatRanges, b: FlatRanges): FlatRanges;

/**
 * Returns the parts of `subtractRanges` that do NOT overlap `baseRanges`.
 * @returns a NEW array; inputs are not mutated.
 */
export function subtract_clip(baseRanges: FlatRanges, subtractRanges: FlatRanges): FlatRanges;

/**
 * Total covered length across all ranges.
 */
export function length(ranges: FlatRanges): number;

/**
 * Tests whether a single value falls inside any range.
 * O(log n), zero allocations. Half-open: `contains([0,10], 10)` is `false`.
 */
export function contains(ranges: FlatRanges, value: number): boolean;

/**
 * Tests whether the interval [from, to) overlaps ANY range.
 * O(log n), zero allocations. Use instead of intersect()/subtract_clip()
 * when you only need a boolean.
 */
export function overlaps(ranges: FlatRanges, from: number, to: number): boolean;

/**
 * Element-wise equality of two flat range arrays.
 * Assumes both are normalised (always true for arrays maintained
 * by this library).
 */
export function equal(a: FlatRanges, b: FlatRanges): boolean;

/**
 * Returns the ranges inside [min, max) that are in neither `have`
 * nor `notHave`.
 * @returns a NEW array; inputs are not mutated.
 */
export function unknown(
  have: FlatRanges,
  notHave: FlatRanges,
  min: number,
  max: number
): FlatRanges;

/**
 * Returns the FIRST unknown gap inside [min, max) as a [from, to]
 * tuple, or `null` if everything is known. Optionally clips the gap
 * to `maxLen` units. Allocation-free scan — the efficient answer to
 * "which chunk should I request next?".
 */
export function first_unknown(
  have: FlatRanges,
  notHave: FlatRanges,
  min: number,
  max: number,
  maxLen?: number
): [number, number] | null;

/**
 * Adds `newHave` into `have`, skipping anything already in `notHave`.
 * Guarantees `have` and `notHave` never overlap. Mutates `have`.
 * @returns `true` if `have` changed.
 */
export function add_have(have: FlatRanges, notHave: FlatRanges, newHave: FlatRanges): boolean;

/**
 * Adds `newNotHave` into `notHave`, skipping anything already in `have`.
 * Guarantees `have` and `notHave` never overlap. Mutates `notHave`.
 * @returns `true` if `notHave` changed.
 */
export function add_not_have(have: FlatRanges, notHave: FlatRanges, newNotHave: FlatRanges): boolean;

/**
 * Authoritatively replaces `have` with `newHave`. Ranges that fell out
 * of the new state are moved to `notHave`. Mutates both arrays.
 * @returns `true` if either array changed.
 */
export function set_have(have: FlatRanges, notHave: FlatRanges, newHave: FlatRanges): boolean;

/**
 * Authoritatively replaces `notHave` with `newNotHave`. Ranges that fell
 * out of the new state are moved to `have`. Mutates both arrays.
 * @returns `true` if either array changed.
 */
export function set_not_have(have: FlatRanges, notHave: FlatRanges, newNotHave: FlatRanges): boolean;

declare const flatRanges: {
  add: typeof add;
  remove: typeof remove;
  merge: typeof merge;
  invert: typeof invert;
  intersect: typeof intersect;
  subtract_clip: typeof subtract_clip;
  length: typeof length;
  contains: typeof contains;
  overlaps: typeof overlaps;
  equal: typeof equal;
  unknown: typeof unknown;
  first_unknown: typeof first_unknown;
  add_have: typeof add_have;
  add_not_have: typeof add_not_have;
  set_have: typeof set_have;
  set_not_have: typeof set_not_have;
};

export default flatRanges;
