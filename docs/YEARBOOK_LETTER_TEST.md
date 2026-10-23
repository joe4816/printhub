# Yearbook Letter printing - isolated test (NOT DEPLOYED)

The existing `AP_COPIER` route remains Statement landscape, and all existing
PassKiosk printer bindings remain unchanged. This patch adds one new alias
`YEARBOOK_LETTER` pointing to the SAME installed ChromeOS printer
`AP Office Copier`.

## Existing queued proof

- Source: a three-page **fictional** US-Letter portrait PDF in the yearbook TEST folder.
- Google Drive PDF ID: `1YkBH3C9wt77Er_Sc3o6Wrag0gLUHHP4v`.
- PassKiosk workbook has `Yearbook_Test_Print_Queue` with job
  `YB-LETTER-PRINT-TEST-20261023-001` already in `QUEUED`.
- Do not rerun another job with a different ID for the same test.

## Chromebook prerequisite

This branch changes the Chrome extension source manifest from 0.6.3 to 0.6.4,
but **no signed CRX or update feed is changed here**. Managed Chromebooks will
not receive a new extension simply from merging this change. The exact
existing private key must sign an updated CRX, and only then can the CRX and
matching `optional/chrome-extension/update.xml` be published together.
Preserve managed policy, secret endpoint key, and extension ID.

The bridge fails closed if its driver does not advertise
215900 x 279400 micron Letter paper. It chooses portrait and single-sided.

### Cassette 1 limitation

The supplied copier screenshot confirms Cassette 1 holds Letter, Cassette 2
holds Statement, and MP tray holds A4. However, ChromeOS `chrome.printing`
print tickets expose media size but do not provide a portable, documented
Cassette-1 selection. This patch deliberately **does not claim to force**
Cassette 1. With only one Letter cassette in the screenshot, the printer's
auto-select-by-paper-size behavior is the likely path, but physical output
must be verified. Do not insert raw PJL into a PDF.

## Required Apps Script changes (not part of this PrintHub repository)

The user already installed `YearbookLetterPrintTest.gs` in the deployed
**PassKiosk** Apps Script project and queued the one test job. The GAS functions
`ybLetterTestPollHook_` and `ybLetterTestCompleteHook_` must also be called
from the existing authenticated PassKiosk `PrintHubEndpoint.gs`:

In `printHubEndpointPoll_(body)`, **after authentication and enabled check,
before acquiring the ordinary Print_Jobs lock**:

```javascript
const ybJob = ybLetterTestPollHook_(body);
if (ybJob) return {
  ok:true,
  endpointId:PK_PRINTHUB.ENDPOINT_ID,
  pollAfterMs:PK_PRINTHUB.POLL_AFTER_MS,
  jobs:[ybJob]
};
```

In `printHubEndpointComplete_(body)`, **after authentication**, before
the ordinary Print_Jobs lookup:

```javascript
const ybReply = ybLetterTestCompleteHook_(body);
if (ybReply) return ybReply;
```

**Safety switch:** the current PassKiosk development branch checks the separate Script Property `YEARBOOK_LETTER_TEST_ARMED`; its default is OFF. Only an explicit `armYearbookLetterPrintTest()` in Apps Script permits the test to be claimed. `disarmYearbookLetterPrintTest()` stops new claims; it cannot cancel an already submitted ChromeOS print. Existing PrintHub routes are unaffected by this switch.

**Important:** the GAS hook claims a test job with a 10-minute lease but
does not itself implement claim recovery. The single job should be left
queued until both ends are ready; do not enable live test polling early.
For a real production design, add retry and failure recovery after
physical proof.

The existing extension web app deployment must be updated in place to avoid
changing the managed endpoint URL.

## Verification

1. Review this pull request, run `npm test` and `npm run validate`.
2. Install/redeploy GAS hooks on existing PassKiosk deployment.
3. Publish the updated PrintHub static page.
4. Build and sign matching 0.6.4 extension with existing private key,
   publish matching CRX and update XML in a single verified release.
5. Confirm ChromeOS bridge 0.6.4 and YEARBOOK_LETTER ready on the kiosk while the test switch remains OFF.
6. Check other PrintHub receipt and Statement routes before activating the yearbook test.
7. Execute `armYearbookLetterPrintTest()` once in the deployed GAS project and monitor `getYearbookLetterPrintTestStatus()`.
8. Physically inspect the copier for all three Letter sheets from Cassette 1.

## Rollback caution

Changing an update feed from 0.6.4 back to 0.6.3 does not normally downgrade an already-updated managed Chrome extension. If a bridge regression occurs, a new signed 0.6.5 package restored from known-good 0.6.3 source may be required. Keep the private key private and retain the old tested source/CRX. Stop yearbook claims with `disarmYearbookLetterPrintTest()` before troubleshooting; do not disable all PassKiosk printing unless absolutely necessary.

No student records, parent names or signing secrets belong in this repository.
