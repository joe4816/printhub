# Six CUPS destinations

| Key | Exact installed name | Profile |
| --- | --- | --- |
| RECEIPT1 | Receipt Printer 1 | 80MM_RECEIPT |
| RECEIPT2 | Receipt Printer 2 | 80MM_RECEIPT |
| AP_TARDY | AP Office Tardy Printer | 80MM_RECEIPT |
| AP_COPIER | AP Office Copier | STATEMENT |
| MAIN_COPIER | Main Office Copier | STATEMENT |
| BACK_OFFICE | Back Office | A6 |

Back Office uses ISO A6 (105 × 148 mm), portrait, with 6 mm side margins. The installed media must advertise matching dimensions; physical B6 and quarter-letter are not substitutes. Legacy B6 queue identifiers render and submit as A6. AP/Main use Statement, landscape, single-sided. All use the approved shared PassKiosk PDF builder.

Bridge 0.6.0 supplies these exact-name bindings automatically; existing managed URI/name overrides remain authoritative. Missing or duplicate matches fail readiness; no device-default fallback. The test printer dropdown is independent of production routing.

The bridge audits capabilities once per minute, caches printer info to respect Chrome's capability-query quota, and sends ready binding keys to the authenticated source. The backend leaves unavailable destinations queued. Older bridge 0.5.0 may only claim RECEIPT1.

## Published bridge update

The signed CRX and matching update feed are published together at version 0.6.0. The signing key preserves extension ID dfdadlbllhjoadgkdlpgghfdklbhlpem and is excluded from the package and repository. Existing managed source credentials, endpoint URL, and extension policy need no changes.

Allow ChromeOS to update the managed extension, then refresh the hub. Confirm bridge version 0.6.0, use CHECK ROUTES, and verify six ready bindings before physical tests. Physical printer readiness must be checked on the Chromebook.
