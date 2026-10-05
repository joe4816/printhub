# Managed ChromeOS multi-printer bridge

This extension is the canonical PassGen receipt-print transport.

It runs only on managed ChromeOS and gives PrintHub access to the ChromeOS-only `chrome.printing` API so one managed Chromebook can:

- enumerate the printers currently installed by policy;
- resolve a logical PrintHub binding to the current Chrome runtime printer;
- submit PDF jobs silently to that exact printer;
- request trim/cut when the printer exposes the capability;
- receive Chrome print-job status events.

## Current versions

Source manifest:

```
0.5.0
```

The installed production extension remains on the last packaged version until a new CRX is signed with the **same existing private key** and the hosted update metadata is advanced.

Never commit, upload, or paste the private signing key into ChatGPT, GitHub, Apps Script, or Google Admin.

## Production source security

Version 0.5.0 adds the protected PassKiosk source connection.

The public PrintHub page never receives the endpoint credential. The credential is stored in Chrome enterprise managed storage as `sourceConfigJson`, read only by the extension service worker.

Example structure:

```json
{
  "endpointUrl": "<APPS_SCRIPT_WORKER_EXEC_URL>",
  "endpointId": "PH-FRONT-RECEIPT-01",
  "endpointKey": "<GENERATED_IN_APPS_SCRIPT>",
  "pollAfterMs": 2500,
  "bindings": {
    "RECEIPT1": {
      "name": "Receipt Printer 1",
      "uri": "socket://10.158.82.22:9100"
    }
  }
}
```

The endpoint key must be generated in Apps Script and copied directly into managed extension policy. It must not be committed to this repository.

## Self-hosted update rule

The extension ID must remain:

```
dfdadlbllhjoadgkdlpgghfdklbhlpem
```

To preserve that ID, every new CRX must be packed with the same existing private signing key.

Do not advance `optional/chrome-extension/update.xml` until the matching CRX has actually been rebuilt and uploaded at the root `printhub-bridge.crx` path. The update XML version, manifest version, and packaged CRX version must agree.
