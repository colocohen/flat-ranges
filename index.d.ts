/**
 * flat-ranges v2.3.0 — TypeScript definitions
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

/**
 * Ranges on a circle of `size` positions, where size − 1 is followed by 0.
 *
 * A circular pair [from, to) runs forward from `from` to `to`; when
 * `to < from` it wraps past 0. Positions are taken modulo `size`,
 * `from === to` is empty, and `to − from >= size` is the whole circle.
 *
 * Arrays are stored in the ordinary canonical flat format: a run that
 * crosses 0 is kept as two pieces, [x, size) and [0, y). Functions that
 * take NEW ranges accept circular pairs; arrays the ring maintains are
 * passed as they are.
 */
export interface Ring {
  /** The circle size this ring was created with. */
  readonly size: number;

  /** Circular pairs → a NEW canonical array (sorted, merged, in [0, size)). */
  normalize(circular: FlatRanges): FlatRanges;

  /** Adds circular pairs into `ranges`. Mutates in place. @returns `true` if changed. */
  add(ranges: FlatRanges, circular: FlatRanges): boolean;

  /** Removes circular pairs from `ranges`. Any order is fine. Mutates in place. @returns `true` if changed. */
  remove(ranges: FlatRanges, circular: FlatRanges): boolean;

  /** Everything on the circle NOT covered. @returns a NEW array. */
  invert(ranges: FlatRanges): FlatRanges;

  /** Ranges covered by both `a` and `b` (both canonical). @returns a NEW array. */
  intersect(a: FlatRanges, b: FlatRanges): FlatRanges;

  /** Parts of the circular pairs that do NOT overlap `baseRanges`. @returns a NEW array. */
  subtract_clip(baseRanges: FlatRanges, circular: FlatRanges): FlatRanges;

  /** Total covered length. */
  length(ranges: FlatRanges): number;

  /** Whether `value` (taken modulo size) is covered. */
  contains(ranges: FlatRanges, value: number): boolean;

  /** Whether the circular interval [from, to) overlaps any range. */
  overlaps(ranges: FlatRanges, from: number, to: number): boolean;

  /** Element-wise equality of two canonical arrays. */
  equal(a: FlatRanges, b: FlatRanges): boolean;

  /**
   * Positions in neither `have` nor `notHave`, over the whole circle or
   * the circular window [from, to). @returns a NEW canonical array.
   */
  unknown(have: FlatRanges, notHave: FlatRanges, from?: number | null, to?: number | null): FlatRanges;

  /**
   * The first unknown gap scanning forward from `from` (default 0) through
   * the window (default the whole circle), clipped to `maxLen`. A gap that
   * crosses 0 comes back whole as [from, to] with `to < from`; a gap
   * filling a whole-circle window is [x, x + size].
   */
  first_unknown(
    have: FlatRanges,
    notHave: FlatRanges,
    from?: number | null,
    to?: number | null,
    maxLen?: number | null
  ): [number, number] | null;

  /** As the core `add_have`, with circular input. */
  add_have(have: FlatRanges, notHave: FlatRanges, newHave: FlatRanges): boolean;
  /** As the core `add_not_have`, with circular input. */
  add_not_have(have: FlatRanges, notHave: FlatRanges, newNotHave: FlatRanges): boolean;
  /** As the core `set_have`, with circular input. */
  set_have(have: FlatRanges, notHave: FlatRanges, newHave: FlatRanges): boolean;
  /** As the core `set_not_have`, with circular input. */
  set_not_have(have: FlatRanges, notHave: FlatRanges, newNotHave: FlatRanges): boolean;

  /** `true` when one run crosses 0 (stored as [0, …] … [… , size)). */
  wraps(ranges: FlatRanges): boolean;

  /** Number of runs as seen on the circle (a run across 0 counts once). */
  count(ranges: FlatRanges): number;

  /** Circular view: the run across 0 comes last as [from, to] with `to < from`. @returns a NEW array. */
  runs(ranges: FlatRanges): FlatRanges;

  /** `x` folded into [0, size). */
  mod(x: number): number;

  /** Shortest distance between two positions, either way round. */
  distance(a: number, b: number): number;

  /**
   * Circular mean of the covered positions, or `null` when it is undefined
   * (nothing covered, or coverage spread evenly). Floating point: do not
   * use where results must match bit-for-bit across machines.
   */
  center(ranges: FlatRanges): number | null;

  /** 1 when coverage sits at one point, 0 when spread evenly round the circle. */
  concentration(ranges: FlatRanges): number;
}

/**
 * Creates the circular API for a circle of `size` positions.
 * @throws RangeError if `size` is not a positive finite number.
 */
export function ring(size: number): Ring;

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
  ring: typeof ring;
};

export default flatRanges;
