# Microbemon battle question provenance

Source: user-provided `Chapter 12 (1).pptx`, Chapter 12, The Eukaryotic Members
of the Microbial World; Nester's Microbiology: A Human Perspective, 10th edition,
lecture outline. Deck copyright year: 2022. SHA-256: `9932850fb215c81aa17c22cb221c5709b63fdee30a7e74b333e449d060ce9b38`.

The full textbook PDF could not be transferred because it exceeded the 32 MiB
limit. The 70 new original questions were checked against the lecture text.
The source PowerPoint and textbook are not distributed with the bot.

| Slides | Question topics |
| --- | --- |
| 29–30 | Protozoan cell basics, nutrition, movement and cilia |
| 31 | Intestinal protozoan trophozoites, cysts and excystation |
| 32 | Free-living protozoan habitats and ecological roles |
| 33–34 | Amoeboid movement, feeding, binary fission and E. histolytica |
| 35–36 | Apicomplexan host cells; Plasmodium disease, blood stages and hosts |
| 37 | Trypanosoma brucei vector, disease and kinetoplast |
| 38 | Giardia habitat, movement, reproduction, cyst transmission and diarrhea |
| 55–57 | Helminth identification and hosts; pinworm, hookworm and Ascaris |
| 59 | Tapeworm body plan, nutrition, attachment, segments and transmission |
| 60–61 | Fluke body plan and hosts; schistosome transmission and egg-related damage |

Each question in `src/services/microbemon/questions.js` records its slide and
applicable species. Some named roster species are not individually discussed;
appropriate group-level facts are shared across them. Species-specific original
lab-note facts and artwork remain separate. No slide claim that all amoebae lack
mitochondria was used, and no slime-mold plasmodium was confused with malaria
parasites. The adult-tapeworm transmission question explicitly concerns larvae
in meat, not the distinct route of T. solium cysticercosis.

## Textbook bacteria expansion

The user's photographed textbook roster supplies **names only**, not the added
morphology, physiology, or disease explanations. The 21 bacteria below extend the
original 19 organisms to 40. Existing species IDs and saved pets are unchanged.
Each bacterial entry records its printed label and source separately from the
general educational references attached to the 46 new original battle questions.
No textbook passages or photographs are distributed with the bot.

| Printed textbook label | Display name / treatment |
| --- | --- |
| Alcaligenes faecalis | Alcaligenes faecalis |
| Bacillus cereus | Bacillus cereus |
| Bacillus megaterium | Priestia megaterium; printed name retained |
| Enterobacter aerogenes | Klebsiella aerogenes; printed name retained |
| Enterobacter faecalis | Corrected typo: Enterococcus faecalis; printed name retained |
| Escherichia coli | Escherichia coli |
| Klebsiella pneumoniae | Klebsiella pneumoniae |
| Micrococcus luteus | Micrococcus luteus |
| Mycobacterium smegmatis | Mycobacterium smegmatis, a widely used name |
| Proteus vulgaris | Proteus vulgaris |
| Pseudomonas aeruginosa | Pseudomonas aeruginosa |
| Salmonella typhimurium | Salmonella enterica serovar Typhimurium |
| Serratia marcescens | Serratia marcescens |
| Shigella dysenteriae | Shigella dysenteriae |
| Staphylococcus aureus | Staphylococcus aureus |
| Staphylococcus epidermidis | Staphylococcus epidermidis |
| Streptococcus lactis | Lactococcus lactis; printed name retained |
| Streptococcus mitis | Streptococcus mitis |
| Streptococcus pyogenes | Streptococcus pyogenes |
| Sarcina subflava | Unverified legacy label preserved exactly |
| Clostridium sporogenes | Clostridium sporogenes |

Taxonomic cross-references: LPSN entries for
[Priestia megaterium](https://lpsn.dsmz.de/species/priestia-megaterium),
[Klebsiella aerogenes](https://lpsn.dsmz.de/species/klebsiella-aerogenes), and
[Lactococcus lactis](https://lpsn.dsmz.de/species/lactococcus-lactis).
Name questions also link to the corresponding NCBI Taxonomy search, which is a
taxonomy lookup rather than evidence for cell morphology.

Educational facts were checked against these public references:

- [OpenStax 3.3, prokaryotic cells](https://openstax.org/books/microbiology/pages/3-3-unique-characteristics-of-prokaryotic-cells): cell organization, membranes, ribosomes and shape terms.
- [OpenStax 9.1, microbial growth](https://openstax.org/books/microbiology/pages/9-1-how-microbes-grow): binary fission.
- [OpenStax 4.2, Proteobacteria](https://openstax.org/books/microbiology/pages/4-2-proteobacteria): enteric/environmental rods, Klebsiella capsules, Proteus motility, Pseudomonas and Serratia pigmentation, Shigella disease.
- [OpenStax 4.4, Gram-positive bacteria](https://openstax.org/books/microbiology/pages/4-4-gram-positive-bacteria): cocci/rods, Bacillus/Clostridium endospores, mycobacterial envelopes, staphylococcal clusters and skin flora, group A streptococci.
- [Alcaligenes faecalis descriptive study](https://pubmed.ncbi.nlm.nih.gov/9354352/): environmental rods.
- [Bacillus megaterium study](https://pmc.ncbi.nlm.nih.gov/articles/PMC7053513/): large rod-shaped cells; the taxonomy reference above supplies the newer genus name.
- [BacDive M. luteus type strain](https://bacdive.dsmz.de/strain/7673): coccoid morphology and yellow pigment.
- [NLM MeSH, Lactococcus lactis](https://www.ncbi.nlm.nih.gov/mesh?Cmd=DetailsSearch&Db=mesh&Term=%22Lactococcus+lactis%22%5BMeSH+Terms%5D): dairy/lactic acid association.
- [S. mitis oral microbiota study](https://pmc.ncbi.nlm.nih.gov/articles/PMC98734/): oral habitat.

Sarcina subflava receives only shared bacteria basics; no unverified
species-specific shape, Gram reaction, physiology, or disease claims are added.
Its portrait is a question-mark badge. Other new portraits are original schematic
rod/coccus mascots rendered as PNGs at runtime, with distinct fictional palettes
and shiny variants. Colors are decorative, not Gram-stain results; facial marks
are decorative, not nuclei or other organelles. The existing illustrated portraits
continue to load from their original files. Game rarity is fictional.
