# flat-ranges

A tiny, zero-dependency library for tracking **what you have, what you're missing, and what you don't know yet**.

```js
var received = [], missing = [];

flatRanges.add_have(received, missing, [0, 1024]);       // got first chunk
flatRanges.add_have(received, missing, [4096, 5120]);     // got another chunk
flatRanges.unknown(received, missing, 0, 10000);          // what's still unknown?
// → [1024, 4096, 5120, 10000]
```

Ranges are stored as flat arrays — `[from₁, to₁, from₂, to₂, ...]` — making them compact, cache-friendly, and easy to serialize. All operations are in-place with zero object allocation on the hot path. Full TypeScript definitions included.

## Why flat-ranges?

Most range/interval libraries on npm do one thing: merge overlapping intervals. flat-ranges does that too, but the real value is the **have / not-have / unknown** model — a tri-state system for tracking knowledge about segments of data.

This pattern comes up everywhere:

- **"Which bytes of this file have been downloaded?"** — chunked downloads, HTTP range requests
- **"What does the other peer have?"** — data sync protocols, P2P replication
- **"Which segments are buffered?"** — audio/video streaming
- **"Which row ranges have been replicated?"** — database replication
- **"What time slots are free?"** — scheduling, availability maps

Before flat-ranges, you'd either build this yourself, or pull in a heavy library designed for something else. flat-ranges gives you a focused, fast, battle-tested primitive.

### What makes it different

**Flat array format** — `[0, 10, 20, 30]` instead of `[{start:0, end:10}, {start:20, end:30}]`. No per-range object allocation. Fewer garbage collection pauses. Trivial to serialize to JSON or send over the wire.

**Tri-state tracking** — `have`, `not_have`, and `unknown` are first-class concepts, not something you have to build on top. The library guarantees they never overlap.

**Authoritative updates** — `set_have` and `set_not_have` let you say "this is the truth now" and the library figures out what changed. Ranges that fell out of the new state are automatically moved to the opposite side. This maps perfectly to sync protocols where a peer announces its current state.

**In-place with change detection** — every mutating function returns `true` if anything changed, so you can skip unnecessary work downstream. When nothing changed, the array is never touched.

**Engine-aware performance** — appending at the tail (the most common real-world pattern: chunks arriving in order) is a dedicated O(1) fast path, and arrays are grown in a way that keeps them in V8's fast PACKED representation. See [Performance](#performance).

## Installation

```bash
npm install flat-ranges
```

Works everywhere — Node.js, bundlers, and browsers. The package ships three files: `index.js` (UMD/CommonJS), `index.mjs` (ES module), and `index.d.ts` (TypeScript definitions). The `exports` field in `package.json` routes each import style to the right file automatically.

### Node.js — CommonJS

```js
var flatRanges = require('flat-ranges');

var r = [];
flatRanges.add(r, [0, 10]);
```

### Node.js — ES modules

```js
// default import
import flatRanges from 'flat-ranges';

// named imports
import { add, remove, length } from 'flat-ranges';

// both at once
import flatRanges, { add, remove } from 'flat-ranges';
```

### TypeScript

Types are bundled — no `@types` package needed:

```ts
import { add, first_unknown, type FlatRanges } from 'flat-ranges';

const buffered: FlatRanges = [];
add(buffered, [0, 30]);

const next: [number, number] | null = first_unknown(buffered, [], 0, 600, 16);
```

### Browser — script tag

```html
<script src="node_modules/flat-ranges/index.js"></script>
<script>
  var r = [];
  flatRanges.add(r, [0, 10]);
</script>
```

### Browser — ES module

```html
<script type="module">
  import flatRanges from './node_modules/flat-ranges/index.mjs';
  // or with a bundler: import flatRanges from 'flat-ranges';
</script>
```

### Bundlers (webpack, rollup, vite, esbuild)

Just `import` normally — the `exports` and `module` fields in `package.json` ensure the bundler picks the right file:

```js
import flatRanges from 'flat-ranges';
import { add, remove, set_have, unknown } from 'flat-ranges';
```

## Quick start

```js
var r = [];

flatRanges.add(r, [0, 10]);
flatRanges.add(r, [20, 30]);
// r → [0, 10, 20, 30]

flatRanges.remove(r, [5, 25]);
// r → [0, 5, 25, 30]

flatRanges.length(r);
// → 10

flatRanges.contains(r, 3);
// → true

flatRanges.invert(r, 0, 40);
// → [5, 25, 30, 40]

flatRanges.intersect(r, [0, 27]);
// → [0, 5, 25, 27]
```

## Data format

Ranges are half-open intervals `[from, to)` — `from` is included, `to` is excluded. An empty range like `[5, 5)` covers zero units and is silently ignored.

If you need to represent a single point like "item 5", use `[5, 6)`.

After any operation, ranges are always sorted and non-overlapping. Mutating functions work in-place and return `true` if the array changed; when they return `false`, the array is guaranteed untouched.

## Real-world examples

### Chunked file download

```js
var have = [], missing = [];

// First 1KB arrived
flatRanges.add_have(have, missing, [0, 1024]);

// Server reported bytes 1024–2048 are corrupted
flatRanges.add_not_have(have, missing, [1024, 2048]);

// What's the next chunk to request? (max 4KB at a time)
flatRanges.first_unknown(have, missing, 0, 10000, 4096);
// → [2048, 6144]  — allocation-free, no need to build the full unknown list

// How much do we have so far?
flatRanges.length(have);  // → 1024
```

### Streaming media buffer

```js
var buffered = [];

flatRanges.add(buffered, [0, 30]);      // first 30 seconds loaded
flatRanges.add(buffered, [120, 180]);   // user seeked, new chunk loaded

// Can we play seconds 25–35 without interruption? (boolean, O(log n))
flatRanges.overlaps(buffered, 30, 35);
// there's a gap — what exactly is missing?
var gaps = flatRanges.subtract_clip(buffered, [25, 35]);
// → [30, 35]  — missing 5 seconds, need to buffer more
```

### Peer-to-peer sync

```js
var peerHave = [], peerNotHave = [];

// Peer announces: "I have segments 0–500 and 800–1000"
flatRanges.set_have(peerHave, peerNotHave, [0, 500, 800, 1000]);

// Later, peer updates: "Now I only have 0–300"
flatRanges.set_have(peerHave, peerNotHave, [0, 300]);
// peerHave    → [0, 300]
// peerNotHave → [300, 500, 800, 1000]  (lost segments tracked automatically)

// Which segments do BOTH of us have? (pick a peer to download from)
flatRanges.intersect(myHave, peerHave);

// What don't we know about this peer?
flatRanges.unknown(peerHave, peerNotHave, 0, 2000);
// → [500, 800, 1000, 2000]
```

### Database replication

```js
var replicated = [], failed = [];

flatRanges.add_have(replicated, failed, [0, 10000]);      // batch 1 OK
flatRanges.add_not_have(replicated, failed, [10000, 20000]); // batch 2 failed
flatRanges.add_have(replicated, failed, [20000, 30000]);   // batch 3 OK

console.log(failed);                    // → [10000, 20000]
flatRanges.length(replicated);          // → 20000
```

### Scheduling

```js
var booked = [9, 10, 11, 12.5, 14, 15.5];
// 9–10, 11–12:30, 14–15:30

var free = flatRanges.invert(booked, 8, 18);
// → [8, 9, 10, 11, 12.5, 14, 15.5, 18]
// Free: 8–9, 10–11, 12:30–14, 15:30–18

flatRanges.length(free);  // → 6.5 hours free

// Is 13:00–13:30 free?
!flatRanges.overlaps(booked, 13, 13.5);  // → true
```

## API

### Core operations

#### `add(ranges, newRanges)`

Adds ranges and merges overlaps/adjacents. Input doesn't need to be sorted. Appending at or after the tail is a dedicated O(1) fast path.

```js
var r = [0, 5, 20, 25];
flatRanges.add(r, [4, 21]);   // r → [0, 25]
```

#### `remove(ranges, removeRanges)`

Removes ranges. Splits when cut in the middle.

> **Contract:** `removeRanges` must be **sorted by `from` and non-overlapping** (which is always true for arrays maintained by this library). Passing unsorted input produces incorrect results. If your input might be unsorted, normalise it first with `add([], input)` or `merge(sortedInput)`.

```js
var r = [0, 100];
flatRanges.remove(r, [10, 20, 50, 60]);   // r → [0, 10, 20, 50, 60, 100]
```

#### `merge(flatRanges)`

Merges overlapping/adjacent ranges. Returns a **new** array. Input must be sorted.

```js
flatRanges.merge([0, 5, 3, 8]);   // → [0, 8]
```

#### `invert(ranges, fullStart, fullEnd)`

Returns everything in `[fullStart, fullEnd)` NOT covered by ranges. New array.

```js
flatRanges.invert([10, 20, 30, 40], 0, 50);   // → [0, 10, 20, 30, 40, 50]
```

#### `intersect(a, b)`

Returns the ranges covered by **both** `a` and `b`. Two-pointer sweep, O(n + m), new array, no mutation. Completes the set-algebra toolkit: union (`add`), difference (`remove`), complement (`invert`), intersection (`intersect`).

```js
flatRanges.intersect([0, 10, 20, 30], [5, 25]);   // → [5, 10, 20, 25]
flatRanges.intersect([0, 10], [10, 20]);          // → []  (half-open: touching ≠ overlapping)
```

#### `subtract_clip(baseRanges, subtractRanges)`

Returns parts of `subtractRanges` that don't overlap `baseRanges`. No mutation.

```js
flatRanges.subtract_clip([20, 40], [0, 50]);   // → [0, 20, 40, 50]
```

#### `length(ranges)`

Total covered length.

```js
flatRanges.length([0, 10, 20, 30]);   // → 20
```

### Queries

#### `contains(ranges, value)`

Tests whether a single value falls inside any range. O(log n) binary search, zero allocations.

```js
flatRanges.contains([0, 10, 20, 30], 5);    // → true
flatRanges.contains([0, 10, 20, 30], 10);   // → false  (half-open)
```

#### `overlaps(ranges, from, to)`

Tests whether the interval `[from, to)` overlaps **any** range. O(log n), zero allocations — use this instead of `intersect`/`subtract_clip` when you only need a yes/no answer.

```js
flatRanges.overlaps([0, 10, 20, 30], 5, 15);    // → true
flatRanges.overlaps([0, 10, 20, 30], 10, 20);   // → false  (falls exactly in the gap)
```

#### `equal(a, b)`

Element-wise equality of two flat range arrays. Assumes both are normalised (always true for arrays maintained by this library).

```js
flatRanges.equal([0, 10], [0, 10]);   // → true
```

To copy a range list, plain `ranges.slice()` is all you need — it's just a flat array of numbers.

### Have / Not-Have state management

These functions manage two complementary lists — `have` and `notHave` — and guarantee they never overlap. There are two modes: **add** (incremental, respects existing knowledge) and **set** (authoritative, replaces previous state).

#### `add_have(have, notHave, newHave)`

Adds to `have`, skipping anything already in `notHave`.

```js
var have = [], notHave = [40, 60];
flatRanges.add_have(have, notHave, [0, 100]);
// have → [0, 40, 60, 100]    notHave unchanged
```

#### `add_not_have(have, notHave, newNotHave)`

Adds to `notHave`, skipping anything already in `have`.

```js
var have = [0, 50], notHave = [];
flatRanges.add_not_have(have, notHave, [30, 80]);
// notHave → [50, 80]    have unchanged
```

#### `set_have(have, notHave, newHave)`

Authoritatively replaces `have`. Lost ranges move to `notHave`. Overrides conflicts.

```js
var have = [0, 50], notHave = [50, 70];
flatRanges.set_have(have, notHave, [30, 100]);
// have → [30, 100]    notHave → [0, 30]
```

#### `set_not_have(have, notHave, newNotHave)`

Authoritatively replaces `notHave`. Lost ranges move to `have`. Overrides conflicts.

```js
var have = [20, 40], notHave = [0, 20, 40, 60];
flatRanges.set_not_have(have, notHave, [50, 80]);
// notHave → [50, 80]    have → [0, 50]
```

#### `unknown(have, notHave, min, max)`

Returns ranges in `[min, max)` not in `have` or `notHave`.

```js
flatRanges.unknown([0, 30], [60, 100], 0, 100);
// → [30, 60]
```

#### `first_unknown(have, notHave, min, max[, maxLen])`

Returns the **first** unknown gap in `[min, max)` as a `[from, to]` pair, or `null` if everything is known. Optionally clips the gap to `maxLen` units.

This is the allocation-free answer to *"which chunk should I request next?"* — unlike `unknown()`, it stops at the first gap instead of building the full result array. On a state with 10,000 ranges it's roughly **1,000× faster** than calling `unknown()` and taking the first element.

```js
flatRanges.first_unknown([0, 30], [60, 100], 0, 100);       // → [30, 60]
flatRanges.first_unknown([0, 30], [60, 100], 0, 100, 16);   // → [30, 46]
flatRanges.first_unknown([0, 100], [], 0, 100);             // → null
```

## How it compares

| Library | What it does | flat-ranges difference |
|---|---|---|
| merge-ranges, simplify-ranges | Merge overlapping intervals | flat-ranges does this + remove, invert, intersect, have/notHave, change detection |
| node-interval-tree | Stores overlapping ranges with identity, stabbing queries | Different model: flat-ranges merges on insert, no per-range identity |
| bitfield | One bit per piece (BitTorrent protocol) | flat-ranges tracks arbitrary-size ranges, not fixed-size pieces |
| moment-range | Date range operations with moment.js | flat-ranges is numeric-only, no date-specific features |

flat-ranges is the right tool when you need to track **which parts of a numeric domain are covered** — not when you need to store overlapping intervals with identity or work with date objects.

## Performance

Binary search locates merge zones with zero intermediate allocations on the fast path. v2.2.0 adds three engine-level optimisations, each verified by benchmark:

- **O(1) append fast path** — chunks arriving in order at the tail (the dominant real-world pattern in downloads, streaming, and log ingestion) skip the binary search entirely. Measured ~7× faster on sequential in-order builds.
- **PACKED array preservation** — internal grows use `push()` instead of assigning `.length`, which would create holes and permanently demote the array to V8's slower HOLEY elements kind. Measured ~3× on write-heavy workloads.
- **O(1) `remove` fast-reject** — when the removal window falls entirely outside the covered span, `remove` returns immediately without scanning or touching the array. Measured ~8× on miss-heavy workloads.

Benchmarked on Node.js (ops/sec, higher is better):

| Operation | ops/sec |
|---|---|
| Append 1 range at the tail (fast path) | ~12,700,000 |
| `remove` miss — no overlap (fast reject) | ~41,000,000 |
| `contains` on 10,000 ranges | ~30,000,000 |
| `overlaps` on 10,000 ranges | ~32,000,000 |
| `first_unknown` with 10,000 total ranges | ~3,300,000 |
| Add 1 range into 1,000 ranges (middle) | ~91,000 |
| Add 1 range into 5,000 ranges (middle) | ~16,000 |
| Add 1 range merging 500 adjacent | ~18,000 |
| Sequential in-order build of 2,000 ranges | ~33,000 |
| Remove 100 holes from `[0, 100000)` | ~335,000 |
| `intersect` two 1,000-range lists | ~26,000 |
| `set_have` with 500 ranges | ~21,000 |
| `unknown` with 10,000 total ranges | ~3,500 |

```bash
npm test
```

The test suite includes both unit tests and thousands of property-based fuzz iterations verified against a naive reference implementation.

## Migrating

**v2.1 → v2.2** — no breaking changes. New functions: `intersect`, `overlaps`, `equal`, `first_unknown`. TypeScript definitions added. One behavioral refinement: when `remove` changes nothing, the target array is now guaranteed untouched (previously it was rewritten with identical, normalised content — irrelevant unless you passed a non-normalised array, which was outside the documented contract).

**v1 → v2** — `unknow()` was renamed to `unknown()`. Update call sites and you're done.

## Links

- GitHub: [github.com/colocohen/flat-ranges](https://github.com/colocohen/flat-ranges)
- NPM: [npmjs.com/package/flat-ranges](https://www.npmjs.com/package/flat-ranges)

## Author

Created by [colocohen](https://github.com/colocohen)

## License

MIT
