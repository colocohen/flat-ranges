# flat-ranges

A tiny, zero-dependency library for tracking **what you have, what you're missing, and what you don't know yet**.

```js
var received = [], missing = [];

flatRanges.add_have(received, missing, [0, 1024]);       // got first chunk
flatRanges.add_have(received, missing, [4096, 5120]);     // got another chunk
flatRanges.unknown(received, missing, 0, 10000);          // what's still unknown?
// → [1024, 4096, 5120, 10000]
```

Ranges are stored as flat arrays — `[from₁, to₁, from₂, to₂, ...]` — making them compact, cache-friendly, and easy to serialize. All operations are in-place with zero object allocation on the hot path.

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

**In-place with change detection** — every mutating function returns `true` if anything changed, so you can skip unnecessary work downstream.

## Installation

```bash
npm install flat-ranges
```

Works everywhere — Node.js, bundlers, and browsers. Two files ship in the package: `index.js` (UMD/CommonJS) and `index.mjs` (ES module). The `exports` field in `package.json` routes each import style to the right file automatically.

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

flatRanges.invert(r, 0, 40);
// → [5, 25, 30, 40]
```

## Data format

Ranges are half-open intervals `[from, to)` — `from` is included, `to` is excluded. An empty range like `[5, 5)` covers zero units and is silently ignored.

If you need to represent a single point like "item 5", use `[5, 6)`.

After any operation, ranges are always sorted and non-overlapping. Mutating functions work in-place and return `true` if the array changed.

## Real-world examples

### Chunked file download

```js
var have = [], missing = [];

// First 1KB arrived
flatRanges.add_have(have, missing, [0, 1024]);

// Server reported bytes 1024–2048 are corrupted
flatRanges.add_not_have(have, missing, [1024, 2048]);

// What should we request next?
flatRanges.unknown(have, missing, 0, 10000);
// → [2048, 10000]  (we know about 0–2048, the rest is unknown)

// How much do we have so far?
flatRanges.length(have);  // → 1024
```

### Streaming media buffer

```js
var buffered = [];

flatRanges.add(buffered, [0, 30]);      // first 30 seconds loaded
flatRanges.add(buffered, [120, 180]);   // user seeked, new chunk loaded

// Can we play seconds 25–35 without interruption?
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
```

## API

### Core operations

#### `add(ranges, newRanges)`

Adds ranges and merges overlaps/adjacents. Input doesn't need to be sorted.

```js
var r = [0, 5, 20, 25];
flatRanges.add(r, [4, 21]);   // r → [0, 25]
```

#### `remove(ranges, removeRanges)`

Removes ranges. Splits when cut in the middle.

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

## How it compares

| Library | What it does | flat-ranges difference |
|---|---|---|
| merge-ranges, simplify-ranges | Merge overlapping intervals | flat-ranges does this + remove, invert, have/notHave, change detection |
| node-interval-tree | Stores overlapping ranges with identity, stabbing queries | Different model: flat-ranges merges on insert, no per-range identity |
| bitfield | One bit per piece (BitTorrent protocol) | flat-ranges tracks arbitrary-size ranges, not fixed-size pieces |
| moment-range | Date range operations with moment.js | flat-ranges is numeric-only, no date-specific features |

flat-ranges is the right tool when you need to track **which parts of a numeric domain are covered** — not when you need to store overlapping intervals with identity or work with date objects.

## Performance

Uses binary search to locate merge zones with zero intermediate allocations on the fast path. Benchmarked on Node.js:

| Operation | ops/sec |
|---|---|
| Add 1 range into 1,000 ranges | ~126,000 |
| Add 1 range into 5,000 ranges | ~28,000 |
| Add 1 range merging 500 adjacent | ~300,000 |
| Sequential add of 500 single ranges | ~45,000 |
| Remove 100 holes from `[0, 100000)` | ~478,000 |
| `set_have` with 500 ranges | ~22,000 |
| `unknown` with 10,000 total ranges | ~6,200 |

```bash
node test.js
```

## Migrating from v1

v2 renames `unknow()` → `unknown()`. Update call sites and you're done.

## Links

- GitHub: [github.com/colocohen/flat-ranges](https://github.com/colocohen/flat-ranges)
- NPM: [npmjs.com/package/flat-ranges](https://www.npmjs.com/package/flat-ranges)

## Author

Created by [colocohen](https://github.com/colocohen)

## License

MIT
