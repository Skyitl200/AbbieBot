# A&P lecture multiple-choice preparation

The active study command is `/test`. Anatomy and Physiology Lecture practice
prepares every multiple-choice item with four or five distinct choices, displayed
with the corresponding A–D or A–E buttons. Both topic and mixed practice use the
same preparation path. Other classes and anatomy lab sets are unchanged.

Term questions use peer terms grouped by the same anatomical or physiological
concept. Defining-description questions use descriptions linked to the existing
lecture sources. Synonymous terms and identical definitions are excluded from
peer distractors. Low-similarity candidates are rejected rather than added just
to fill an option slot.

When a question cannot support a precise set of peer alternatives, it is combined
with a related check from the same lecture. Four answer combinations test both
parts. Each distractor fails one or both original checks, and feedback explains
both. These combined questions are marked at least medium difficulty. Source
slide references are combined, and review metadata identifies both original
questions. The preparation step does not invent additional biological claims.

The original 23 source-linked banks remain unchanged and retain all 13,800
questions. Preparation applies when questions are selected for a lecture quiz;
it preserves IDs, question counts, and non-multiple-choice formats. Runtime
choice order is shuffled, and button letters map to that displayed order.

Run `node --test tests/study-lecture-choices.test.js` for the exhaustive audit of
all 9,495 multiple-choice items, source provenance, correct answer combinations,
nonmutation, rendered message limits, and letter-to-answer mapping. The suite is
also included in `npm run test:study`.
