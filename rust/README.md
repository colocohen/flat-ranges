# flat-ranges (Rust)

Rust port of https://github.com/colocohen/flat-ranges (npm).

Half-open interval tracking with `have` / `notHave` state. Uses `f64`
endpoints so it supports fractional ranges (e.g. hours, timestamps).

## Usage

```rust
use flat_ranges::FlatRanges;

let mut r = FlatRanges::new();
r.have(0.0, 10.0);          // mark [0, 10) as present
r.have(5.0, 15.0);           // extend
r.not_have(8.0, 12.0);       // punch a hole
r.get_ranges();              // Vec<(f64, f64)> — the current "have" ranges
r.contains(6.0);             // true
r.contains(9.0);             // false (in the hole)
```

## Build

```
cargo build --release
cargo test --release        # 37 tests should pass
```

## License

Apache-2.0
