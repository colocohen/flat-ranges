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
var ranges = require('flat-ranges');

var r = [];
ranges.ranges_add(r, [0, 5]);
ranges.ranges_add(r, [10, 15]);
console.log(r); // [0,5,10,15]

ranges.ranges_remove(r, [3,12]);
console.log(r); // [0,3,12,15]

console.log("Total length:", ranges.ranges_length(r)); // 6

var inverted = ranges.ranges_invert(r, 0, 20);
console.log("Inverted:", inverted); // [3,12,15,20]
```

---

## 🧠 Functions

| Function | Description |
|----------|-------------|
| `ranges_add(ranges, newRanges)` | Adds new ranges and merges overlaps |
| `ranges_remove(ranges, removeRanges)` | Removes specified ranges |
| `ranges_merge(flatRanges)` | Merges overlapping or adjacent ranges |
| `ranges_invert(ranges, fullStart, fullEnd)` | Returns the inverse of given ranges in the given domain |
| `ranges_length(ranges)` | Returns the total covered length |
| `ranges_subtract_clip(baseRanges, subtractRanges)` | Cuts out parts that intersect `baseRanges` from `subtractRanges` |
| `ranges_set_have(have, notHave, newHave)` | Updates known data ranges using a new "have" state |
| `ranges_add_have(have, notHave, newHave)` | Adds new "have" ranges, skipping contradictions |
| `ranges_set_not_have(have, notHave, newNotHave)` | Updates known "not have" ranges based on fresh info |
| `ranges_add_not_have(have, notHave, newNotHave)` | Adds new "not have" ranges, skipping contradictions |
| `ranges_unknow(have, notHave, min, max)` | Returns the unknown ranges in the specified range |

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
