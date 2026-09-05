const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const manifest = JSON.parse(readFileSync(join(__dirname, "..", "manifest.json"), "utf8"));
const contentScript = manifest.content_scripts[0];
const contentSource = readFileSync(join(__dirname, "..", "content.js"), "utf8");

test("injects the censor before the page renders and includes the visibility gate", () => {
  assert.equal(contentScript.run_at, "document_start");
  assert.deepEqual(contentScript.css, ["content.css"]);
  assert.deepEqual(contentScript.js, ["rules.js", "content.js"]);
});

test("loads both current settings and legacy rules from sync storage", () => {
  assert.match(contentSource, /chrome\.storage\.sync\.get\(\{ rules: \[\], settings: null \}\)/);
});
