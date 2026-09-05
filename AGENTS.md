# AGENTS.md

## Project mission

Veilmark is a dependency-free Chrome Manifest V3 extension that replaces user-defined words and phrases in visible web-page text. It stores rules in chrome.storage.sync, separates global rules from hostname-specific rules, and applies changes without a backend.

This file contains the non-negotiable project rules. Read it before editing source files. Read docs/README.md for the detailed architecture, development, storage, release, and agent references.

## Required operating procedure

1. Run git status --short --branch and inspect existing diffs before changing anything.
2. Read the relevant document in docs/ before touching the corresponding area.
3. Preserve user work. Do not reset, clean, checkout over, or rewrite unrelated changes.
4. Make the smallest coherent change. Keep tests and documentation with the behavior they describe.
5. Run npm test and any focused manual checks relevant to the change.
6. Update the relevant documentation when a behavior, storage contract, workflow, permission, or limitation changes.
7. Use conventional commits. Never add Co-Authored-By or AI attribution.

## Source and artifact rules

- Runtime code is plain JavaScript, HTML, and CSS. There is no bundler, transpiler, framework, or build step.
- Keep technical artifacts, identifiers, comments, and documentation in English unless a user explicitly requests another language.
- Do not add a dependency just to solve a problem that can be handled by the existing browser APIs or Node.js standard library.
- Do not introduce a backend, remote rule service, analytics, or network request. Veilmark is intentionally local/user-controlled apart from Chrome Sync.
- Do not commit OAuth credentials, refresh tokens, access tokens, ZIP packages, or generated dist/ output.
- assets/icon.svg is the editable icon source. The PNG derivatives are required by the manifest and must remain available at 16, 32, 48, and 128 pixels.
- Keep manifest.json valid JSON and preserve the current Manifest V3 structure unless a migration is intentional and documented.

## Architecture invariants

### Shared rule engine

rules.js is loaded before popup.js in the popup and before content.js in web pages. It runs as an IIFE and exposes globalThis.CensorRules. Preserve that global contract when changing the rule engine.

The rule engine must continue to:

- trim and validate terms;
- retain non-empty replacement text exactly as entered;
- deduplicate terms case-insensitively, keeping the last valid rule;
- normalize hostnames to lowercase without trailing dots;
- combine global rules with rules for the active hostname;
- prefer the site-specific replacement when the same term exists in both scopes;
- match literal text case-insensitively, not regular-expression syntax;
- match longer phrases before shorter overlapping terms; and
- use a replacement callback so replacement text such as $& stays literal.

### Content processing

content.js changes text nodes, not innerHTML. It must continue to skip SCRIPT, STYLE, NOSCRIPT, TEMPLATE, TEXTAREA, and content-editable elements. Do not censor attributes, markup, scripts, styles, or editable input content unless the product requirement explicitly changes.

The content script keeps the original text in a WeakMap and tracks the last rendered text in a second WeakMap. This prevents repeated scans from censoring a replacement again and lets a rule removal restore the original text.

The MutationObserver is required because modern pages add content after the initial load. Preserve both character-data handling and added-subtree handling.

### First-paint protection

The content script runs at document_start. content.css hides the document until html[data-page-censor-ready="true"] is set. The first scan happens at DOMContentLoaded and the page is revealed afterwards; a 2.5-second fail-safe prevents a permanently hidden page if initialization fails.

When changing initialization, preserve all three parts together:

1. document_start in manifest.json;
2. the visibility gate in content.css; and
3. revealPage() after the first scan plus its fail-safe timer.

### Storage contract

The current storage shape is:

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

The legacy top-level rules array is still read for migration compatibility. The popup writes the normalized settings object when it finds legacy data. Content initialization must request both settings and rules explicitly; chrome.storage.sync.get({ rules: [] }) does not request the separate settings key.

### Popup scope behavior

- The popup always shows the global section.
- It shows the current HTTP(S) hostname first, followed by configured hostnames sorted alphabetically.
- The current site section is expanded on first render; details state is retained across rerenders while the popup is open.
- The scope selector allows adding a global rule or a rule for the current hostname only. Visit another site to add a rule for that site.
- Existing rules are updated when the same term is submitted in the same scope; the comparison is case-insensitive.
- Removing a rule persists storage and asks the active tab to restore the original text.

## Verification commands

Run from the repository root:

~~~bash
npm test
node --check rules.js
node --check content.js
node --check popup.js
git diff --check
~~~

For a browser check, load the repository directory through chrome://extensions with Developer mode enabled, then reload the extension and the test page after source changes. On Windows with the project in Ubuntu WSL, the directory is:

~~~text
\\wsl.localhost\Ubuntu-24.04\home\sebitcode\projects\censor
~~~

## Release safety

The deployment workflow is .github/workflows/publish-chrome-web-store.yml. It:

- runs manually or on tags matching v*.*.*;
- validates that the tag matches manifest.json version;
- runs tests;
- creates a clean ZIP using Python's standard-library zipfile;
- exchanges the configured OAuth refresh token for an access token;
- uploads through Chrome Web Store API v2 and polls asynchronous upload status; and
- submits the item for review with blockOnWarnings: true.

It requires the five GitHub repository secrets documented in docs/release.md. The initial store item and its first upload/listing still require the Chrome Developer Dashboard. Never weaken secret validation or print secret values.

## Documentation map

- docs/README.md: documentation index and quick orientation.
- docs/architecture.md: runtime components and data flows.
- docs/rules-and-storage.md: rule semantics and persistence schema.
- docs/development.md: local setup, tests, manual verification, and debugging.
- docs/release.md: Chrome Web Store setup, secrets, workflow, and releases.
- docs/agent-playbook.md: task-routing and AI-agent checklist.
