# Left sagittal brain model quiz

Open `/quiz` (or `/test`) → Anatomy and Physiology Lab → Nervous System → 3D Model of the Structures of the Brain - Left Sagittal View.

Includes all 26 user-specified terms, with multiple-choice and typed-answer identification questions. Each question shows a separate marked version of the original photo with high-contrast cyan markers. Cerebellum uses an outline around its full section; arbor vitae uses three pointers on separate white-matter branches. Other structures use a single arrow and open ring. The prompt asks the member to identify the marked structure. Common synonyms are accepted in typed mode. The question selector supports choosing a smaller subset.

Source: `Head.jpg` from the user's `Head.jpg.zip`, plus the user's term list and reference screenshot. The JPEG is stored byte-for-byte as `study-assets/lab-models/brain-left-sagittal-original.jpg`; the manifest records its SHA-256. The renderer `scripts/renderBrainMarkers.py` applies one pointer overlay to each card; every pixel outside that overlay remains identical to the decoded original photograph. Small central structures have separate, precise marker locations.

`/quiz` is a guild-only alias of the existing `/test` flow and shares its persistent usage allowance. It does not add a global command slot. Existing study categories and data remain available.

Validation: `node --test tests/brain-left-sagittal.test.js tests/study.test.js tests/microbemon.test.js tests/question-preferences.test.js`.
