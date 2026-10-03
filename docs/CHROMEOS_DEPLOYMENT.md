# ChromeOS deployment — no-extension path

This is the preferred first PrintHub deployment.

## Goal

One managed ChromeOS PrintHub endpoint maps to one policy-assigned default printer.

```
ChromeOS device
    |
    +-- auto-launch PrintHub
    |
    +-- silent printing enabled
    |
    +-- default printer selected by policy
    |
    v
window.print()
    |
    v
that device's default printer
```

No Chrome extension is required for this model.

## 1. Dashboard

GitHub Pages:

`https://joe4816.github.io/printhub/`

The dashboard supports a persistent endpoint identity.

Example provisioning URL:

`https://joe4816.github.io/printhub/?endpoint=PH-FRONT-RECEIPT-01&label=Front%20Receipt&media=80MM_RECEIPT`

The endpoint / label / media values are identifiers and preferences, not credentials. When supplied, the page stores them locally for later launches.

## 2. Auto-launch

Configure the managed ChromeOS kiosk / web app to launch the PrintHub URL automatically.

The specific device can remain inside the common PrintHub OU while printer availability is narrowed using the appropriate device or configuration group.

## 3. Managed printer

Assign the intended physical printer to the device / group.

For the simple endpoint design, expose only the printer(s) needed for that endpoint and configure the intended destination as the default printer.

PrintHub itself does not need to know the Chrome printer ID.

## 4. Silent printing

Enable ChromeOS silent printing for the PrintHub kiosk environment.

With the policy effective, `window.print()` should send the page to the configured default printer without showing the ordinary print-preview interaction.

## 5. Test

The dashboard contains **Browser Print Test**.

Choose the media profile and press:

**PRINT TO DEVICE DEFAULT**

The test is entirely local. It does not claim a production queue job.

Interpret the result:

- physical output on the intended printer with no dialog: the simple ChromeOS endpoint path works;
- preview / confirmation appears: silent-printing policy is not effective for that session;
- output goes to the wrong printer: default-printer / printer-availability policy needs adjustment;
- no output: investigate Chrome printing / printer configuration before connecting a live queue.

## 6. Production queue

Do not connect production polling until:

- endpoint identity is final;
- the printer test succeeds;
- the backend can return only jobs authorized for this endpoint;
- the job payload has a renderer / printable artifact contract;
- completion and failure callbacks are defined.

## Optional extension path

An earlier `chrome.printing` experiment is preserved under `optional/chrome-extension/`.

That path becomes useful only if a single ChromeOS endpoint must dynamically enumerate and select among multiple physical printers. It is not required for the first PrintHub deployment.
