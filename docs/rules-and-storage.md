# Rules, scopes, and storage

This document is the source of truth for the rule data model. Changes to this contract affect rules.js, popup.js, content.js, migration behavior, tests, and store privacy documentation.

## Current storage shape

Veilmark writes one normalized object under the settings key in chrome.storage.sync:

~~~json
{
  "settings": {
    "globalRules": [
      { "term": "secret", "replacement": "[redacted]" }
    ],
    "siteRules": {
      "example.com": [
        { "term": "internal", "replacement": "[hidden]" }
      ]
    }
  }
}
~~~

The rule object has exactly two meaningful fields:

| Field | Contract |
| --- | --- |
| term | A non-empty string. Leading/trailing whitespace is removed. Matching is case-insensitive. |
| replacement | A non-empty string. It is not trimmed, so intentional spaces remain. It is inserted literally. |

siteRules is keyed by normalized hostname, not URL, path, origin, or wildcard. example.com and www.example.com are different scopes.

## Legacy migration

Earlier versions used a top-level rules array. Both contexts retain compatibility:

- popup.js reads { rules: [], settings: null } and writes a normalized settings object when only legacy rules exist.
- content.js reads both keys so a page can still apply legacy data before the popup has opened.
- chrome.storage.onChanged accepts a change to settings or the legacy rules key.

Chrome's storage.get() only returns requested keys. Do not change content initialization back to get({ rules: [] }); that would omit the current settings object and make fresh page loads appear uncensored after migration.

When changing the schema, update all of the following together:

1. normalizeSettings() and its compatibility aliases;
2. popup initialization and persistence;
3. content initialization and storage listeners;
4. tests for old and new shapes; and
5. this document and the privacy/release notes if user-visible behavior changes.

## Normalization rules

rules.js is intentionally defensive because storage can contain old, malformed, or hand-edited values.

### normalizeRule

- Rejects missing objects or non-string fields.
- Trims the term.
- Rejects an empty term or empty replacement.
- Returns { term, replacement } only for valid input.

### normalizeRules

- Rejects non-arrays.
- Normalizes every rule and drops invalid entries.
- Deduplicates by term.toLowerCase().
- Keeps the last valid rule for a duplicate term.

### normalizeHost

- Rejects non-strings.
- Trims and lowercases the hostname.
- Removes trailing dots.

### normalizeSettings

- Accepts the current object shape.
- Accepts a legacy array as global rules.
- Accepts compatibility aliases global, sites, and siteRules.
- Drops empty or invalid site scopes.
- Always returns { globalRules: [], siteRules: {} }-shaped data.

## Precedence and matching

For a hostname, selectRulesForHost() returns:

~~~text
globalRules followed by siteRules[normalizedHostname]
~~~

createMatcher() then:

1. normalizes the combined list;
2. sorts terms longest-first so a phrase such as bad word wins over bad;
3. escapes every term before creating the regular expression;
4. uses the i and g flags for case-insensitive global replacement; and
5. maps the matched text back to the normalized term's replacement.

Because the site list follows the global list, the last duplicate wins and the site-specific replacement overrides the global replacement for the same case-insensitive term.

Example:

~~~text
Global:       secret -> [global]
example.com:  secret -> [site]

example.com result: [site]
other.com result:   [global]
~~~

Replacement strings are returned from a callback. A replacement such as $& [hidden] is treated as literal text rather than as a JavaScript replacement token.

## Popup editing rules

- Global rules can be added from any eligible page.
- A site rule can only be added for the current HTTP(S) hostname in the popup's scope selector.
- Configured sites are displayed even when they are not the current site, so their rules can be reviewed or removed.
- Submitting the same term in a scope updates that rule instead of adding a duplicate.
- Removing the last rule from a site leaves no persisted site entry after normalization; the section disappears on the next render.
- Sections use native details elements. Expanded state is UI-session state, not persisted user data.

## Deliberate limitations

- Matching is literal, not regex-based.
- Matching is case-insensitive but does not implement locale-specific linguistic rules.
- Scopes are host-only; there are no path scopes, subdomain inheritance rules, or per-element selectors.
- The extension processes text nodes and skips editable or executable content.
- Sync storage is user data, not a secure secret store. Never store credentials or tokens as rules.
