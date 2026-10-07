# PassKiosk paper templates

Builds 0.8.3 and later use one content builder in `shared/passkiosk-receipt-pdf.js` for all six examples and all three paper profiles. Correct fields, headings, issuer/date placement, parent notification, directions, signatures, acknowledgements, return lines, and delivery-header alignment must be changed in that builder, not copied into a paper-specific fork.

| Profile | PDF size | Layout |
| --- | --- | --- |
| `80MM_RECEIPT` | 80 mm wide, content-driven height | Approved receipt spacing; activity-bus receipt preserved |
| `STATEMENT` | 8.5 × 5.5 inches | Half-letter landscape |
| `A6` | 105 × 148 mm | Back Office, portrait, 6 mm side margins |
| `B6` (legacy queue identifier) | 105 × 148 mm | Compatibility alias for corrected Back Office A6 |

The copier panel was subsequently confirmed as A6. The prior B6/quarter-letter assumption caused a paper mismatch. Both the PDF and printer ticket now use A6; matching printer capability dimensions are mandatory.

## Entry points

- `buildPassKioskPdf(transaction, paperProfile)` renders the selected format with an already prepared signature raster.
- `buildPrintablePassKioskPdf(transaction, paperProfile)` privately decodes the backend-provided signature image, then invokes the same builder.
- Existing receipt entry points delegate to the same builder and preserve receipt PDF bytes for the same input.
- The hub's **PassKiosk Template Preview** card downloads synthetic samples in all three sizes. It does not record students, assign detention, queue jobs, or print.

Statement and A6 use their real fixed page dimensions and compact spacing, fitting the complete content without trimming a field. Excessively long content fails explicitly if fitting would require less than 70% scale. It is never silently cropped.

## Deployment boundary

Hub build 0.8.6 and signed bridge 0.6.1 correct Back Office to A6. The deployed Apps Script backend retains B6 as a legacy wire identifier; the hub renders it as A6 and the new bridge normalizes it to the A6 binding. This supports existing queued jobs without rewriting historical rows or redeploying the backend. Back Office jobs are excluded from polling on bridges before 0.6.1. Other routes continue operating. Physical A6 verification is still required.
