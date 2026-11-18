# Left sagittal brain model quiz

Open `/quiz` (or `/test`) → Anatomy and Physiology Lab → Nervous System → 3D Model of the Structures of the Brain - Left Sagittal View.

Includes all 26 user-specified terms, with multiple-choice and typed-answer identification questions. Each question refers to printed model labels or anatomical location in the same original photo. Common synonyms are accepted in typed mode. The question selector supports choosing a smaller subset.

Source: `Head.jpg` from the user's `Head.jpg.zip`, plus the user's term list and reference screenshot. The JPEG is stored byte-for-byte as `study-assets/lab-models/brain-left-sagittal-original.jpg`; the manifest records its SHA-256. No synthetic arrows or anatomy changes are applied. Small central structures also have anatomical relationship cues in the prompt rather than claiming a labeled key was provided.

`/quiz` is a guild-only alias of the existing `/test` flow and shares its persistent usage allowance. It does not add a global command slot. Existing study categories and data remain available.

Validation: `node --test tests/brain-left-sagittal.test.js tests/study.test.js tests/microbemon.test.js tests/question-preferences.test.js`.
