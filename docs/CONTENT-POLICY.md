# Content Policy for AFM-Derived Material

This policy applies to every file in this repository and to the deployed site. It must be read by anyone who writes scenarios, panel artwork or documentation, before any procedure text is committed.

## 1. Status and purpose

This trainer is a training aid only. It is not a substitute for the approved Airplane Flight Manual (AFM), for an instructor, or for recurrent training. It is not an approved or certified training device. It is not affiliated with or endorsed by Diamond Aircraft Industries or Garmin.

DA50 and Diamond are trademarks of Diamond Aircraft Industries. Garmin and G1000 NXi are trademarks of Garmin Ltd. or its subsidiaries. All trademarks belong to their respective owners.

## 2. What may be committed

The following kinds of content may be committed to this repository:

- (a) Facts expressed as structured data: control names and positions, numeric limits, colour-band values, and the order of procedure steps.
- (b) Short verbatim AFM checklist step lines, within the limit defined in the subsection below. Whatever that limit is, WARNING, CAUTION and NOTE text is never copied verbatim, figures, tables and page images are never copied, and a whole procedure is never copied as continuous prose.
- (c) All narrative and explanatory text, written in the author's own words (paraphrased, never copied).

### Verbatim checklist step lines: limit

A verbatim checklist step line is one line as printed in the AFM checklist, at most 12 words, counted as whitespace-separated tokens. Such a line is the item plus its action or target state.

A line counts as verbatim when its wording matches the AFM line apart from whitespace and letter case.

Compliant example (invented wording, one line, 4 words): `EXAMPLE SWITCH ...... OFF`

Non-compliant example (invented wording): a multi-sentence explanatory paragraph that describes why the example switch is moved, what happens afterwards and what the pilot should watch for. It is more than one line and more than 12 words, so it must be paraphrased in the author's own words and, if it is explanatory, must not be copied from the AFM at all.

Decided by the project owner on 2026-10-20 (option-a).

## 3. What must never be committed

The following must never be committed to the repository or published on the deployed site:

- AFM or POH files (PDF or any other format), and extracts of them beyond what section 2 allows.
- Scanned or photographed AFM pages.
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

The repository is public. Anything committed is effectively permanent in public git history, so text whose status is uncertain must not be committed.

Before any paid content pack exists, paid content moves to a private source repository, and only built output is published.

## 6. Responsibility and legal status

Compliance with copyright and licensing remains the responsibility of the content author. This policy is not legal advice and has not had a legal review.

A legal review happens before any monetisation. Hosting moves off GitHub Pages before any sale, because the GitHub Pages terms do not allow commercial use.

## 7. Panel artwork

All panel artwork is original vector work. The private reference photos are used only for layout, gauge set and order, colour bands and annunciation wording. They are never embedded and never traced.

Brand replacement rule: the panel never shows a real maker's mark. The avionics maker's name on the display bezels reads GO-AROUND, no airframe maker's wordmark is drawn at all, and the type name DA50RG stays. No real logo, swoosh, bird, wordmark shape or aircraft registration is drawn. A unit test and an end-to-end test check the rendered text.

## 8. Corrections and error reports

Report content errors as a GitHub issue on this repository. A fix updates the scenario and its last-verified date.
