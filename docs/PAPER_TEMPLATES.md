# PassKiosk paper templates

Builds 0.8.3 and later use one content builder in `shared/passkiosk-receipt-pdf.js` for all six examples and all three paper profiles. Correct fields, headings, issuer/date placement, parent notification, directions, signatures, acknowledgements, return lines, and delivery-header alignment must be changed in that builder, not copied into a paper-specific fork.

| Profile | PDF size | Layout |
| --- | --- | --- |
| `80MM_RECEIPT` | 80 mm wide, content-driven height | Approved receipt spacing; activity-bus receipt preserved |
| `STATEMENT` | 8.5 × 5.5 inches | Half-letter landscape |
| `B6` | 4.25 × 5.5 inches | Actual quarter-letter sheet, portrait |

Sal confirmed that the copier already successfully prints quarter-letter sheets using its B6 setting. B6 here is that existing printer alias, not ISO or JIS B6 paper. Keep the copier configuration. Do not replace this with nominal B6 PDF dimensions.

## Entry points

- `buildPassKioskPdf(transaction, paperProfile)` renders the selected format with an already prepared signature raster.
- `buildPrintablePassKioskPdf(transaction, paperProfile)` privately decodes the backend-provided signature image, then invokes the same builder.
- Existing receipt entry points delegate to the same builder and preserve receipt PDF bytes for the same input.
- The hub's **PassKiosk Template Preview** card downloads synthetic samples in all three sizes. It does not record students, assign detention, queue jobs, or print.

Statement and quarter-letter use their real fixed page dimensions and compact spacing, fitting the complete content without trimming a field. Excessively long content fails explicitly if fitting would require less than 70% scale. It is never silently cropped.

## Deployment boundary

These templates are available in the deployed hub. Build 0.8.5 and bridge source 0.6.0 implement all six CUPS routes and ChromeOS paper submission; see PRINTER_ROUTES.md. The signed bridge package and update feed are published at 0.6.0. Chromebook update confirmation and physical copier verification remain outstanding. An installed 0.5.0 bridge continues only the verified Receipt Printer 1 route. Historical PowerShell/PostScript workers are outside the active Chromebook architecture and are not reintroduced.

The generic HTML adapter is an early scaffolding contract, not the approved PassKiosk ticket renderer. New copier routes must invoke the shared PDF builder rather than use the generic field-table layout or an old local PostScript template. The separately deployed letter-size email formatter is not one of these three print profiles.

## Verification

Automated checks cover six variants across all three profiles, stored signature raster inclusion, required content and order, fixed dimensions, receipt compatibility, and overflow rejection. Visually inspect all twelve fixed-paper examples before publishing. No physical copier-print claim is implied by PDF checks.
