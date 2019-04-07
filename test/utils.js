/*
 * Copyright 2013-2014 JetBrains s.r.o.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var ts2ktModule = require('ts2kt');

if (ts2ktModule.hasOwnProperty('ts2kt') && ts2ktModule.ts2kt.hasOwnProperty('utils')) {
    var ts2kt = ts2ktModule.ts2kt
    var ts2ktUtils = ts2kt.utils
} else {
    // Workaround not-so-fully-qualified exports of IR backend
    var ts2kt = ts2ktModule
    var ts2ktUtils = ts2kt
}

var fs = require('fs');
var assert = require('chai').assert;

var TS_EXT = ".ts";
var KT_EXT = ".kt";

var UNVERIFIED_FILE_PREFIX = "// OUT:";

var OPERATION_LEVEL = {
    NONE: 0,
    CONVERT: 1,
    CHECK: 2
};

function getTestConfigBasedOnEnvironment() {
    return {
        verified: process.env.VERIFIED_OPERATION_LEVEL || OPERATION_LEVEL.CHECK,
        other: process.env.OTHER_OPERATION_LEVEL || OPERATION_LEVEL.CONVERT
    };
}

function replaceExtension(path, expected, replacment) {
    if (path.endsWith(expected)) {
        return path.substr(0, path.length - expected.length) + replacment;
    }

    return path;
}

function collectSingleFile (testFile, tests, testDataDir, testDataExpectedDir) {
    testDataDir = testDataDir || "";
    testDataExpectedDir = testDataExpectedDir || testDataDir;

    var testConfig = getTestConfigBasedOnEnvironment();

    if (testConfig.other < OPERATION_LEVEL.CONVERT) {
        testConfig.other = OPERATION_LEVEL.CONVERT;
    }

    var expectedFile = replaceExtension(testFile, TS_EXT, KT_EXT);
    addTestFor(tests, testFile, testDataDir + "/" + testFile, testDataExpectedDir + "/" + expectedFile, testConfig);
}

function collectTestFiles(dir, tests, testDataExpectedDir, testDataDir) {
    var testConfig = getTestConfigBasedOnEnvironment();
    return collectTestFilesRec(dir, tests, testDataExpectedDir, testConfig, testDataDir)
}

var count = 0;
const MAX_TEST_COUNT = Number.MAX_VALUE;

function collectTestFilesRec(dir, tests, testDataExpectedDir, testConfig, testDataDir, depth) {
    testDataExpectedDir = testDataExpectedDir || dir;
    testDataDir = testDataDir || dir;
    depth = depth || 0;

    if (count > MAX_TEST_COUNT) return;
    count++;

    var list = fs.readdirSync(dir);

    for (var i = 0; i < list.length; i++) {
        if (count > MAX_TEST_COUNT) break;

        var file = list[i];

        function process(dir, file) {
            if (file === "out") return;
            if (file === "_infrastructure") return;

            var path = dir + '/' + file;
            var stat = fs.statSync(path);
            if (stat && stat.isDirectory()) {
                collectTestFilesRec(path, tests[file] = {}, testDataExpectedDir, testConfig, testDataDir, depth + 1);
            }
            else {
                if (file.endsWith(".d.ts")) {
                    var expectedFilePath = replaceExtension(path.substr(testDataDir.length), TS_EXT, KT_EXT);
                    addTestFor(tests, file, path, testDataExpectedDir + expectedFilePath, testConfig);
                }
            }
        }


        process(dir, file);
    }

    if (depth === 0) {
        tests["printReport"] = function (done) {
            ts2ktUtils.reportUnsupportedKinds();
            done();
        }
    }
}

function createDirsIfNeed(path) {
    var dirs = path.split("/").slice(0, -1);
    var dirCount = dirs.length;
    var cur = ".";
    for (var i = 0; i < dirCount; i++) {
        var dir = dirs[i];
        cur += "/" + dir;
        if (!fs.existsSync(cur)) {
            fs.mkdirSync(cur)
        }
    }
}

function addTestFor(tests, testName, srcPath, expectedPath, testConfig) {
    var testFun = generateTestFor(srcPath, expectedPath, testConfig);
    if (testFun) tests[testName] = testFun;
}

function generateTestFor(srcPath, expectedPath, testConfig) {
    var expected;

    if (fs.existsSync(expectedPath)) {
        expected = fs.readFileSync(expectedPath, {encoding: "utf8"});
        expected = expected.replace(/\n\s*\/\/\s*TODO[^\n]*/g, "").replace(/\r\n/g, "\n");
    }

    var isVerified = expected && !expected.startsWith(UNVERIFIED_FILE_PREFIX);

    if (isVerified && testConfig.verified < OPERATION_LEVEL.CONVERT || !isVerified && testConfig.other < OPERATION_LEVEL.CONVERT) {
        return
    }

    return function() {
        var outPath = expectedPath + ".out";

        createDirsIfNeed(outPath);

        console.log(`srcPath = ${srcPath}, outPath = ${outPath}, expectedPath = ${expectedPath}, testConfig = ${testConfig.verified + testConfig.other}`)

        ts2kt.translateToFile(srcPath, outPath);

        var actual = fs.readFileSync(outPath, {encoding: "utf8"});

        if (!fs.existsSync(expectedPath)) {
            expected = UNVERIFIED_FILE_PREFIX + "\n" + actual;
            fs.writeFileSync(expectedPath, expected);
        }

        if (isVerified && testConfig.verified >= OPERATION_LEVEL.CHECK || !isVerified && testConfig.other >= OPERATION_LEVEL.CHECK) {
            try {
                assert.equal(actual, expected);
            }
            catch (e) {
                e.expectedFilePath = fs.realpathSync(expectedPath);
                e.actualFilePath = fs.realpathSync(outPath);
                throw e;
            }
        }

    }
}

exports.collectTestFiles = collectTestFiles;
exports.collectSingleFile = collectSingleFile;
