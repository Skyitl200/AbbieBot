# 3D Spinal Cord

Open `/test` (or `/quiz`) → Anatomy and Physiology Lab → Nervous System → 3D Spinal Cord.

Contains the user's 12 requested terms: cervical enlargement, cervical plexus, lumbar enlargement, conus medullaris, cauda equina, filum terminale, femoral nerve, sciatic nerve, phrenic nerve, brachial plexus (C5–T1), sacral plexus (L4–S4), and lumbar plexus. Both multiple-choice and typed modes use the marked image. Typed mode accepts common synonyms, including lumbosacral enlargement.

Source: the original `eree.jpg` in the user's `eree.jpg.zip` and the supplied matching diagram screenshot. `spinal-cord-original.jpg` retains the uploaded JPEG bytes. The manifest records its SHA-256, source-coordinate annotations, and detail-view crops. Cyan brackets mark regions/plexuses, cyan lines mark thin longitudinal structures, and arrows/open rings mark individual targets. Enlarged details use nearest-neighbor scaling to preserve each original pixel; no anatomy is generated or repainted.

Render: `python scripts/renderSpinalCord.py`.

Validate: `node --test tests/spinal-cord.test.js tests/spinal-nerves.test.js tests/brain-left-sagittal.test.js tests/study.test.js`.

The set is separate from the existing spinal nerves and brain sets, which remain available.
