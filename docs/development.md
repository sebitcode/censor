# Development and verification

Veilmark has no build step. A valid checkout can be loaded directly into Chrome and tested with Node's built-in test runner.

## Prerequisites

- Chrome or Chromium with extension Developer mode available.
- Node.js with node:test support.
- Python 3 only when reproducing the release ZIP locally; the repository has no npm runtime dependencies.

## Local checks

Run these from the repository root:

~~~bash
npm test
node --check rules.js
node --check content.js
node --check popup.js
git diff --check
~~~

npm test currently covers:

- rule validation and duplicate normalization;
- case-insensitive literal matching;
- longer phrase precedence;
- literal replacement text;
- global/site scope precedence;
- document_start, the visibility CSS, and content-script ordering; and
- loading both current settings and legacy rules storage keys.

There is no browser automation harness. A change to popup or content-script behavior requires the manual matrix below.

## Load the unpacked extension

1. Open chrome://extensions.
2. Enable Developer mode.
3. Select Load unpacked.
4. Choose the repository root.
5. Open the Veilmark popup from an HTTP(S) page.

When the repository is in Ubuntu WSL, Windows Explorer can access it through:

~~~text
\\wsl.localhost\Ubuntu-24.04\home\sebitcode\projects\censor
~~~

After changing extension files, click Reload on the extension card and reload the test page. A popup reload alone does not always restart a content script that was already injected.

## Manual verification matrix

| Scenario | Expected result |
| --- | --- |
| Add a global rule | It applies on multiple HTTP(S) sites. |
| Add a current-site rule | It applies only to that normalized hostname. |
| Same term in global and site scopes | The site replacement wins on that hostname. |
| Phrase and shorter term overlap | The longer phrase is replaced as one match. |
| Replacement contains $& | The characters remain literal. |
| Remove a rule | Original text is restored without a page reload when possible. |
| Add content through a SPA or DOM update | Newly added text is processed. |
| Reload a page with rules already saved | No uncensored first-paint flash is visible under normal initialization. |
| Force a storage/initialization failure | The page becomes visible after the fail-safe rather than remaining hidden. |
| Open a chrome:// or Web Store page | The extension reports that the page cannot be modified; this is a platform restriction. |
| Open the popup on a second site | Its current-site section appears and existing site sections remain organized. |
| Close and reopen the popup | Rules persist; expanded section state may reset because it is session UI state. |

## Debugging

### Popup

Open the popup, right-click inside it, and choose Inspect. Check the Console for storage or active-tab errors. Popup APIs such as chrome.tabs.query() are not available inside the content page context.

### Content script

Inspect the target page and use the page DevTools Console. Content-script console messages can appear under the extension/content-script context depending on Chrome DevTools settings. Check the document for data-page-censor-ready="true" when diagnosing the visibility gate.

### Stored data

Use Chrome's extension storage inspection tools or temporary console logging while developing. The canonical key is settings; rules exists only for backward compatibility. Remove temporary logging before committing.

### Common causes of a false negative

- The page is a restricted Chrome URL.
- The hostname differs (www.example.com versus example.com).
- The text is inside an excluded tag or content-editable element.
- The extension was changed but not reloaded from chrome://extensions.
- A new storage key was written but not explicitly requested by storage.get().
- A rule was added to a different scope than the page being tested.

## Safe implementation patterns

- Use textContent, nodeValue, and DOM APIs rather than innerHTML.
- Escape terms before building a regular expression.
- Preserve source text separately from rendered text.
- Normalize at storage boundaries and before matching.
- Keep popup event handlers resilient to restricted tabs.
- Keep user-facing runtime strings in the existing English style unless localization is a deliberate feature.
- Add a focused test for each new rule or manifest invariant.

## Package contents

The release workflow includes only runtime files:

~~~text
manifest.json
content.css
content.js
rules.js
popup.html
popup.css
popup.js
assets/*
~~~

Tests, documentation, .git, .codegraph, node_modules, and previous dist/ packages are not part of the extension ZIP.
