# AI-agent playbook

This is the shortest safe operating guide for an AI agent modifying Veilmark. The root AGENTS.md is authoritative; this document explains how to apply it efficiently.

## Start every task

~~~bash
git rev-parse --show-toplevel
git status --short --branch
git diff --stat
~~~

Then:

1. Read the root AGENTS.md.
2. Read the relevant document from docs/.
3. Inspect the current source before making assumptions.
4. Check for user changes and preserve them.
5. Identify the smallest work unit and its verification.

For structural questions or impact analysis, use CodeGraph after confirming the repository root and .codegraph/ index. Fall back to normal file inspection only after CodeGraph initialization/query is unavailable or insufficient.

## Task routing

| User request | Inspect first | Verify with |
| --- | --- | --- |
| Change what gets censored | rules.js, content.js, docs/rules-and-storage.md | npm test plus text-node manual checks. |
| Add/edit scope behavior | rules.js, popup.js, popup.html | Global/current/other-site popup scenarios. |
| Fix page-load flash | manifest.json, content.css, content.js | Reload a page with a saved rule and test fail-safe behavior. |
| Change popup design | popup.html, popup.css, popup.js | Popup inspection and rerender/remove behavior. |
| Change persistence | rules.js, popup.js, content.js | Old rules data, current settings data, fresh page, open page. |
| Change permissions | manifest.json, README.md, release/privacy docs | Reload extension and review store disclosure impact. |
| Change release automation | workflow, docs/release.md, README.md | YAML parse, tests, package contents, tag/version validation. |
| Change branding | assets/icon.svg, icon PNGs, manifest.json | Verify every manifest path and raster dimension. |

## Non-negotiable behaviors

- Never use innerHTML for censorship.
- Never process scripts, styles, textareas, templates, noscript content, or content-editable fields.
- Never assume a hostname includes a scheme or path; scopes use normalized hostnames only.
- Never assume chrome.storage.sync.get() returns keys that were not requested.
- Never remove the first-paint CSS gate without replacing it with an equally early safe mechanism.
- Never treat replacement strings as regex replacement syntax.
- Never publish a tag whose version differs from manifest.json.
- Never put OAuth values in source, docs, commits, or logs.

## Change checklist

Before editing:

- [ ] Existing worktree changes are understood and preserved.
- [ ] The relevant architecture and storage invariants are known.
- [ ] The affected files and blast radius are identified.

While editing:

- [ ] The change preserves the shared CensorRules global contract.
- [ ] User-facing behavior remains literal, scoped, and local unless intentionally changed.
- [ ] Tests/docs are updated with the behavior.
- [ ] No unrelated refactor or dependency was introduced.

Before delivery:

- [ ] npm test passes.
- [ ] Focused syntax/manual checks pass.
- [ ] git diff --check passes.
- [ ] Documentation links and file paths are valid.
- [ ] The final summary names changed files, verification, and any remaining limitation.

## Commit guidance

Use one conventional commit per coherent work unit, for example:

~~~text
fix(content): load scoped settings on initial scan
docs: add maintainer and agent project reference
test(rules): cover hostname normalization edge case
ci: validate release package contents
~~~

Keep tests and docs with the behavior they explain. Do not add Co-Authored-By or any AI attribution.

## Known test boundary

The automated suite runs the rule engine in a Node VM and validates manifest/content-script invariants. It does not provide a real Chrome DOM, popup, chrome.* implementation, MutationObserver, restricted-page behavior, or Chrome Web Store review. Any change in those boundaries needs manual verification and explicit documentation.
