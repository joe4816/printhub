# PassKiosk receipt requirements

The staff interface is **the app**. The Chromebook print endpoint is **the hub**.
The sample button and production queue must use the same receipt renderer.

These restore the requirements recovered from the September 30–October 2, 2026
requests, the original print spec and receipt deck, and the October 4–6 proofs.

| Template | Required behavior |
| --- | --- |
| Every receipt | Full school name; measured wrapping inside 80 mm paper with 4 mm margins; readable separators and Latin accented names; transaction ID; no clipped title. |
| Hall pass | Student and ID/grade; From and To; explicit Excused checkbox independent of reason; omit blank reason; issued time; “Excused by” or “Signed by”; configured adult name and stored signature image; time returned; instruction to return to the originating teacher. |
| Call pass | Top delivery period, room and teacher, then “for” student; distinguish delivery destination from student destination; when/reason/requester; handwritten “Sent back to class by” and @ time lines. |
| Lunch detention | Student and ID/grade; date issued and detention date(s); Cafeteria default; infraction; issuer; lunch-only instructions, one source line per bullet. |
| After-school detention | Student and ID/grade; date issued and detention date(s); Room 602 default; infraction; issuer; after-school-only instructions, one source line per bullet. |
| Activity bus | Dedicated bus template; student and ID/grade; date; route/drop-off; approving adult name and stored signature. |

Adult names are first initial plus surname, except explicit Helper display-name
customizations. Existing initials must be preserved. Helper currently explicitly
uses “Sal” for ROMOS. Do not invent an expanded name from a username.

The October 1 request requires actual signature images, with custom signature
preferred over generated signature, otherwise none. A blank signature line is
not a replacement for a stored signature. Handwritten **return** lines are
separate and remain on the templates. Reuse the existing Apps Script signature
resolver; never copy personal signature images into the public repository.

## Regression and correction

The production PDF renderer diverged from the sample call-pass renderer. The
sample retained delivery and return fields while production receipts lost them.
The correction shares one layout, uses actual Helvetica text metrics, and embeds
signature images from the authenticated backend response.

## Deployment order

1. Install the companion PassKiosk PrintHubEndpoint.gs change in the live Apps
   Script project and update the existing anonymous worker deployment. Keep its
   current URL and credential.
2. Publish the hub renderer, production integration and service-worker update.
3. Confirm the Chromebook hub loads build `0.8.0-restored-templates` and uses
   renderer `printhub-web-0.8.0`.
4. Release the six synthetic HELD jobs in Print_Jobs rows 18–23, after checking
   their IDs/statuses. Confirm physical output before calling the templates done.

The six proofs cover unexcused hall, excused hall, call, lunch detention,
after-school detention and activity bus. They are explicitly test transactions,
not actual student assignments.
