# Veilmark

Veilmark is a dependency-free Chrome Manifest V3 extension that replaces selected words and phrases with custom text while you browse.

## Features

- Global rules that apply to every website.
- Site rules grouped by hostname, such as `example.com`.
- Site rules override global rules when they use the same term.
- Case-insensitive literal matching for words and phrases.
- Automatic processing of content added after the page loads.
- Collapsible rule sections in the popup.
- Original text restoration when a rule is removed.
- Initial page hiding to prevent an uncensored content flash.

## Use locally

Veilmark runs directly from the repository; there is no build step.

### Load the unpacked extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the project directory.

If the project is inside Ubuntu WSL, select this Windows path:

```text
\\wsl.localhost\Ubuntu-24.04\home\sebitcode\projects\censor
```

5. Open an HTTP(S) page.
6. Open the **Veilmark** popup and add a rule.

### Apply source changes

After changing extension files, run `npm test`, select **Reload** on the extension card, and reload the page being tested.

## Add a rule

1. Open the Veilmark popup.
2. Choose a scope:
   - **All pages (global)** applies the rule everywhere.
   - **Current site** applies the rule to the current hostname.
3. Enter the word or phrase to censor.
4. Enter the replacement text.
5. Select **Add rule**.

The popup keeps one collapsible section for global rules and one section for every configured site. Rules are stored with `chrome.storage.sync`.

## How it works

The extension combines global rules with rules for the current hostname. If both scopes contain the same term, the site-specific replacement wins. Matching is performed on text nodes instead of raw `innerHTML`, which keeps markup, attributes, scripts, and styles intact.

The content script runs at `document_start`. A small CSS gate keeps the document visually hidden until the first scan finishes. A `MutationObserver` then processes text added by single-page applications and other dynamic interfaces.

## Permissions

| Permission | Purpose |
| --- | --- |
| `storage` | Persist global and site-specific rules with `chrome.storage.sync`. |
| `activeTab` | Apply updated rules to the tab where the popup is used. |
| `scripting` | Initialize the content script in tabs that were already open. |

The extension changes visible page text; it does not block network requests or prevent a website from downloading its content.

## Development

There is no build step. Run the tests with:

```bash
npm test
```

The tests cover rule normalization, literal matching, scope precedence, storage compatibility, and manifest timing.

For the complete maintainer and AI-agent reference, start with [`AGENTS.md`](AGENTS.md) and [`docs/README.md`](docs/README.md).

## Publish to the Chrome Web Store

The repository includes `.github/workflows/publish-chrome-web-store.yml`. It runs on `v*.*.*` tags or from **Actions > Publish Veilmark to Chrome Web Store > Run workflow**.

### One-time setup

The current Chrome Web Store API requires an existing store item. Create the item manually in the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole), complete the Store listing and Privacy tabs, and then configure these GitHub repository secrets:

| Secret | Value |
| --- | --- |
| `CWS_PUBLISHER_ID` | Publisher ID from the Developer Dashboard. |
| `CWS_EXTENSION_ID` | ID of the Veilmark item in the Chrome Web Store. |
| `CWS_CLIENT_ID` | OAuth client ID from the Google Cloud project. |
| `CWS_CLIENT_SECRET` | OAuth client secret. |
| `CWS_REFRESH_TOKEN` | OAuth refresh token with the `chromewebstore` scope. |

Enable the Chrome Web Store API in Google Cloud before creating the OAuth credentials. Keep all five values in GitHub Secrets; never commit them to the repository. See the [Chrome Web Store API setup guide](https://developer.chrome.com/docs/webstore/using-api) for the Google Cloud and OAuth steps.

### Release a version

The tag must match the `version` in `manifest.json`:

```bash
# First update manifest.json, for example from 1.0.0 to 1.0.1.
git commit -am "release: bump extension version to 1.0.1"
git tag v1.0.1
git push origin main --tags
```

The workflow runs the tests, creates a clean extension ZIP, uploads it through Chrome Web Store API v2, waits for asynchronous upload completion, and submits it for review. Chrome Web Store approval is still required before the new version becomes available to users.

## Project structure

| File | Purpose |
| --- | --- |
| `manifest.json` | Chrome Manifest V3 configuration and icon registration. |
| `popup.html`, `popup.css`, `popup.js` | Rule management interface. |
| `rules.js` | Rule normalization, scope handling, and matching. |
| `content.js`, `content.css` | Page scanning, replacement, and first-paint protection. |
| `assets/icon.svg` | Editable vector source for the extension brand icon. |
| `assets/icon*.png` | Raster icon sizes used by Chrome. |
| `tests/` | Node.js tests for the rule engine and manifest. |

The SVG is kept as the editable source; the manifest registers PNG derivatives because Chrome does not support SVG files for extension icons.

## License

This project is licensed under the [MIT License](LICENSE).
