# 3D Model of the Nerves

Location: `/test` → Anatomy and Physiology Lab → Nervous System → 3D Model of the Nerves.

Nine ready cards identify thoracic nerves, sciatic nerve, tibial nerve, common fibular nerve (common peroneal alias), femoral nerve, radial nerve, median nerve, ulnar nerve and axillary nerve. Both multiple-choice and typed answer modes are supported.

The coccygeal nerve is pending a labelled reference: the tiny lower sacral/coccygeal structure is not sufficiently distinguishable from adjacent roots/filum in the supplied photos to mark confidently. It is listed as pending in the set description and excluded from quiz generation.

Three native-size user-uploaded WebP photographs from Archive 2.zip are preserved, with lossless PNG quiz copies containing only cyan/black pointer overlays. No cropping, resizing, generative anatomy changes or answer labels are added to quiz images. `nerves-preview.jpg` is the labelled review sheet; it is not used in quizzes. Run `python scripts/renderNerves.py` to reproduce the cards and hashes.

Validation: `node --test tests/study-nerves.test.js` checks the set membership, both question modes, unique options, assets/hashes and native-image preservation outside each marker.
