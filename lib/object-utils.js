/*
 Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/**
 * utility methods to process coverage objects. A coverage object has the following
 * format.
 *
 *      {
 *          "/path/to/file1.js": { file1 coverage },
 *          "/path/to/file2.js": { file2 coverage }
 *      }
 *
 *  The internals of the file coverage object are intentionally not documented since
 *  it is not a public interface.
 *
 *  *Note:* When a method of this module has the word `File` in it, it will accept
 *  one of the sub-objects of the main coverage object as an argument. Other
 *  methods accept the higher level coverage object with multiple keys.
 *
 * Usage
 * -----
 *
 *      var objectUtils = require('istanbul').utils;
 *
 * @class ObjectUtils
 */

/**
 * adds line coverage information to a file coverage object, reverse-engineering
 * it from statement coverage. The object passed in is updated in place.
 *
 * Note that if line coverage information is already present in the object,
 * it is not recomputed.
 *
 * @method addDerivedInfoForFile
 * @static
 * @param {Object} fileCoverage the coverage object for a single file
 */
function addDerivedInfoForFile(fileCoverage) {
    var statementMap = fileCoverage.statementMap,
        statements = fileCoverage.s,
        lineMap;

    if (!fileCoverage.l) {
        fileCoverage.l = lineMap = {};
        Object.keys(statements).forEach(function (st) {
            var line = statementMap[st].start.line,
                count = statements[st],
                prevVal = lineMap[line];
            if (typeof prevVal === 'undefined' || prevVal < count) {
                lineMap[line] = count;
            }
        });
    }
}
/**
 * adds line coverage information to all file coverage objects.
 *
 * @method addDerivedInfo
 * @static
 * @param {Object} coverage the coverage object
 */
function addDerivedInfo(coverage) {
    Object.keys(coverage).forEach(function (k) {
        addDerivedInfoForFile(coverage[k]);
    });
}
/**
 * removes line coverage information from all file coverage objects
 * @method removeDerivedInfo
 * @static
 * @param {Object} coverage the coverage object
 */
function removeDerivedInfo(coverage) {
    Object.keys(coverage).forEach(function (k) {
        delete coverage[k].l;
    });
}

function percent(covered, total) {
    var tmp;
    if (total > 0) {
        tmp = 1000 * 100 * covered / total + 5;
        return Math.floor(tmp / 10) / 100;
    } else {
        return 100.00;
    }
}

function computeSimpleTotals(fileCoverage, property) {
    var stats = fileCoverage[property],
        ret = { total: 0, covered: 0 };

    Object.keys(stats).forEach(function (key) {
        ret.total += 1;
        if (stats[key]) {
            ret.covered += 1;
        }
    });
    ret.pct = percent(ret.covered, ret.total);
    return ret;
}

function computeBranchTotals(fileCoverage) {
    var stats = fileCoverage.b,
        ret = { total: 0, covered: 0 };

    Object.keys(stats).forEach(function (key) {
        var branches = stats[key],
            covered = branches.filter(function (num) { return num > 0; });
        ret.total += branches.length;
        ret.covered += covered.length;
    });
    ret.pct = percent(ret.covered, ret.total);
    return ret;
}
/**
 * returns a blank summary metrics object. A metrics object has the following
 * format.
 *
 *      {
 *          lines: lineMetrics,
 *          statements: statementMetrics,
 *          functions: functionMetrics,
 *          branches: branchMetrics
 *      }
 *
 *  Each individual metric object looks as follows:
 *
 *      {
 *          total: n,
 *          covered: m,
 *          pct: percent
 *      }
 *
 * @method blankSummary
 * @static
 * @return {Object} a blank metrics object
 */
function blankSummary() {
    return {
        lines: {
            total: 0,
            covered: 0,
            pct: 'Unknown'
        },
        statements: {
            total: 0,
            covered: 0,
            pct: 'Unknown'
        },
        functions: {
            total: 0,
            covered: 0,
            pct: 'Unknown'
        },
        branches: {
            total: 0,
            covered: 0,
            pct: 'Unknown'
        }
    };
}
/**
 * returns the summary metrics given the coverage object for a single file. See `blankSummary()`
 * to understand the format of the returned object.
 *
 * @method summarizeFileCoverage
 * @static
 * @param {Object} fileCoverage the coverage object for a single file.
 * @return {Object} the summary metrics for the file
 */
function summarizeFileCoverage(fileCoverage) {
    var ret = blankSummary();
    addDerivedInfoForFile(fileCoverage);
    ret.lines = computeSimpleTotals(fileCoverage, 'l');
    ret.functions = computeSimpleTotals(fileCoverage, 'f');
    ret.statements = computeSimpleTotals(fileCoverage, 's');
    ret.branches = computeBranchTotals(fileCoverage);
    return ret;
}
/**
 * merges two instances of file coverage objects *for the same file*
 * such that the execution counts are correct.
 *
 * @method mergeFileCoverage
 * @static
 * @param {Object} first the first file coverage object for a given file
 * @param {Object} second the second file coverage object for the same file
 * @return {Object} an object that is a result of merging the two. Note that
 *      the input objects are not changed in any way.
 */
function mergeFileCoverage(first, second) {
    var ret = JSON.parse(JSON.stringify(first)),
        i;

    delete ret.l; //remove derived info

    Object.keys(second.s).forEach(function (k) {
        ret.s[k] += second.s[k];
    });
    Object.keys(second.f).forEach(function (k) {
        ret.f[k] += second.f[k];
    });
    Object.keys(second.b).forEach(function (k) {
        var retArray = ret.b[k],
            secondArray = second.b[k];
        for (i = 0; i < retArray.length; i += 1) {
            retArray[i] += secondArray[i];
        }
    });

    return ret;
}
/**
 * merges multiple summary metrics objects by summing up the `totals` and
 * `covered` fields and recomputing the percentages. This function is generic
 * and can accept any number of arguments.
 *
 * @method mergeSummaryObjects
 * @static
 * @param {Object} summary... multiple summary metrics objects
 * @return {Object} the merged summary metrics
 */
function mergeSummaryObjects() {
    var ret = blankSummary(),
        args = Array.prototype.slice.call(arguments),
        keys = ['lines', 'statements', 'branches', 'functions'],
        increment = function (obj) {
            if (obj) {
                keys.forEach(function (key) {
                    ret[key].total += obj[key].total;
                    ret[key].covered += obj[key].covered;
                });
            }
        };
    args.forEach(function (arg) {
        increment(arg);
    });
    keys.forEach(function (key) {
        ret[key].pct = percent(ret[key].covered, ret[key].total);
    });

    return ret;
}

/**
 * makes the coverage object generated by this library yuitest_coverage compatible.
 * Note that this transformation is lossy since the returned object will not have
 * statement and branch coverage.
 *
 * @method toYUICoverage
 * @static
 * @param {Object} coverage The `istanbul` coverage object
 * @return {Object} a coverage object in `yuitest_coverage` format.
 */
function toYUICoverage(coverage) {
    var ret = {};

    addDerivedInfo(coverage);

    Object.keys(coverage).forEach(function (k) {
        var fileCoverage = coverage[k],
            lines = fileCoverage.l,
            functions = fileCoverage.f,
            fnMap = fileCoverage.fnMap,
            o;

        o = ret[k] = {
            lines: {},
            calledLines: 0,
            coveredLines: 0,
            functions: {},
            calledFunctions: 0,
            coveredFunctions: 0
        };
        Object.keys(lines).forEach(function (k) {
            o.lines[k] = lines[k];
            o.coveredLines += 1;
            if (lines[k] > 0) {
                o.calledLines += 1;
            }
        });
        Object.keys(functions).forEach(function (k) {
            var name = fnMap[k].name + ':' + fnMap[k].line;
            o.functions[name] = functions[k];
            o.coveredFunctions += 1;
            if (functions[k] > 0) {
                o.calledFunctions += 1;
            }
        });
    });
    return ret;
}

module.exports = {
    addDerivedInfo: addDerivedInfo,
    addDerivedInfoForFile: addDerivedInfoForFile,
    removeDerivedInfo: removeDerivedInfo,
    blankSummary: blankSummary,
    summarizeFileCoverage: summarizeFileCoverage,
    mergeFileCoverage: mergeFileCoverage,
    mergeSummaryObjects: mergeSummaryObjects,
    toYUICoverage: toYUICoverage
};

