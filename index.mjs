import flatRanges from './index.js';

export default flatRanges;

export const add = flatRanges.add;
export const remove = flatRanges.remove;
export const merge = flatRanges.merge;
export const invert = flatRanges.invert;
export const intersect = flatRanges.intersect;
export const subtract_clip = flatRanges.subtract_clip;
export const length = flatRanges.length;
export const contains = flatRanges.contains;
export const overlaps = flatRanges.overlaps;
export const equal = flatRanges.equal;
export const unknown = flatRanges.unknown;
export const first_unknown = flatRanges.first_unknown;
export const add_have = flatRanges.add_have;
export const add_not_have = flatRanges.add_not_have;
export const set_have = flatRanges.set_have;
export const set_not_have = flatRanges.set_not_have;
