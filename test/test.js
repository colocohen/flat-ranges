var ranges = require('../index');

var r = [];
ranges.ranges_add(r, [0, 5]);
ranges.ranges_add(r, [10, 15]);
console.log("After add:", r); // [0,5,10,15]

ranges.ranges_remove(r, [3,12]);
console.log("After remove [3,12]:", r); // [0,3,12,15]

console.log("Total length:", ranges.ranges_length(r)); // 6

var inverted = ranges.ranges_invert(r, 0, 20);
console.log("Inverted:", inverted); // [3,12,15,20]
