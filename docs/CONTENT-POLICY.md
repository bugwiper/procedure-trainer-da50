# Content Policy for AFM-Derived Material

This policy applies to every file in this repository and to the deployed site. It must be read by anyone who writes scenarios, panel artwork or documentation, before any procedure text is committed.

## 1. Status and purpose

This trainer is a training aid only. It is not a substitute for the approved Airplane Flight Manual (AFM), for an instructor, or for recurrent training. It is not an approved or certified training device. It is not affiliated with or endorsed by Diamond Aircraft Industries or Garmin.

DA50 and Diamond are trademarks of Diamond Aircraft Industries. Garmin and G1000 NXi are trademarks of Garmin Ltd. or its subsidiaries. All trademarks belong to their respective owners.

## 2. What may be committed

The following kinds of content may be committed to this repository:

- (a) Facts expressed as structured data: control names and positions, numeric limits, colour-band values, and the order of procedure steps.
- (b) Checklist text, reproduced exactly as printed, as the subsection below defines it. WARNING, CAUTION and NOTE prose, figures, charts, performance tables and page images are never copied, and the explanatory prose of the manual is never copied as continuous text.
- (c) All narrative and explanatory text, written in the author's own words (paraphrased, never copied).

### Verbatim checklist text

Checklist text is reproduced exactly as printed in the checklist booklet or the AFM checklist: the heading, the message tag, every item, every desired action, the comment lines between the rows, the branch labels and the markers that are printed in front of the lines. Wording, spelling, upper and lower case and the order of the lines are kept; nothing is shortened, reworded or paraphrased, because for training the exact wording matters. Numbers are kept where the checklist has them and left out where it has none.

This rule covers the checklist text only. The situation text, the briefing, the debrief wording, the messages of the app and every other narrative text stay in the author's own words, and the prose of the manual is not copied.

A line the author adds that is not printed (for example an own graded step for a panel action the checklist does not list) is marked as an own addition in the header comment of the scenario file, so it can never be mistaken for printed text.

The line cap of the scenario schema is a layout bound for the screen, not a legal limit and not a style rule.

Decided by the project owner on 2026-10-23. It replaces the limit of 12 words per line and the own-words rule that the project owner decided on 2026-10-20 (option-a), for checklist text only.

## 3. What must never be committed

The following must never be committed to the repository or published on the deployed site:

- AFM or POH files (PDF or any other format), and extracts of them beyond what section 2 allows.
- Scanned or photographed AFM pages, including photographs of printed checklists. The checklist wording is typed into the scenario files; the pictures it was checked against stay private.
- Any file from the private `.input/` reference folder.
- Garmin or Diamond logos.
- Artwork traced from, or derived from, photos or screenshots.

The `.input/` folder stays listed in `.gitignore`. A repository hygiene check confirms that no PDF and nothing under `.input/` is tracked by git.

## 4. Required source metadata for every scenario

Every scenario must carry:

- the AFM document number,
- the issue or revision,
- the section (and the page where useful), and
- a last-verified date.

A scenario with missing or empty source metadata is non-compliant. The scenario schema enforces this from the point where scenarios are introduced.

The revision this project is built against is recorded exactly as: AFM DA 50 C, Doc 9.01.01-E, Issue 018, 01-Apr-2025. This is a document identifier, that is, a fact.

## 5. Repository visibility

The repository is public. Anything committed is effectively permanent in public git history, so text whose status is uncertain must not be committed. The one exception is checklist text reproduced exactly as printed, which the project owner decided on 2026-10-23 may be committed (section 2); every other uncertain text stays out.

Before any paid content pack exists, paid content moves to a private source repository, and only built output is published.

## 6. Responsibility and legal status

Compliance with copyright and licensing remains the responsibility of the content author. This policy is not legal advice and has not had a legal review.

A legal review happens before any monetisation, and it covers the reproduced checklist text as well: it decides whether that text may stay in a published or paid pack. Hosting moves off GitHub Pages before any sale, because the GitHub Pages terms do not allow commercial use.

## 7. Panel artwork

All panel artwork is original vector work. The private reference photos are used only for layout, gauge set and order, colour bands and annunciation wording. They are never embedded and never traced.

Brand replacement rule: the panel never shows a real maker's mark. The avionics maker's name on the display bezels reads GO-AROUND, no airframe maker's wordmark is drawn at all, and the type name DA50RG stays. No real logo, swoosh, bird, wordmark shape or aircraft registration is drawn. A unit test and an end-to-end test check the rendered text.

## 8. Corrections and error reports

Report content errors as a GitHub issue on this repository. A fix updates the scenario and its last-verified date.
