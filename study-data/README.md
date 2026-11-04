# Anatomy study questions: work in progress

The requested final bank is **23 topics × 600 questions = 13,800**. The current
bank contains **9,600 questions**:

| Topic | Multiple choice | Fill in the blank | Select all | Ordering | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Anatomical Directions | 322 | 135 | 93 | 50 | 600 |
| Basic Chemistry | 241 | 100 | 205 | 54 | 600 |
| Living Cells | 233 | 100 | 205 | 62 | 600 |
| Tissues | 217 | 130 | 185 | 68 | 600 |
| Integumentary System | 223 | 130 | 185 | 62 | 600 |
| Skeletal System | 215 | 130 | 185 | 70 | 600 |
| Joints | 170 | 140 | 245 | 45 | 600 |
| Muscular System | 165 | 130 | 235 | 70 | 600 |
| Nervous System & Nervous Tissue | 184 | 130 | 235 | 51 | 600 |
| Central Nervous System | 184 | 130 | 235 | 51 | 600 |
| Special Senses | 184 | 130 | 235 | 51 | 600 |
| Endocrine System | 184 | 130 | 235 | 51 | 600 |
| Blood Cells | 184 | 130 | 235 | 51 | 600 |
| Autonomic Nervous System | 251 | 84 | 208 | 57 | 600 |
| Urinary System | 323 | 92 | 130 | 55 | 600 |
| Immune System | 298 | 102 | 154 | 46 | 600 |

The other 7 new topic banks are not yet populated. **4,200 questions remain**
to reach the requested total. Anatomical Directions, Basic Chemistry, Living Cells,
Tissues, Integumentary System, Skeletal System, Joints, Muscular System, Nervous System & Nervous Tissue, Central Nervous System, Special Senses, Endocrine System, Blood Cells, Autonomic Nervous System, Immune System, and Urinary
System have reached their 600-question targets; the other 7 topics remain
incomplete. These are authored
study drafts, not a claim of independent medical review. The
existing `quiz-data` files and database rows have been retained until replacements
are ready; this directory is the new mixed-format bank for `/test`.

Run `npm run validate:study` for actual counts. `npm run validate:study:complete`
must fail until every topic has exactly 600 questions and all four formats.
Structural validation cannot establish medical accuracy; review the questions,
answer keys, plausible distractors, explanations, and slide references before
publishing complete banks. Do not inflate counts with shuffled copies, superficial
rewordings, unsupported slide extraction, or generic question templates.

To check selected completed banks while retaining global validation
of all existing questions, run:

```sh
npm run validate:study:complete -- --topics=immune,urinary
npm run validate:study:complete -- --topics=basic_chemistry
```

`study-data/source-manifest.json` records the actual slide counts and SHA-256
hashes of the 23 accessible source uploads. Bank loading rejects references past
the end of the corresponding presentation. A valid reference establishes its
existence, not that every clinical extension is stated verbatim on that slide.

The immune and urinary banks include clinical terminology profiles, causal and
anatomical pathway exercises, functional comparisons, and case applications.
Urinary calculations state their formulas and units explicitly; clearance is not
treated as automatically identical to GFR. Clinical extensions are identified in
source metadata. Related retrieval and reasoning variations are practice items,
not claims of 600 separate underlying facts in each presentation.

## Student flow

`/test` opens 23 anatomy topic choices plus mixed topics. Students select a test
length, answer privately, receive explanations, and see a final score. Ordering
uses successive single choices with Undo and Submit, since Discord multi-select
values do not encode the student's selection order. Fill-in answers accept only
explicit variants, ignoring case and repeated whitespace. Select-all scoring
requires the exact answer set; ordering requires the exact sequence. Study
sessions expire after two hours of inactivity and are not retained across bot
restarts. The new mixed-format flow does not issue economy rewards.

The existing bot already had 100 commands, Discord's maximum. `/test` replaces
the old `/quiz` command. `/test other-subjects:True` preserves access to its
original nursing, microbiology, TEAS, and legacy A&P menus. Those legacy questions
retain their old format and database storage. Bot startup registers commands;
live registration and Discord testing require the bot credentials.

## Source inventory and authoring requirements

Topic IDs and presentation filenames are defined in
`src/services/study/topics.js`. The 23 supplied files are PowerPoint presentations,
not PDFs. Text from all 23 accessible presentations is extracted under the ignored
`.local/study-sources/` directory, with slide numbers and SHA-256 hashes.
`python scripts/extractStudySlides.py /workspace/attachments` reproduces the
extraction without additional Python packages. Text extraction does not inspect
image-only diagrams or guarantee correct reading order in complex diagrams.

The original immune and urinary uploads exceeded the transfer tool's 32 MiB
per-file limit. Their compressed replacements are now accessible:

- `Immune_System_Compressed.pptx` (23,794,061 bytes)
- `Urinary_System_Compressed.pptx` (9,454,125 bytes)

The extraction script maps these upload names to the original topic filenames
for stable question provenance and records both names in the extraction manifest.
No source-file uploads remain blocked. The full 600-question banks remain
unfinished; accessible sources do not imply completed question authoring.

Author questions directly, without wording such as “based on the slides.” The
user permits related medical terminology and real-world applications to expand
coverage. Keep clinical correlations tied to the topic, distinguish extensions
from direct slide material in metadata, and do not introduce unsupported patient
management claims. Use the exact phrase **interlobular (also known as cortical
radiate artery)** for questions involving that artery.

Each topic is an array in `<topic_id>.json`. Questions have globally unique IDs,
a type, difficulty (`easy`, `medium`, `hard`), question, explanation, and source:

```json
{
  "id": "ans-0001",
  "type": "multiple_choice",
  "difficulty": "easy",
  "question": "Which division promotes rest and digestion?",
  "options": ["Sympathetic", "Parasympathetic", "Somatic"],
  "correct": [1],
  "explanation": "Parasympathetic activity promotes maintenance functions.",
  "source": {
    "file": "Automatic Nervous System Chapter 14.pptx",
    "slides": [18, 21],
    "kind": "slide"
  }
}
```

Multiple choice uses one zero-based `correct` option index. `select_all` uses
multiple indices and at least one distractor. `ordering` uses a permutation of
all option indices and must specify an unambiguous direction or starting point.
`fill_blank` uses `____` in the prompt and an `answers` array of accepted strings
instead of options/indices. For clinical extensions, use
`source.kind: "clinical_application"` and a `source.rationale` explaining the
connection to the cited slide content. Preserve source references in data rather
than making question prompts refer to slides.

## Attribution

The accessible Autonomic Nervous System presentation attributes teaching material
to Dr. Ahmed Katsha, Raritan Valley Community College, and OpenStax, Rice University.
It identifies OpenStax material as CC BY 4.0. The preview question wording,
distractors, ordering activities, and explanations are adaptations of the cited
slides. OpenStax: https://openstax.org/ ; license:
https://creativecommons.org/licenses/by/4.0/ . Preserve these credits when sharing
adapted material, and inspect each additional presentation's credits during
authoring.

## Source discrepancies noted while authoring

Questions retain the uploaded slide references, but the following problematic
claims were not copied into answer keys:

- Urinary slide 27 says sugar does not pass the filter, while slides 28 and 41
  discuss glucose reabsorption. The blanket exclusion is inconsistent with normal
  glucose filtration; it is not used as a correct answer.
- Urinary slide 29 describes ascending-limb urea secretion, and slide 41 groups
  several wastes together as secreted substances. Segment-specific urea handling
  is more complex; these statements are not used as general rules.
- Urinary slide 37 locates blood colloid osmotic pressure in the capsule. Blood
  oncotic pressure is a plasma-protein effect. Pressure questions instead use the
  correctly directed simplified filtration model on slide 38.
- Urinary slide 46 makes a blanket claim that aldosterone causes dilute urine.
  The bank tests sodium reabsorption separately from ADH-regulated water
  permeability rather than treating aldosterone as a universal dilution signal.
- Immune slides 15, 20, 26, and 38 contain problematic simplifications about
  neutrophil histamine, complement action, T-cell recognition, and antibody-class
  differences. Questions avoid these erroneous generalizations. In particular,
  cytotoxic T cells can recognize relevant peptide-MHC I on infected target cells;
  antigen recognition is not restricted to professional APCs.
- Immune slides 43, 44, 47, and 48 make overly absolute statements about IgD
  secretion, plasma-cell lifespan, absence of secondary-response delay, and the
  rarity of B-cell T-helper dependence. The bank uses qualified statements rather
  than those absolutes.

The new urinary and immune questions are adaptations of the corresponding
presentations credited to Dr. Ahmed Katsha, Raritan Valley Community College,
and OpenStax, Rice University. New wording, distractors, clinical applications,
and sequencing exercises are adaptations. The attribution and license links
above apply to the OpenStax-derived material in these banks as well.

The Anatomical Directions questions likewise adapt Chapter 1 material credited
to Dr. Ahmed Katsha and OpenStax. They include direct concept retrieval, regional
terminology, spatial comparisons, clinical localization, plane interpretation,
serosal layering, feedback scenarios, and ordering exercises. Related organ-system
applications and local layer comparisons are marked as clinical applications in
their source metadata. These practice variations do not represent 600 different
underlying anatomical facts.

The completed autonomic bank adds receptor-subtype and clinical applications,
typical somatic versus autonomic pathways, ganglionic and effector transmission,
organ responses, CNS integration, and simplified reflex sequences. It explicitly
distinguishes sympathetic cholinergic eccrine pathways from the usual adrenergic
postganglionic pattern. It does not treat all glands as inhibited by sympathetic
activity, all blood vessels as dually innervated, or every organ response as a
50:50 balance. Receptor profiles and clinical extensions are marked in metadata;
the original 25-slide presentation remains their curricular anchor. The same
OpenStax and instructor attribution above applies to its adapted material.

The Basic Chemistry bank adapts the 82-slide Chapter 2 presentation with the same
instructor and OpenStax attribution. It includes atomic structure, ions, bonds,
reaction types, water and mixtures, concentration units, acids/bases/buffers,
carbohydrates, lipids, proteins, nucleic acids, and ATP. Its practice items include
concept retrieval, comparisons, clinical applications, ordering, 78 numerical
exercises, and 12 directional DNA-complement exercises. The automated tests
independently recompute the numerical and base-pairing answer keys from the
question inputs, without using their explanations or authoring helpers.

Chemistry source qualifications applied during authoring:

- Slide 13: proton number identifies the element; neutron variation defines
  isotopes rather than a uniquely identifying element number.
- Slide 17: molecules can contain different elements. Water is both a molecule
  and a compound, while O2 is a molecule of one element.
- Slides 25–26: CO2 has polar bonds but can be nonpolar overall by symmetry;
  water's partial charges are not complete ionic charges.
- Slide 40: percentage questions specify their mass/volume basis and final
  solution volume. Molarity is moles per liter of solution.
- Slides 50–54: acid strength differs from concentration, buffers have finite
  capacity, and mixing acid and base does not automatically guarantee pH 7.
  The neutral-pH-7 reference is qualified to the usual aqueous 25°C context.
- Slides 61–64: phospholipids are amphipathic, and unsaturated fatty acids may
  contain one or multiple C=C bonds.
- Slides 69–80: protein-structure hierarchy is not asserted to be an obligatory
  time sequence for every protein. DNA and RNA are nucleic-acid polymers, and
  human DNA occurs in mitochondria as well as the nucleus.
- Slides 81–82: ATP hydrolysis can provide a favorable overall free-energy
  change. Breaking an isolated bond alone requires energy rather than being
  intrinsically energy-releasing.

As in the other banks, related practice variations are not a claim of 600
different underlying scientific facts. Application extensions are marked in
metadata, and simplified experimental or cellular models are identified in the
question wording.

The Living Cells bank adapts the 81-slide Chapter 3 presentation, with the same
instructor and OpenStax attribution. It covers membranes, signaling and transport,
organelles, surface extensions, nuclear organization, replication, gene expression,
and division. Its 90 model exercises include 54 numerical answers, 20 directional
transport predictions, and 16 antiparallel replication/transcription sequences.
Automated tests independently check those answer keys from the stated inputs.
Ideal osmotic-volume and cubic-cell exercises state their simplifying assumptions;
they are not clinical infusion-selection instructions.

Living Cells source qualifications applied during authoring:

- Slide 8: membrane composition varies. The claim that phospholipids make up
  70–75% of total cell mass is not used as an answer.
- Slides 14–22: channels can be highly selective. Passive movement follows the
  appropriate chemical/electrical driving force; secondary active transport uses
  stored gradient energy without necessarily hydrolyzing ATP in the cotransporter.
- Slides 24–31: osmolarity is particles per solution volume, while tonicity
  depends on effective solutes and the membrane's permeability. Osmotic exercises
  explicitly specify nonpenetrating solutes, water permeability, and pressure or
  volume assumptions rather than treating every iso-osmolar solution as isotonic.
- Slides 40–42: membrane voltage reflects a small surface-associated charge
  separation. Bulk cytosol is not treated as containing only negative charges,
  and resting voltage is not attributed solely to one potassium-flux equality.
- Slides 51–56: peroxisomes are distinct from lysosomes. Ribosomal subunits
  contain RNA and proteins. Centrosomal pericentriolar material participates in
  microtubule organization; centrioles and centromeres are different structures.
- Slides 60–72: mature erythrocytes lack nuclei and skeletal muscle fibers can
  be multinucleated. Some genes encode functional RNA. Nuclear-gene expression
  is explicitly distinguished from an assertion that all transcription everywhere
  must occur in a nucleus.
- Slides 75–80: cytokinesis can overlap late mitosis. The introductory four-stage
  mitotic scheme can group prometaphase events with prophase. Spindle attachment
  involves kinetochores at centromeric regions. Chromosome-count problems specify
  the stage, counting convention, and whether the whole cell or one daughter is
  being counted.

The Tissues and Integumentary banks adapt the 65-slide Chapter 4 and 54-slide
Chapter 5 presentations with the same instructor and OpenStax attribution. Each
contains 80 concept sets, 50 histology or application cases, comparative matching,
and specified depth or process routes. Those are varied practice items, not 600
different underlying facts per topic. Histology cases identify a stated sample;
skin-color findings and pain are not treated as stand-alone diagnoses. Tests
independently verify 62 tissue/skin depth, layer, and burn-ranking answer keys.

Tissues source qualifications applied during authoring:

- Slides 10–15: basal lamina is a component of the support interface rather
  than a separate cellular tissue. Tight junctions limit paracellular passage
  with tissue-dependent permeability; they are not universally impermeable to
  every substance. Gap junctions and anchoring junctions have distinct roles.
- Slides 19–26: renal epithelial types vary by segment. Pseudostratified
  epithelium is one basal-contacting layer. Distended urothelium remains a
  specialized multilayered epithelium rather than becoming simple squamous.
- Slides 27–29: endocrine and exocrine routes are distinguished; unicellular
  exocrine glands do not require a multicellular duct. Classical secretory
  mechanisms are identified as models, not inferred solely from a gland's name.
- Slides 37–52: mesenchymal progenitors are not described as universally
  pluripotent. Cartilage matrix includes cells, collagen, proteoglycans, and
  water; not all cartilage has a perichondrium. Fibrocartilage examples specify
  an appropriate disc or meniscal region rather than every disc component.
- Slides 59–65: cardiac cells usually have one and can have two nuclei. True
  epithelial membranes are distinguished from the non-epithelial synovial
  membrane. Added cell-lineage and matrix terminology is marked as an extension.

Integumentary source qualifications applied during authoring:

- Slides 6–20: skin proper comprises epidermis and dermis; hypodermis is
  subcutaneous. Papillary dermis is predominantly loose connective tissue while
  reticular dermis is predominantly dense irregular connective tissue. Thick
  versus thin skin concerns epidermal organization, not body-fat thickness.
- Slides 10–24: pigmentation depends on melanin production, type, distribution,
  and organelle handling; exact melanocyte counts are not assumed identical in
  all people and sites. Freckles are not defined as necessarily increased numbers
  of melanocytes. Hemoglobin-related color changes are not an obligatory
  white-to-blue sequence, and absence of visible cyanosis is not proof of normal
  oxygenation. Cancer terminology does not label every pigmented lesion malignant.
- Slides 31–43: arrector pili contraction is not taught as universal closure of
  sweat pores. Eccrine cooling depends on evaporation and environmental conditions;
  gland amount or dripping alone does not specify actual heat loss. Sebaceous
  glands are not present on palmar and plantar glabrous skin.
- Slides 45–46: cutaneous vitamin D production is followed by liver and kidney
  processing. Vitamin D deficiency is one possible cause of rickets or
  osteomalacia, not a unique diagnosis from a skin observation.
- Slides 47–52: burn categories are explicitly depth-based. Pain alone does not
  establish depth or overall severity. Full-thickness wounds have limited local
  epithelial sources, but are not described as incapable of any edge healing;
  grafting does not imply that every burn requires amputation or that all skin
  appendages are restored. Pressure-related perfusion loss and nail-growth
  terminology are clearly marked clinical or accessory-structure extensions.


The Skeletal System bank adapts the 54-slide `Skeletal System Chpter 6.pptx`
under the source attribution above. Its 600 practice questions include alternate
formats and applications of shared concepts; they do not represent 600 distinct
facts. Clinical extensions include fracture repair, mineralization disorders,
growth-plate injury, and hormone effects. Each question records its supporting
slides and distinguishes clinical extensions from direct slide material.

Skeletal source qualifications applied during authoring:

- The conventional adult count is 206 bones, with individual variation. Bone
  shape classifications do not depend on absolute size, and marrow distribution
  varies with age and location.
- Osteoclasts have hematopoietic origins; osteoblasts and osteocytes belong to a
  different lineage. Collagen supplies tensile properties, while hydroxyapatite
  supplies mineral reinforcement.
- Endochondral ossification replaces a cartilage template with newly deposited
  bone; articular cartilage persists. Intramembranous and endochondral pathways
  are not treated as exclusive lists of whole bones.
- Vitamin D supports intestinal calcium absorption. Osteoporosis is distinguished
  from defective mineralization and does not require low serum calcium. Primary
  parathyroid excess can cause hypercalcemia; a tumor is not generically taught
  to cause hypocalcemia. PTH promotes resorption through indirect cellular signals.
- Sex steroids affect skeletal maturation in both sexes. Calcitonin is not
  presented as the sole controller of adult calcium balance. Questions do not
  prescribe treatments or doses.
- Fracture-repair phases overlap. Ordering questions specify simplified onset
  models; growth-zone and lineage questions likewise state their reference model.
  Automated tests independently check 36 spatial, lineage, growth-zone, and
  repair answer keys against those models.


The Joints bank adapts the 65-slide `Joints Chapter 9.pptx`, attributed to
Dr. Ahmed Katsha, Raritan Valley Community College, and OpenStax/Rice University
under the source attribution above. Its 600 questions include different formats
and practice variations of shared concepts, not 600 separate anatomical facts.
Clinical extensions are labeled and tied to supporting slide objectives. Thirty
angle calculations, thirty angular orderings, and fifteen cartilage-depth
orderings have independently checked answer keys in the automated suite.

Joints source qualifications applied during authoring:

- Slides 7–13: structural and functional classifications are distinct. Fibrous
  joints are not universally immovable; syndesmoses can allow slight movement.
  Sutures and tooth attachments are distinguished from synovial articulations.
- Slides 16–21: most articular surfaces have hyaline cartilage, but exceptions
  exist. Synovial lining does not cover intact load-bearing articular cartilage.
  Synovial fluid includes a plasma-derived component and cellular contributions.
  Discs and menisci are intra-articular accessory structures where present;
  bursae and tendon sheaths are associated structures, not mandatory components
  of every joint. Intracapsular does not necessarily mean intrasynovial.
- Slides 27–40: origin and insertion describe conventional attachments; fixed-limb
  tasks can change which attachment moves. Hyperextension names a direction beyond
  anatomical position and does not alone establish injury. Inversion and eversion
  mainly involve joints beyond the talocrural articulation. Movement planes and
  reference positions are specified rather than treated as universal absolutes.
- Slides 42–56: shoulder stability includes active muscular support as well as
  capsule and ligaments. The knee is a modified hinge with some rotation, not a
  perfect single-axis hinge. ACL and PCL translation questions specify a fixed
  femoral reference; medial and lateral collateral restraints distinguish valgus
  from varus. An injury mechanism alone does not prove a fixed sequence of tears.
- Slides 58–64: bursitis does not imply infection. Tendinitis denotes inflammation,
  while tendon pain can have other mechanisms. Osteoarthritis involves the whole
  joint and is not an inevitable consequence of age alone. Rheumatoid arthritis
  is autoimmune; no medication doses or individualized treatments are prescribed.
- Quantitative movement exercises state their angle convention and do not infer
  diagnoses or safe movement limits. Cartilage-depth exercises describe a mature
  spatial model, including the tidemark, rather than a temporal growth sequence.


The Muscular System bank adapts the 70-slide `Muscular System Chapter 10.pptx`,
attributed to Dr. Ahmed Katsha, Raritan Valley Community College, and
OpenStax/Rice University under the source attribution above. Its 600 questions
include alternate formats, comparisons, and applications of shared concepts;
they do not claim 600 distinct scientific facts. Added clinical material is
labeled as an extension and tied to cited mechanisms or learning objectives.
Automated reference checks cover all 105 causal and structural sequence exercises.

Muscular System source qualifications applied during authoring:

- Slides 8–11: contractility means active tension, which does not require overall
  shortening. Skeletal muscle participates in reflex as well as voluntary actions.
  Smooth muscle still contains contractile proteins despite lacking striations.
  Intercalated discs provide both mechanical and electrical specializations.
- Slides 16–25: T-tubules are surface-membrane invaginations, while SR cisternae
  belong to an intracellular calcium-handling membrane network. The A band spans
  the full thick-filament length, including a possible thick-only H zone; it is
  not defined solely as filament overlap. Ordinary sliding changes overlap and
  sarcomere length without shortening the individual filaments.
- Slides 27–44: the end-plate potential is a local graded response that can trigger
  a separate muscle action potential. End-plate nicotinic channels are
  ligand-gated cation channels. Skeletal T-tubule voltage sensors couple to SR
  calcium-release channels; they are not identical to those SR channels.
  Voltage-gated sodium-channel inactivation and potassium currents contribute to
  rapid repolarization; the sodium-potassium pump maintains ion gradients rather
  than directly causing each spike downstroke.
- Slides 44–52: calcium binding to troponin regulates tropomyosin position. ATP
  binding permits myosin detachment, while hydrolysis re-energizes the head.
  Calcium reuptake requires ATP-dependent SR pumps. Cross-bridge ordering specifies
  a cycle start; relaxation milestones describe a simplified causal model with
  processes that can overlap rather than mutually exclusive time intervals.
- Slides 53–62: twitch tension does not prove whole-muscle shortening. ATP pathways
  overlap, and phosphagen duration is not a fixed universal cutoff. Lactate
  formation regenerates NAD+ and is not the sole cause of fatigue or delayed
  soreness. Aerobic ATP contribution depends on activity and physiological state.
- Slides 64–65: origin and insertion are conventional attachments, whose relative
  movement can change with the task. Agonist and antagonist roles are task-specific;
  coactivation can stabilize a joint. Added training, repair, fiber-type, and
  contraction-mode terminology supports the explicit learning objectives on slide 3.
- Clinical extensions explain myasthenia gravis, impaired transmitter release,
  abnormal calcium release, and rigor mechanisms without diagnosing symptoms alone
  or prescribing medications, doses, or individualized management.


The Nervous System & Nervous Tissue bank adapts the 61-slide
`Nervous System and Nervous Tissue Chapter 12.pptx`, attributed to Dr. Ahmed
Katsha, Raritan Valley Community College, and OpenStax/Rice University under the
source attribution above. Its 600 questions use alternate formats, comparisons,
and applications of shared concepts; they do not claim 600 distinct scientific
facts. Extensions record the supporting mechanism or objective. Automated
reference checks cover 75 sequence exercises and 30 voltage, threshold-margin,
and firing-rate calculations.

Nervous System & Nervous Tissue source qualifications applied during authoring:

- Slides 7–20: anatomical divisions and functional classifications describe
  different features. Motor output includes more than skeletal muscle. Somatic
  responses can include reflexes. Adult branching-stem sensory neurons are
  described as pseudounipolar rather than treating all unipolar forms as a
  universal sensory class. Conventional multipolar information flow is a model,
  not a prohibition on all other neuronal signaling arrangements.
- Slides 22–29: astrocytes support vascular and local neuronal environments but
  do not alone form endothelial barrier tight junctions. One oligodendrocyte can
  myelinate segments on several CNS axons; a myelinating Schwann cell forms one
  peripheral internode. Nonmyelinating Schwann cells also exist. Ordinary
  ependymal lining is distinguished from specialized choroid-plexus epithelium
  involved in CSF production. Nodes occur in both CNS and PNS myelinated axons.
- Slides 30–31: gray and white matter are described by enriched components rather
  than exclusive ingredients. An anatomical neuronal nucleus differs from a cell's
  nucleus; a ganglion is a peripheral cell-body cluster, not an axon bundle.
- Slides 33–51: resting and threshold voltages are cell- and state-dependent.
  Leak permeability and maintained ion gradients establish baseline conditions.
  Channel gating and electrochemical gradients are distinct concepts. A graded
  response may decay; a regenerative spike is not simply a scaled graded response.
  All-or-none does not make every axon equally fast or every neuronal waveform
  identical. Sodium-channel inactivation and potassium conductance contribute to
  repolarization; pumps maintain gradients rather than generating each downstroke.
- Slides 52–60: saltatory conduction includes internodal current flow rather than
  physical teleportation of ions. Refractory intervals constrain re-excitation.
  Inhibition can be shunting without a large hyperpolarization. Transmitter
  effects depend on receptor signaling, ion gradients, and target-cell state;
  neither transmitter identity nor receptor name alone specifies every response.
- Added clinical correlations distinguish CNS demyelination from peripheral
  myelin disease without diagnosing a person from symptoms alone. Calculation
  questions state their voltages, thresholds, observation windows, and sign
  conventions; they do not imply universal physiological constants.


The Central Nervous System bank adapts the 72-slide
`Central Nervous System Chapter 13.pptx`, attributed to Dr. Ahmed Katsha, Raritan
Valley Community College, and OpenStax/Rice University under the source
attribution above. Its 600 questions include alternate formats, comparisons,
and applications of shared concepts; they do not represent 600 separate facts.
Developmental extensions follow the explicit embryology objective on slide 3.
The bank retains the presentation's coverage of peripheral nerves and reflexes
within this topic. Automated reference checks cover 75 sequence keys plus
selected corrected anatomy and developmental answers.

Central Nervous System source qualifications applied during authoring:

- Slides 7–21: the cerebrum contains cortex, white matter, and deep nuclei.
  Cortical functions involve networks rather than exclusive isolated centers.
  The thalamus participates in many sensory and motor circuits; not every
  descending motor axon or initial olfactory input must relay there. Cerebellar
  coordination differs from initiating every voluntary command.
- Slides 23–29: the conus and cauda equina are distinct. Adult cord termination
  is usually near L1-L2 vertebral levels with variation; cord-segment names do
  not equal vertebral positions. Dorsal roots carry afferent input and ventral
  roots carry efferent output. Sensory somata in dorsal root ganglia are
  peripheral, not the somata of dorsal-horn processing neurons.
- Slides 32–38: cranial and spinal dural arrangements differ. Spinal dura is
  separated from the vertebral wall by an epidural compartment. Lumbar puncture
  samples subarachnoid CSF, not epidural fat. The subdural plane is normally a
  potential cleavage interface rather than a large normal CSF reservoir.
  Meningitis names inflammation and does not alone establish one infectious cause.
- Slides 39–45: choroid-plexus secretion is not simply an uncontrolled whole-blood
  leak. The selected classical flow model follows lateral ventricle, foramen,
  third ventricle, aqueduct, fourth ventricle, aperture, subarachnoid space, and
  granulation. CSF is also produced elsewhere and has additional clearance
  routes. Production, volume, and turnover are not universal immutable constants.
  BBB permeability depends on transport and molecular properties; not every
  lipid-soluble substance crosses freely. Specialized circumventricular regions
  do not imply that the entire hypothalamus lacks a barrier.
- Slides 50–64: cranial nerves are distinguished by specific targets. CN XII
  supplies most tongue muscles rather than every lower-throat muscle. The usual
  cervical plexus is chiefly C1-C4, brachial plexus C5-T1, lumbar plexus mainly
  L1-L4, and sacral plexus chiefly L4-S4, with variants and contributions qualified.
  Axillary and radial nerves are separate posterior-cord branches; axillary does
  not normally branch from radial. The saphenous nerve is a femoral sensory branch.
  The standard spinal count is 31 pairs, including eight cervical pairs.
- Slides 65–71: the reflex motor limb is efferent, correcting the slide's afferent
  label. Walking is not taught as one simple acquired reflex. The pupillary model
  distinguishes CN II sensory input from CN III parasympathetic output with a
  peripheral relay. Clinical scenarios state established anatomy or diagnoses
  rather than claiming a single symptom proves a lesion or cause.


The Special Senses bank adapts the 79-slide `Special Senses Chapter 15.pptx`,
attributed to Ahmed Katsha, Raritan Valley Community College, and
OpenStax/Rice University under the source attribution above. Its 600 questions
include alternate formats, comparisons, and applications of shared concepts,
not 600 unique scientific facts. Added clinical and mechanistic material is
labeled and tied to relevant slides. Automated reference checks cover 75 pathway
and spatial keys plus selected corrected physiology and anatomy answers.

Special Senses source qualifications applied during authoring:

- Slides 6–12: receptor activation, transduction, and central perception are
  distinguished. Nociception does not equate to a fixed conscious pain experience.
  Papillae and taste buds are different structures; filiform papillae generally
  lack taste buds. Sweet, bitter, and umami use GPCR-related mechanisms in the
  introductory model; taste is not taught as a rigid tongue-zone map.
- Slides 14–19: conjunctiva does not cover the corneal optical surface. Tear
  drainage includes the lacrimal sac and nasolacrimal route. Extraocular actions
  depend on gaze position and include torsional components; the obliques are not
  described simply as pure medial/lateral movers. Diplopia alone does not identify
  one failed muscle or exclude monocular optical causes.
- Slides 22–45: corneal layers have different repair capacities. The posterior
  chamber belongs to the anterior segment and is distinct from the vitreous
  cavity. Near accommodation involves ciliary contraction, reduced zonular tension,
  and a more rounded lens; near response also includes convergence and miosis.
  Distance focus is not assigned solely to sympathetic activity, and no fixed
  near-distance cutoff is universal. The light-order model is explicitly a
  selected simplified nonfoveal route.
- Slides 30–55: retinal circuitry includes more than three cell types. The central
  foveolar region is rod-free; the whole foveal area is not treated as uniformly
  identical. Light normally lowers rod cGMP, closes cation channels, hyperpolarizes
  the receptor, and reduces glutamate release. Rods and cones use graded responses,
  while retinal ganglion cells generate output spikes. ON and OFF pathways differ.
  Full rod dark adaptation can continue for tens of minutes. Color deficiencies
  are not all X-linked or caused by total pigment absence. Nasal retinal axons
  cross at the chiasm; temporal axons generally remain uncrossed.
- Slides 57–75: endolymph fills the membranous labyrinth; perilymph surrounds it
  and fills scala vestibuli and scala tympani. Hair cells and afferent neurons are
  distinct cells. Cochlear mechanics depend on relative motion rather than equal
  static pressure on every receptor. High-frequency place coding favors the base,
  low-frequency coding more apical regions; frequency differs from intensity.
  A simplified scala-to-helicotrema drawing does not mean every tone peaks apically.
- Slides 76–79: utricular and saccular maculae detect gravito-inertial forces;
  semicircular cristae detect angular acceleration. The cupula normally lacks the
  otoconial loading of otolith membranes. Prolonged constant rotation is not
  treated as unlimited unchanging canal stimulation. Clinical extensions describe
  mechanisms without diagnosing a person from a symptom or prescribing treatment.


The Endocrine System bank adapts the 86-slide `Endocrine System Chapter 16.pptx`,
attributed to Ahmed Katsha, Raritan Valley Community College, and
OpenStax/Rice University under the source attribution above. Its 600 questions
include alternate formats, comparisons, and applications of shared concepts,
not 600 distinct scientific facts. Added mechanisms and clinical correlations
are labeled and tied to relevant slides. Automated reference checks cover 75
axis and spatial sequence keys plus selected corrected physiology answers.

Endocrine System source qualifications applied during authoring:

- Slides 6–18: endocrine speed and specificity depend on the hormone, receptors,
  and target context rather than an absolute contrast with neural signaling.
  Hormonal concentration reflects secretion and clearance. Steroids and peptides
  commonly differ in receptor location, but thyroid hormones are amino-acid-derived
  signals acting through intracellular receptors. Negative feedback predominates;
  positive feedback is not a universal endocrine control rule.
- Slides 20–40: ADH and oxytocin are synthesized in hypothalamic neurons and
  released from posterior terminals. Central ADH deficiency and renal resistance
  are distinct causes of diabetes insipidus. Portal delivery regulates anterior
  pituitary output. GH promotes IGF-1 production and changes nutrient use; its
  growth effects are not explained simply by blood glucose causing protein
  synthesis. Growth-plate status distinguishes gigantism from acromegaly.
  Prolactin supports milk synthesis, oxytocin supports ejection, and dopamine
  supplies tonic prolactin inhibition. GnRH timing and target-cell context matter.
- Slides 44–51: T3 and T4 are small iodinated amino-acid derivatives, not intact
  thyroglobulin proteins. Goiter describes enlargement, not one hormone state.
  Graves disease causes some hyperthyroidism rather than resulting from all
  thyroid hormone excess. Primary and central thyroid failure have different
  simplified feedback patterns. Developmental thyroid deficiency is described
  without outdated stigmatizing diagnostic language.
- Slides 52–57: calcitonin is not an equal indispensable controller alongside PTH
  in routine adult calcium balance. PTH-mediated osteoclast activity involves
  osteoblast-lineage signaling. Kidneys activate a vitamin D precursor to
  calcitriol; they do not create all vitamin D substrate de novo. Primary and
  secondary hyperparathyroidism need not have identical calcium concentrations.
- Slides 58–71: angiotensin II and potassium are major aldosterone regulators;
  ACTH mainly regulates glucocorticoid output. The RAAS sequence follows one
  explicitly selected branch, not every parallel action. Adrenal androgen
  precursors undergo peripheral conversion, including aromatization relevant after
  menopause. Muscle glycogen supports local use and is not identical to liver
  export of free glucose. Adrenergic responses vary by receptor and tissue.
  Cushing syndrome differs from pituitary Cushing disease.
- Slides 73–86: melatonin supports circadian timing without guaranteeing sleep
  or universally preventing puberty. Insulin-responsive GLUT4 uptake is not the
  only route of glucose entry into all tissues. Type 2 diabetes includes insulin
  resistance and secretory dysfunction, with genetic and environmental factors;
  age and body size alone do not define diabetes type. hCG supports the early
  corpus luteum; pregnancy immune tolerance is not blanket suppression caused
  solely by hCG. ANP-related sodium excretion does not by itself determine plasma
  sodium concentration. Clinical patterns are stated models, not diagnoses from
  isolated symptoms or prescriptions for treatment.


The Blood Cells bank adapts the 56-slide `Blood Cells Chapter 18.pptx`,
attributed to Ahmed Katsha, Raritan Valley Community College, and
OpenStax/Rice University under the source attribution above. Its 600 questions
include alternate formats, comparisons, and applications of shared concepts,
not 600 distinct scientific facts. Hemostasis extensions follow the explicit
objective on slide 3. Added mechanisms and clinical correlations are labeled.
Automated reference checks cover 75 sequence keys, ten quantitative exercises,
and selected corrected typing and physiology answers.

Blood Cells source qualifications applied during authoring:

- Slides 9–12: reference intervals and volume fractions vary by person and
  laboratory. Hematocrit is a fraction rather than a direct total-cell-mass
  measurement. The buffy coat contains platelets as well as white cells.
  Mature erythrocytes remain cells despite nuclear and organelle loss; platelets
  are megakaryocyte fragments. Globulins are not all antibodies, and fibrinogen
  is not the least abundant of every plasma protein.
- Slides 13–25: functional heme iron is ferrous. Oxygen binds heme iron while
  carbamino carbon dioxide binds globin; most carbon dioxide is transported as
  bicarbonate. The erythroid and recycling pathways are selected simplified
  milestones, not mutually exclusive intervals. EPO targets erythroid production
  rather than equally producing every lineage. Iron and globin can be reused.
  Bilirubin is a bile pigment, distinct from fat-emulsifying bile acids.
- Slides 27–29: anemia is interpreted through appropriate hemoglobin references.
  Early acute whole-blood loss can precede a major change in measured hematocrit.
  Sickle cell disease includes hemolysis and vaso-occlusion rather than belonging
  only to impaired production. Relative erythrocytosis from plasma contraction
  differs from increased total red-cell mass. A morphology pattern alone does
  not establish one nutritional or genetic cause.
- Slides 31–41: granulocyte classification concerns conspicuous specific granules,
  not the absolute absence of all granules in agranulocytes. Eosinophil activity
  against large helminths includes extracellular granule effects. Resident
  macrophages do not all arise from newly circulating adult monocytes. Leukemia
  can occur with high, normal, or low circulating white-cell counts. A commonly
  used adult platelet interval is about 150,000–450,000/µL, with laboratory variation.
- Slides 44–52: ABO red-cell determinants are not the only red-cell antigens.
  Type O lacks A and B, not every antigen. D is important but not the only
  clinically relevant Rh determinant. Red-cell and plasma component rules differ:
  donor red-cell antigens and donor plasma antibodies create different constraints.
  The O-negative donor and AB-positive recipient models are explicitly limited
  to theoretical ABO/RhD packed-red-cell compatibility, not whole-blood or plasma
  compatibility or universal clinical safety. Other antigens, antibody screening,
  crossmatching, and clinical context remain relevant.
- Slides 53–56: immune anti-D follows relevant sensitization; passive antibodies
  and maternal transfer require separate interpretation. A first recognized
  pregnancy is not guaranteed safe if prior sensitization occurred. IgG can cross
  the placenta; antibodies beyond anti-D can matter. Rh immune globulin is
  preventive in eligible unsensitized contexts, not an eraser of established
  immune memory. No individual preventive schedule or treatment dose is prescribed.
