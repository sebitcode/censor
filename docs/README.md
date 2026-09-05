# Veilmark project knowledge

This directory is the maintainer and AI-agent reference for Veilmark. It explains the decisions that are easy to lose when working from a small static extension repository.

## Quick path

| Need | Read |
| --- | --- |
| Understand runtime behavior | [architecture.md](architecture.md) |
| Change matching, scopes, or persistence | [rules-and-storage.md](rules-and-storage.md) |
| Install, test, debug, or manually verify | [development.md](development.md) |
| Configure or execute a store release | [release.md](release.md) |
| Make a safe change as an AI agent | [agent-playbook.md](agent-playbook.md) |

Start with the root [AGENTS.md](../AGENTS.md). It contains the invariants that must survive every change.

## Five-minute orientation

Veilmark has two browser contexts and one shared module:

~~~text
Popup                  chrome.storage.sync                 Web page
popup.html/js  ─────── settings ────────┬──────> rules.js + content.js
                                        │
                                        └──────> content.css first-paint gate
~~~

- rules.js is the shared, dependency-free rule engine.
- popup.js reads the active tab hostname, edits rules, persists settings, and asks the active tab to refresh.
- content.js selects rules for window.location.hostname, transforms text nodes, and observes dynamic DOM changes.
- manifest.json declares the permissions, popup, icons, and document_start content scripts.
- .github/workflows/publish-chrome-web-store.yml packages and publishes tagged releases.

## Commands

~~~bash
npm test
node --check rules.js
node --check content.js
node --check popup.js
git diff --check
~~~

There is no local build step and no node_modules requirement for the test suite. The release workflow uses the Node.js and Python tools available on the GitHub runner.

## Change routing

| Change | Primary files | Required follow-up |
| --- | --- | --- |
| Matching or precedence | rules.js, tests/rules.test.js | Update rule tests and rules-and-storage.md. |
| Saved data shape | rules.js, popup.js, content.js | Preserve legacy migration, update tests/docs, verify a fresh page and an already-open page. |
| Initial page visibility | manifest.json, content.css, content.js | Verify no uncensored first paint and that the fail-safe still reveals the page. |
| Popup layout or scope UX | popup.html, popup.css, popup.js | Manually test global/current/other-site sections and popup rerenders. |
| Extension permissions | manifest.json | Explain the permission in README.md and docs/architecture.md; recheck store privacy disclosures. |
| Icons or branding | assets/icon.svg, PNG derivatives, manifest.json | Regenerate/validate all four PNG sizes; do not remove PNGs from the package. |
| Release automation | .github/workflows/publish-chrome-web-store.yml | Validate YAML, package contents, secrets, and release docs. |

## Documentation maintenance

Update documentation when any of these change:

- the storage key or rule precedence;
- the set of excluded elements;
- manifest permissions, matches, or run timing;
- the package file list or release trigger;
- the OAuth secret names or Chrome Web Store API endpoint; or
- a known limitation or manual verification step.

Do not turn this directory into a changelog. Keep durable behavior and decisions here; use Git history for the detailed chronology.
