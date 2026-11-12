# Lecture image refresh

The lecture image index now considers a figure's labels, title, alt text, and caption.
The refresh does not award points simply for being on the question's cited slide.
It prioritizes the correct answer and question context, with diversity used only
to break near-equal relevance scores. Incorrect answer options are not search terms.
Explicitly authored figure references remain fixed.

`python scripts/refreshLectureFigures.py` produces a dry-run audit in
`.local/lecture-image-review.json`. Add `--apply` to download selected figures and
write the index. Existing assets are retained. Ambiguous matches keep their previous
reference and appear as `needs-review`; this is a lexical evidence threshold, not
a finding that their current figure is wrong. Automated matching cannot establish
that every anatomical relationship in every image fits every question.

The initial refresh found content matches for 9,136 questions, preserved 207 authored
references, and left 4,457 references pending stronger matching evidence. The final
index reassigns 4,903 questions and uses 833 distinct figures (up from 442). It
downloaded 399 selected textbook figures during the final import; the index also
retains earlier source assets. All 159 study regression tests pass. This is a substantial partial refresh, not a manual review of all 13,800
questions or a promise of a different base photograph for every question.

Question and result views display one primary reference image, including paired
lecture checks, and clear previous attachments. Visible image-credit fields are
omitted; source attribution and licensing remain in the image index and this
repository.

## Attribution

New figures come from OpenStax's *Anatomy and Physiology* repository, release `1rc`,
pinned to commit `9af501aa6e13a75d85003fed4ed1051e9d07b7dc`.
That release's Creative Commons Attribution 4.0 license is included in
`scripts/data/openstax-anatomy-LICENSE.txt`. The catalog retains original captions
and alt text. Selected image records retain the immutable original URL, title,
caption, attribution, license URL, original bytes, dimensions, and SHA-256.
Third-party credited images and micrographs are excluded from this importer.
The current upstream license must not be assumed to apply to this pinned release,
or vice versa. New media are not generated, recolored, cropped, or relabeled.

Validate with `npm run validate:study:images` and `npm run test:study`.
