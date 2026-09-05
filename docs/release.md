# Chrome Web Store release guide

The repository already contains an active GitHub Actions workflow at .github/workflows/publish-chrome-web-store.yml. It uses Chrome Web Store API v2 and publishes only when its validation and upload steps succeed.

## Release model

~~~text
maintainer updates source and manifest version
  -> pushes commit and matching v*.*.* tag
  -> GitHub Actions runs tests and packages runtime files
  -> OAuth refresh token produces a short-lived access token
  -> API v2 uploads the ZIP to the existing item
  -> workflow polls asynchronous upload status
  -> API v2 submits the item for Chrome review
  -> Google approves and publishes according to store settings
~~~

The workflow submits the package for review; it cannot guarantee immediate public availability. Chrome Web Store review remains an external gate.

## One-time Chrome Developer Dashboard setup

1. Register and finish the developer account, including the trader/non-trader declaration.
2. Enable the required account security, including two-step verification.
3. In the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole), choose Add new item and upload the first ZIP manually.
4. Complete the Store listing and Privacy tabs before attempting an API publish.
5. Record the Publisher ID from the publisher settings and the item/extension ID from the dashboard or item URL.

The v2 upload endpoint updates an existing item. The initial item creation and first upload therefore remain manual. See Google's [first-publication guide](https://developer.chrome.com/docs/webstore/publish/) and [v2 upload reference](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/media/upload).

## Google Cloud and OAuth setup

Follow the [official Chrome Web Store API setup guide](https://developer.chrome.com/docs/webstore/using-api):

1. Create or select a Google Cloud project.
2. Enable Chrome Web Store API.
3. Configure the OAuth consent screen. The official flow uses an external app and a test user so the project can be used immediately.
4. Create an OAuth client with application type Web application.
5. Add https://developers.google.com/oauthplayground as an authorized redirect URI.
6. In OAuth Playground, select Use your own OAuth credentials.
7. Authorize the scope:

   ~~~text
   https://www.googleapis.com/auth/chromewebstore
   ~~~

8. Exchange the authorization code for tokens and retain the refresh token securely.

The Google account authorizing the refresh token must own or have access to the Chrome Web Store publisher/item. Do not commit the client secret, refresh token, or generated access token.

## GitHub repository secrets

Add these as repository secrets under [Settings -> Secrets and variables -> Actions](https://github.com/sebitcode/censor/settings/secrets/actions):

| Secret | Value |
| --- | --- |
| CWS_PUBLISHER_ID | Publisher ID from the Chrome Developer Dashboard. |
| CWS_EXTENSION_ID | Existing Veilmark item/extension ID. |
| CWS_CLIENT_ID | OAuth client ID from Google Cloud. |
| CWS_CLIENT_SECRET | OAuth client secret from Google Cloud. |
| CWS_REFRESH_TOKEN | OAuth refresh token authorized with the Chrome Web Store scope. |

The workflow fails early if any of these values is empty. Keep them as secrets, not repository variables or committed files.

## What the workflow validates

The workflow performs these steps:

1. Checks out the tagged source.
2. Parses manifest.json and validates Chrome's numeric version format.
3. On a tag run, requires v1.2.3 to match manifest version 1.2.3 exactly.
4. Runs npm test.
5. Creates dist/veilmark-<version>.zip with Python's standard-library zipfile so the job does not depend on the runner's zip executable.
6. Validates all five secrets.
7. Exchanges the refresh token at https://oauth2.googleapis.com/token.
8. Uploads to Chrome Web Store API v2.
9. Polls fetchStatus when the upload is asynchronous, for up to twelve ten-second attempts.
10. Publishes with DEFAULT_PUBLISH and blockOnWarnings: true.

The package contains only the files listed in development.md. dist/ is ignored and is never committed.

## Normal release

Start from a clean branch and update the manifest version. Example:

~~~bash
# edit manifest.json: 1.0.0 -> 1.0.1
npm test
git add manifest.json
git commit -m "release: bump extension version to 1.0.1"
git tag v1.0.1
git push origin main --tags
~~~

The tag push starts Publish Veilmark to Chrome Web Store. A manual run is also available under Actions, but it still requires a version that Chrome accepts for the target item.

For future releases, increment the manifest version; Chrome rejects an upload that reuses the existing version.

## Failure diagnosis

| Symptom | Likely cause | Check |
| --- | --- | --- |
| Missing secret | A repository secret is absent or empty. | Compare names exactly with the table above. |
| OAuth token request fails | Wrong client credentials, refresh token, or OAuth scope. | Recreate/verify the OAuth Playground authorization. |
| NOT_FOUND or ownership error | Wrong publisher/item ID or wrong Google account. | Confirm the item belongs to the authorized publisher. |
| Upload rejected for version | Tag and manifest mismatch, or version not incremented. | Compare github.ref_name and manifest.json.version. |
| Upload remains IN_PROGRESS | Chrome is processing the package. | Check the poll logs and Chrome Developer Dashboard. |
| Publish warns or fails | Store listing/privacy/manifest policy issue. | Read the API response and dashboard review message. |
| Page is not updated after a successful publish | Chrome has not approved/released the submission yet. | Check the item review status; API submission is not approval. |

## Security and rollback

- Protect main and release tags so only maintainers can trigger production publication.
- Rotate the refresh token immediately if it is exposed.
- Do not paste secrets into workflow logs, issue comments, or documentation.
- To roll back runtime behavior, publish a new higher extension version containing the corrected source; Chrome versions cannot be reused.
- Reverting a Git commit does not undo a version already submitted to Chrome. Treat store submissions as external state.
