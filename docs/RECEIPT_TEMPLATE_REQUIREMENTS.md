# PassKiosk receipt requirements

The staff interface is **the app**. The Chromebook print endpoint is **the hub**.
The sample button and production queue must use the same receipt renderer.

These restore the requirements recovered from the September 30–October 2, 2026
requests, the original print spec and receipt deck, and the October 4–6 proofs.

| Template | Required behavior |
| --- | --- |
| Every receipt | Full school name; measured wrapping inside 80 mm paper: 68 mm content starting 4 mm from the left for corridor, request and detention; preserve the approved 72 mm activity-bus layout; readable separators and Latin accented names; transaction ID; no clipped title. |
| Corridor pass | Student and ID/grade; From and To; explicit Excused checkbox independent of reason; omit blank reason; issued time; “Excused by” or “Signed by”; configured adult name and stored signature image; time returned and separate returned-by Signed writing lines; instruction to return to the originating teacher. |
| Request for student | Title REQUEST FOR STUDENT; top delivery period, room and teacher left aligned, then student name right aligned on the next line; distinguish delivery destination from student destination; when/reason/requester; handwritten “Sent back to class by” and @ time lines. |
| Lunch detention | Student and ID/grade; date issued and detention date(s); Cafeteria default; parent/guardian notification and assignment statement; infraction; issuer with stored signature; Student Signature and Parent Signature writing lines; lunch-only instructions, one source line per bullet. |
| After-school detention | Student and ID/grade; date issued and detention date(s); Room 602 default; parent/guardian notification and assignment statement; infraction; issuer with stored signature; Student Signature and Parent Signature writing lines; after-school-only instructions, one source line per bullet. |
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

## Original paper and current overrides (October 7)

The October 1 10:27–10:37 AM Pacific exchange consolidates detention issuer
name and date in the top ISSUED line, immediately after student ID/grade and
before infraction or detention details. Do not restore a duplicate bottom
Assigned by / Notified On / Issued by name field. The stored authorization
signature remains below the infraction; student and parent signature lines remain.

Checked the original corridor, request, detention and activity-bus photographs
shared September 30–October 1. Restore operational fields from those forms,
including the second corridor signature and both detention acknowledgement lines.
Use CORRIDOR PASS and REQUEST FOR STUDENT as the printed titles.
The request return wording remains “Sent back to class by” plus @ time.
Keep the revised cafeteria / Room 602 instructions and 1:46 PM / 4:20 PM times;
the older paper instructions are superseded. Activity bus needs no changes.

Build `0.8.1-paper-form-fields` / renderer `printhub-web-0.8.1` incorporates
these corrections. Rows 18–23 were already printed on 0.8.0; any further physical
proof must be an explicit new test or reprint job after the Chromebook refreshes.
