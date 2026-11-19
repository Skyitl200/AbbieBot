# 3D Neuron Model

Open `/test` (or `/quiz`) → Anatomy and Physiology Lab → Nervous System → 3D Neuron Model.

The set contains 12 structures: soma, Nissl bodies, dendrite, synaptic knob, axon hillock, initial segment, the axon, Schwann cell nucleus, neurolemma, endoneurium, node of Ranvier, and myelin sheath. Both multiple-choice and typed-answer modes are available. Accepted typed aliases include cell body, perikaryon, synaptic bouton, and neurilemma.

Every card shows the entire original 646×1024 photograph, with no cropping or enlargement, as requested. The soma is outlined, the axon card has a long blue line along the full visible left-hand segment, the myelin sheath card has a long blue line along its layered covering, and other targets have cyan arrows and open rings. The Schwann cell nucleus question remains; the whole Schwann cell question is removed. No answer labels are added to the images. There is one Axon question, using the long left-hand segment.

Source: `Neuron.jpg` from the uploaded `Neuron.jpg.zip`, the user-provided term list, and the matching reference screenshot. The source JPEG is retained byte-for-byte as `neuron-original.jpg`; its SHA-256 is recorded in the manifest. The renderer preserves every decoded source pixel outside the recorded marker bounds.

Render: `python scripts/renderNeuron.py`.

Validate: `node --test tests/neuron.test.js tests/brain-left-sagittal.test.js tests/spinal-nerves.test.js tests/study.test.js`.
