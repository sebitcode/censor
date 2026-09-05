# Page Censor

Page Censor is a dependency-free Chrome Manifest V3 extension that replaces user-selected words and phrases with custom text on web pages.

## Quick path

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this directory.
4. Open the extension popup, choose **All pages (global)** or the current site, enter a word and its replacement, then select **Add rule**.
5. Visit or reload a web page to see the rule applied.

## Behavior

- Rules are saved with `chrome.storage.sync`.
- Rules can be scoped globally or to a specific site hostname. Site rules override a global rule when they use the same term.
- The popup displays one section for global rules and one section for every configured site.
- Rule sections are collapsible; the current site starts expanded and other sections stay compact.
- Matching is literal and case-insensitive.
- Replacement is limited to visible page text nodes; HTML markup, attributes, scripts, styles, textareas, and content-editable fields are left untouched.
- A `MutationObserver` applies rules to content added after the page loads.
- Removing a rule restores the original text when the page content is rescanned.
- The page stays visually hidden until the initial scan completes, preventing an uncensored content flash. A short fail-safe reveals it if initialization cannot finish.

## Verification

Run the rule-engine tests with:

```bash
npm test
```

The extension has no build step. After changing `manifest.json` or extension scripts, select **Reload** on its card in `chrome://extensions`.
