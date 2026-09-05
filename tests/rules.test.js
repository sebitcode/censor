const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const source = readFileSync(join(__dirname, "..", "rules.js"), "utf8");

const context = {};
runInNewContext(source, context);
const { CensorRules } = context;

test("normalizes rules and keeps the last duplicate", () => {
  assert.equal(JSON.stringify(CensorRules.normalizeRules([
    { replacement: "[x]", term: "secret" },
    { replacement: "[redacted]", term: " SECRET " },
    { replacement: "", term: "ignored" },
    { replacement: "[x]", term: "" }
  ])), JSON.stringify([
    { term: "SECRET", replacement: "[redacted]" }
  ]));
});

test("replaces literal terms case-insensitively and prefers longer phrases", () => {
  const matcher = CensorRules.createMatcher([
    { replacement: "[word]", term: "bad" },
    { replacement: "[phrase]", term: "bad word" }
  ]);

  assert.equal(matcher("BAD WORD and bad."), "[phrase] and [word].");
});

test("does not interpret replacement text as a replacement pattern", () => {
  const matcher = CensorRules.createMatcher([
    { replacement: "$& [hidden]", term: "token" }
  ]);

  assert.equal(matcher("token"), "$& [hidden]");
});

test("normalizes site scopes and lets site rules override global rules", () => {
  const settings = CensorRules.normalizeSettings({
    globalRules: [
      { replacement: "[global]", term: "secret" }
    ],
    siteRules: {
      "Example.COM.": [
        { replacement: "[site]", term: "secret" },
        { replacement: "[local]", term: "internal" }
      ]
    }
  });
  const matcher = CensorRules.createMatcher(
    CensorRules.selectRulesForHost(settings, "example.com")
  );

  assert.equal(matcher("SECRET internal"), "[site] [local]");
  assert.equal(Object.keys(settings.siteRules)[0], "example.com");
});
