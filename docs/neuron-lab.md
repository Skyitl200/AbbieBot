# 3D Neuron Model

Open `/test` (or `/quiz`) → Anatomy and Physiology Lab → Nervous System → 3D Neuron Model.

The set contains the user's 14 entries: soma, Nissl bodies, dendrite, synaptic knob, axon hillock, initial segment, two axon views, Schwann cell nucleus, neurolemma, endoneurium, node of Ranvier, Schwann cell, and myelin sheath. Both multiple-choice and typed-answer modes are available. Accepted typed aliases include cell body, perikaryon, synaptic bouton, neurolemmocyte, and neurilemma.

Every card shows the entire original 646×1024 photograph, with no cropping or enlargement, as requested. The soma is outlined, the exposed longitudinal axon is outlined, and the whole Schwann cell is bracketed; other targets have cyan arrows and open rings. No answer labels are added to the images. The two axon entries have separate images and question IDs, with the same accepted axon answers.

Source: `Neuron.jpg` from the uploaded `Neuron.jpg.zip`, the user-provided term list, and the matching reference screenshot. The source JPEG is retained byte-for-byte as `neuron-original.jpg`; its SHA-256 is recorded in the manifest. The renderer preserves every decoded source pixel outside the recorded marker bounds.

Render: `python scripts/renderNeuron.py`.

Validate: `node --test tests/neuron.test.js tests/brain-left-sagittal.test.js tests/spinal-nerves.test.js tests/study.test.js`.
