# Architecture and runtime flows

Veilmark is a static Manifest V3 extension. It has no service worker, backend, bundler, framework, or runtime dependency. The browser loads the same small set of files directly from the extension package.

## Component map

| Component | Context | Responsibility |
| --- | --- | --- |
| manifest.json | Extension metadata | Declares Manifest V3, permissions, popup, icons, matches, and script timing. |
| popup.html | Extension popup | Provides the rule form, scope selector, collapsible sections, and status area. |
| popup.css | Extension popup | Styles the popup and its global/site sections. |
| popup.js | Extension popup | Reads the active tab, edits scopes, persists settings, renders sections, and refreshes the active tab. |
| rules.js | Popup and page | Exposes globalThis.CensorRules for normalization, scope selection, and matching. |
| content.css | Matched web pages | Hides the document until the initial censorship scan completes. |
| content.js | Matched web pages | Loads settings, censors text nodes, restores originals, and observes DOM mutations. |
| assets/icon.svg | Source asset | Editable vector brand source. |
| assets/icon16.png, icon32.png, icon48.png, icon128.png | Package assets | Raster icon sizes referenced by Chrome. |
| .github/workflows/publish-chrome-web-store.yml | GitHub Actions | Tests, packages, uploads, and submits tagged releases. |

## Manifest and permissions

The manifest currently declares:

- storage: persist the normalized rule settings in chrome.storage.sync.
- activeTab: work with the tab from which the popup was opened.
- scripting: inject rules.js and content.js into an already-open eligible tab when the content script is not present.
- HTTP and HTTPS content-script matches only.
- run_at: document_start so the visibility gate is installed as early as possible.

The content script is not injected into browser-internal pages such as chrome:// pages, extension pages, or other restricted contexts. applySettingsToActiveTab() reports those cases as a page that cannot be modified instead of treating them as a storage failure.

## Startup flow

~~~text
Browser starts matching document
  -> content.css hides html/body/descendants
  -> rules.js creates CensorRules
  -> content.js reads { settings, rules } from chrome.storage.sync
  -> normalizeSettings() selects global + current hostname rules
  -> content.js scans document.body text nodes
  -> html[data-page-censor-ready="true"] reveals the page
  -> MutationObserver handles later text and subtree additions
~~~

The page is revealed after the first scan, not merely after storage resolves. A 2.5-second timer is a safety valve for initialization errors; it prevents the extension from leaving a page permanently invisible.

## Popup-to-page update flow

~~~text
User submits/removes a rule
  -> popup.js normalizes and updates one scope
  -> chrome.storage.sync.set({ settings })
  -> popup.js sends { type: "rules-updated", settings } to the active tab
  -> content.js selects rules for window.location.hostname
  -> content.js schedules a full scan
~~~

If the active tab has no content script, the popup falls back to chrome.scripting.executeScript() with rules.js and content.js. This fallback cannot bypass Chrome's restricted-page rules.

The content script also listens to chrome.storage.onChanged, so changes made in another popup/window are applied without requiring a page reload.

## Text-processing flow

1. processTree() ignores disconnected nodes, excluded elements, and editable content.
2. A TreeWalker visits text nodes below an eligible element.
3. processTextNode() records the source text in originalText and computes the next text with the current matcher.
4. Only textNode.nodeValue is replaced; surrounding markup and attributes remain intact.
5. renderedText records the result so the extension can distinguish its own replacement from an external page mutation.
6. When settings change, the rendered map is reset while the original map remains, allowing removal or replacement of rules to restore the source text.

Excluded tags are intentionally conservative:

~~~text
SCRIPT, STYLE, NOSCRIPT, TEMPLATE, TEXTAREA, contenteditable elements
~~~

Do not change this list casually. A broader scan can corrupt code examples, scripts, form input, editor content, or page behavior.

## Privacy and security boundary

- The extension does not make network requests.
- Rules are stored in Chrome Sync, which may synchronize them across the user's Chrome profile.
- The extension reads and changes visible text on matched HTTP(S) pages; it does not block requests or inspect raw network responses.
- Matching is literal and local. There is no server-side moderation or analytics.
- Release credentials belong only in GitHub Secrets and Google Cloud/OAuth configuration, never in runtime source.
