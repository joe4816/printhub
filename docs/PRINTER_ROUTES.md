# Six CUPS destinations

| Key | Exact installed name | Profile |
| --- | --- | --- |
| RECEIPT1 | Receipt Printer 1 | 80MM_RECEIPT |
| RECEIPT2 | Receipt Printer 2 | 80MM_RECEIPT |
| AP_TARDY | AP Office Tardy Printer | 80MM_RECEIPT |
| AP_COPIER | AP Office Copier | STATEMENT |
| MAIN_COPIER | Main Office Copier | STATEMENT |
| BACK_OFFICE | Back Office | B6 |

Back Office alone uses the existing B6 driver setting with physical quarter-letter paper. AP/Main use Statement, landscape, single-sided. All use the approved shared PassKiosk PDF builder.

Bridge 0.6.0 supplies these exact-name bindings automatically; existing managed URI/name overrides remain authoritative. Missing or duplicate matches fail readiness; no device-default fallback. The test printer dropdown is independent of production routing.

The bridge audits capabilities once per minute, caches printer info to respect Chrome's capability-query quota, and sends ready binding keys to the authenticated source. The backend leaves unavailable destinations queued. Older bridge 0.5.0 may only claim RECEIPT1.

## Installation boundary

The extension source manifest is 0.6.0. Hosted update.xml and CRX stay at 0.5.0 until the owner packs a replacement with the existing signing key. Never advance update.xml without the matching signed CRX. Never share the signing key. The current managed source credentials and endpoint URL need no changes.

Pack the updated optional/chrome-extension directory with the existing private key using Chrome's Pack extension command. The ID must remain dfdadlbllhjoadgkdlpgghfdklbhlpem. Upload the resulting CRX to printhub-bridge.crx and advance the hosted update.xml to 0.6.0 together. Then refresh the hub, check Printer Routes, and verify six ready bindings before physical tests.
