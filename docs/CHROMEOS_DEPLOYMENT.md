# ChromeOS deployment

## 1. Publish the dashboard

Enable GitHub Pages for this repository using the `main` branch and repository root.

Expected URL:

`https://joe4816.github.io/printhub/`

## 2. Package / publish the extension

The extension source is in `extension/`.

It requires:
- Manifest V3;
- `printing` permission;
- `storage` permission;
- a content script scoped only to the PrintHub GitHub Pages origin.

For production, distribute the extension using an enterprise-supported extension deployment method so it has a stable extension ID.

## 3. Force-install the extension

In Google Admin, force-install the PrintHub extension on the PrintHub device / OU.

The kiosk web app and the extension are separate:
- web app = visible dashboard;
- extension = privileged ChromeOS printing bridge.

## 4. Allow unattended `chrome.printing`

Chrome normally prompts the user to confirm a `chrome.printing.submitJob()` call.

Add the final PrintHub extension ID to the Google Admin `PrintingAPIExtensionsAllowlist` policy to bypass that confirmation for the managed appliance.

## 5. Install managed printers

Assign the required printers to the PrintHub ChromeOS device / OU.

The dashboard's **Managed Printers** card should then enumerate them through `chrome.printing.getPrinters()`.

## 6. Optional managed extension settings

The extension declares these policy values:

- `deviceName`
- `allowTestPrint`
- `sourceConfigJson` (reserved for source adapters)

Do not place production worker keys in GitHub source code.

## 7. Smoke test

Before connecting any production source queue:

1. launch PrintHub;
2. confirm **Print extension = Connected**;
3. confirm the expected printers appear;
4. choose a printer;
5. press **PRINT TEST PAGE**;
6. confirm the test reaches that exact printer;
7. confirm no print confirmation appears once the extension allowlist policy is active.

Only after that should source polling be enabled.
