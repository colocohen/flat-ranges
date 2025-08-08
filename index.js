function subtract_clip(baseRanges, subtractRanges) {
    var result = [];
    for (var i = 0; i < subtractRanges.length; i += 2) {
        var from = subtractRanges[i];
        var to = subtractRanges[i + 1];
        var clipped = [from, to];
        remove(clipped, baseRanges);
        for (var j = 0; j < clipped.length; j += 2) {
        result.push(clipped[j], clipped[j + 1]);
        }
    }
    return result;
}

function merge(flatRanges) {
    var result = [];
    for (var i = 0; i < flatRanges.length; i += 2) {
        var from = flatRanges[i];
        var to = flatRanges[i + 1];
        if (result.length === 0) {
        result.push(from, to);
        } else {
        var lastTo = result[result.length - 1];
        if (from <= lastTo) {
            result[result.length - 1] = Math.max(lastTo, to);
        } else {
            result.push(from, to);
        }
        }
    }
    return result;
}

function set_have(knownHave, knownNotHave, newHave) {
    var changed = false;

    var becameNotHave = [];
    for (var i = 0; i < knownHave.length; i += 2) {
        var from = knownHave[i];
        var to = knownHave[i + 1];
        var piece = [from, to];
        remove(piece, newHave);
        for (var j = 0; j < piece.length; j += 2) {
        becameNotHave.push(piece[j], piece[j + 1]);
        }
    }

    if (becameNotHave.length > 0) {
        if (add(knownNotHave, becameNotHave)) {
        changed = true;
        }
    }

    var clean = subtract_clip(knownNotHave, newHave);

    // נבדוק אם knownHave השתנה
    if (knownHave.length > 0) {
        knownHave.length = 0;
        changed = true;
    }

    if (add(knownHave, clean)) {
        changed = true;
    }

    return changed;
}

function add_have(knownHave, knownNotHave, newHave) {
    // לא יכולים להיות גם ב־have וגם ב־not_have
    var clean = subtract_clip(knownNotHave, newHave);
    return add(knownHave, clean);
}

function add_not_have(knownHave, knownNotHave, newNotHave) {
    // לא מוסיפים מידע שסותר את מה שכבר ידוע כקיים
    var clean = subtract_clip(knownHave, newNotHave);
    return add(knownNotHave, clean);
}

function set_not_have(knownHave, knownNotHave, newNotHave) {
    var changed = false;

    var becameHave = [];
    for (var i = 0; i < knownNotHave.length; i += 2) {
        var from = knownNotHave[i];
        var to   = knownNotHave[i + 1];
        var piece = [from, to];
        remove(piece, newNotHave);
        for (var j = 0; j < piece.length; j += 2) {
        becameHave.push(piece[j], piece[j + 1]);
        }
    }


    if (becameHave.length > 0) {
        if (add(knownHave, becameHave)) {
        changed = true;
        }
    }

    var clean = subtract_clip(knownHave, newNotHave);
    if (knownNotHave.length > 0) {
        knownNotHave.length = 0;
        changed = true;
    }
    if (add(knownNotHave, clean)) {
        changed = true;
    }

    return changed;
}


function invert(ranges, fullStart, fullEnd) {
    var result = [];
    var last = fullStart;

    for (var i = 0; i < ranges.length; i += 2) {
        var from = ranges[i];
        if (from > last) result.push(last, from);
        last = Math.max(last, ranges[i + 1]);
    }

    if (last < fullEnd) result.push(last, fullEnd);
    return result;
}

function remove(ranges, removeRanges) {
  var result = [];
  var i = 0, j = 0;
  var changed = false;

  while (i < ranges.length && j < removeRanges.length) {
    var aFrom = ranges[i], aTo = ranges[i + 1];
    var bFrom = removeRanges[j], bTo = removeRanges[j + 1];

    // הפיכת טווחים ריקים לטווחים בודדים
    if (aFrom === aTo) aTo = aFrom + 1;
    if (bFrom === bTo) bTo = bFrom + 1;

    if (aTo <= bFrom) {
      // אין חפיפה
      result.push(aFrom, aTo);
      i += 2;
    } else if (aFrom >= bTo) {
      // הטווח להסרה עוד לא רלוונטי
      j += 2;
    } else {
      // יש חפיפה
      if (aFrom < bFrom) {
        result.push(aFrom, bFrom);
      }
      if (aTo > bTo) {
        result.push(bTo, aTo);
      }
      changed = true;
      i += 2;
    }
  }

  // הוספת טווחים שנשארו
  while (i < ranges.length) {
    var aFrom = ranges[i], aTo = ranges[i + 1];
    if (aFrom === aTo) aTo = aFrom + 1; // גם פה
    result.push(aFrom, aTo);
    i += 2;
  }

  if (result.length !== ranges.length) changed = true;
  for (var k = 0; k < result.length; k++) {
    if (ranges[k] !== result[k]) changed = true;
    ranges[k] = result[k];
  }
  ranges.length = result.length;

  return changed;
}




function add(ranges, newRanges) {
    var changed = false;
    var all = [];

    // שלב 1: איסוף כל הטווחים — הקיימים והחדשים
    for (var i = 0; i < ranges.length; i += 2) {
        all.push([ranges[i], ranges[i + 1]]);
    }
    for (var i = 0; i < newRanges.length; i += 2) {
        all.push([newRanges[i], newRanges[i + 1]]);
    }

    // שלב 2: מיון לפי התחלה
    all.sort(function (a, b) {
        return a[0] - b[0];
    });

    // שלב 3: מיזוג טווחים רציפים או חופפים
    var merged = [];
    for (var i = 0; i < all.length; i++) {
        var from = all[i][0];
        var to = all[i][1];
        if (merged.length === 0) {
        merged.push(from, to);
        } else {
        var lastFrom = merged[merged.length - 2];
        var lastTo = merged[merged.length - 1];
        if (from <= lastTo + 1) {
            // מיזוג
            if (to > lastTo) {
            merged[merged.length - 1] = to;
            changed = true;
            }
        } else {
            // טווח חדש
            merged.push(from, to);
            changed = true;
        }
        }
    }

    // השוואה מול הקודם
    if (merged.length !== ranges.length) {
        changed = true;
    } else {
        for (var i = 0; i < merged.length; i++) {
        if (merged[i] !== ranges[i]) {
            changed = true;
            break;
        }
        }
    }

    // עדכון הטווחים
    ranges.length = merged.length;
    for (var i = 0; i < merged.length; i++) {
        ranges[i] = merged[i];
    }

    return changed;
}


function length(ranges) {
    var total = 0;
    for (var i = 0; i < ranges.length; i += 2) {
        total += ranges[i + 1] - ranges[i];
    }
    return total;
}

function unknow(have_ranges, not_have_ranges, min_length, max_length) {
    
    return invert(merge(have_ranges.concat(not_have_ranges)), min_length, max_length);

}



module.exports = {
  subtract_clip,
  merge,
  set_have,
  add_have,
  add_not_have,
  set_not_have,
  invert,
  remove,
  add,
  length,
  unknow
};