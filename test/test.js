var flat_ranges = require('../index');

var r = [];
flat_ranges.add(r, [0, 5]);
flat_ranges.add(r, [10, 15]);
console.log("After add:", r); // [0,5,10,15]

flat_ranges.remove(r, [3,12]);
console.log("After remove [3,12]:", r); // [0,3,12,15]

console.log("Total length:", flat_ranges.length(r)); // 6

var inverted = flat_ranges.invert(r, 0, 20);
console.log("Inverted:", inverted); // [3,12,15,20]
