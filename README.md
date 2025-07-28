# flat-ranges

**flat-ranges** is a lightweight utility library for managing flat range lists in the format:

```
[from1, to1, from2, to2, ...]
```

This format is useful for representing:
- received/missing data segments
- availability maps
- interval tracking
- synchronization status
- and more.

---

## 📦 Installation

```bash
npm install flat-ranges
```

---

## 🔧 Usage

```js
var flat_ranges = require('flat-ranges');

var r = [];
flat_ranges.add(r, [0, 5]);
flat_ranges.add(r, [10, 15]);
console.log(r); // [0,5,10,15]

flat_ranges.remove(r, [3,12]);
console.log(r); // [0,3,12,15]

console.log("Total length:", flat_ranges.length(r)); // 6

var inverted = flat_ranges.invert(r, 0, 20);
console.log("Inverted:", inverted); // [3,12,15,20]
```

---

## 🧠 Functions

| Function | Description |
|----------|-------------|
| `add(ranges, newRanges)` | Adds new ranges and merges overlaps |
| `remove(ranges, removeRanges)` | Removes specified ranges |
| `merge(flatRanges)` | Merges overlapping or adjacent ranges |
| `invert(ranges, fullStart, fullEnd)` | Returns the inverse of given ranges in the given domain |
| `length(ranges)` | Returns the total covered length |
| `subtract_clip(baseRanges, subtractRanges)` | Cuts out parts that intersect `baseRanges` from `subtractRanges` |
| `set_have(have, notHave, newHave)` | Updates known data ranges using a new "have" state |
| `add_have(have, notHave, newHave)` | Adds new "have" ranges, skipping contradictions |
| `set_not_have(have, notHave, newNotHave)` | Updates known "not have" ranges based on fresh info |
| `add_not_have(have, notHave, newNotHave)` | Adds new "not have" ranges, skipping contradictions |
| `unknow(have, notHave, min, max)` | Returns the unknown ranges in the specified range |

---

## 🔗 Project Links

- GitHub: [https://github.com/colocohen/flat-ranges](https://github.com/colocohen/flat-ranges)
- NPM: [https://www.npmjs.com/package/flat-ranges](https://www.npmjs.com/package/flat-ranges)

---

## 🧑‍💻 Author

Created with ❤️ by [colocohen](https://github.com/colocohen)

---

## 📝 License

MIT License

---

## 🤝 Contribute or Support

If you find this useful, feel free to star ⭐ the repo or [sponsor me](https://github.com/sponsors/colocohen).

Pull requests are welcome!
