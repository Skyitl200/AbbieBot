# 3D Spinal Nerves and Plexuses

Use `/test` → Anatomy and Physiology Lab → Nervous System →
3D Spinal Nerves and Plexuses. All 17 terms are available in multiple-choice
and typed modes, using the existing public question/owner-only answer flow.

The exact `Okok.jpg` from the uploaded ZIP is retained, plus its lossless decoded
PNG and SHA-256 values. Each marker was aligned to the user's individually labeled
Quizlet screenshots. Cards use cyan line/circle overlays. Ulnar, median and radial
cards use precise arrows and 4× nearest-neighbor elbow crops so these neighboring
nerves can be distinguished. They reuse original pixels; no anatomy was generated
or retouched. Femoral/sciatic wording identifies the marked origin regions.

The cervical plexus answer is the short name. Feedback distinguishes its usual
C1–C4 core from the supplied course list's C1–C5 label and the phrenic C3–C5 roots.
Common peroneal nerve is accepted for common fibular nerve. Region and nerve
names remain distinct in typed grading.

Rebuild with `python scripts/renderSpinalNerves.py` (Pillow required only for
the developer build). The manifest holds marker coordinates, crop/scale metadata,
and hashes. Run `node --test tests/spinal-nerves.test.js tests/study.test.js`.
Tests verify menus, both answer modes, aliases and unchanged source pixels outside
overlays, including the lossless crop/scale transformation of close-up cards.
