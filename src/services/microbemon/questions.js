// Original questions paraphrased from the user-provided Chapter 12 (1).pptx.
// Keep slide references for review; the full textbook was not accessible.
import { SPECIES } from './catalog.js';
const groups = {
    protozoa: SPECIES.filter(s => ['Amoeboid protist', 'Ciliate', 'Flagellated protist', 'Apicomplexan'].includes(s.group)).map(s => s.id),
    freeLiving: ['amoeba', 'paramecium', 'stentor', 'vorticella'],
    amoebae: ['amoeba', 'entamoeba'], ciliates: ['paramecium', 'stentor', 'vorticella', 'balantidium'],
    intestinalProtozoa: ['entamoeba', 'giardia', 'balantidium'],
    apicomplexans: ['toxoplasma', 'plasmodium'],
    helminths: SPECIES.filter(s => ['Nematode', 'Cestode', 'Trematode'].includes(s.group)).map(s => s.id),
    nematodes: ['enterobius', 'ascaris', 'necator', 'trichinella'], cestodes: ['solium', 'saginata'],
    flukes: ['fasciola', 'fasciolopsis', 'paragonimus', 'schistosoma'],
    tissueFlukes: ['fasciola', 'fasciolopsis', 'paragonimus']
};
const q = (id, target, topic, slide, text, correct, wrong1, wrong2, explanation) => ({
    id, species: groups[target] || [target], topic, source: { file: 'Chapter 12 (1).pptx', slide },
    text, answers: [correct, wrong1, wrong2], correct: 0, explanation
});
export const BATTLE_QUESTIONS = [
    q('proto-cell', 'protozoa', 'Cell basics', 29, 'A protozoan is usually made of how many cells?', 'One cell', 'Many tissues', 'No cells', 'Protozoa are single-celled eukaryotic organisms.'),
    q('proto-food', 'protozoa', 'Nutrition', 29, 'Protozoa are heterotrophs. What does that mean?', 'They obtain organic nutrients from other sources', 'They all make food using sunlight', 'They do not need nutrients', 'Heterotrophs obtain organic nutrients rather than making all their food by photosynthesis.'),
    q('proto-wall', 'protozoa', 'Cell basics', 30, 'Which statement fits most protozoa?', 'They lack a cell wall', 'They all have woody walls', 'They all have bacterial peptidoglycan walls', 'Most protozoa lack a cell wall, although some forms have protective shells or coverings.'),
    q('proto-move', 'protozoa', 'Movement', 30, 'Which structures can help protozoa move?', 'Cilia, flagella, or pseudopods', 'Leaves and roots', 'Bones and joints', 'Different protozoa use cilia, flagella, or pseudopods; movement can help with identification.'),
    q('pond-place', 'freeLiving', 'Habitat', 32, 'Where are many free-living protozoa found?', 'Aquatic environments', 'Only dry desert air', 'Only inside human bones', 'Many free-living protozoa occur in aquatic environments; others occur in moist soil or with other organisms.'),
    q('pond-food', 'freeLiving', 'Nutrition', 32, 'What can free-living protozoa eat?', 'Bacteria and algae', 'Only rocks', 'Only sunlight', 'Free-living protozoa can feed on bacteria and algae and become food for larger organisms.'),
    q('pond-chain', 'freeLiving', 'Ecology', 32, 'How can protozoa contribute to a food chain?', 'They eat microbes and are eaten by larger organisms', 'They prevent every organism from feeding', 'They turn all animals into plants', 'Protozoa connect smaller microbes with larger consumers in food chains.'),
    q('amoeba-move', 'amoebae', 'Movement', 33, 'What does an amoeba extend to move forward?', 'Pseudopods', 'Cysts', 'Flagella', 'Pseudopods are temporary cell extensions used for amoeboid movement.'),
    q('amoeba-meal', 'amoebae', 'Nutrition', 33, 'Besides movement, what can pseudopods help an amoeba do?', 'Engulf food particles', 'Attach using a scolex', 'Move using an undulating membrane', 'Amoebae can surround and engulf particles using pseudopods.'),
    q('amoeba-split', 'amoebae', 'Reproduction', 33, 'How do amoebae commonly reproduce asexually?', 'Binary fission', 'Sexual reproduction only', 'Producing tapeworm segments', 'Binary fission divides one cell into two daughter cells.'),
    q('entamoeba-disease', 'entamoeba', 'Disease', 34, 'Entamoeba histolytica can cause which illness?', 'Dysentery', 'Malaria', 'African sleeping sickness', 'Entamoeba histolytica can cause intestinal illness ranging from mild diarrhea to severe dysentery.'),
    q('entamoeba-compare', 'entamoeba', 'Disease', 34, 'Are all intestinal amoebae disease-causing?', 'No; many are harmless commensals', 'Yes; every amoeba causes dysentery', 'No amoeba can ever cause disease', 'Many intestinal amoebae are commensals, while Entamoeba histolytica is an important pathogen.'),
    q('intestinal-active', 'intestinalProtozoa', 'Life cycle', 31, 'What is the growing, feeding form of an intestinal protozoan called?', 'Trophozoite', 'Proglottid', 'Scolex', 'A trophozoite is the active growing and feeding form.'),
    q('intestinal-survive', 'intestinalProtozoa', 'Life cycle', 31, 'Which form helps these intestinal protozoa survive outside the host?', 'Cyst', 'Scolex', 'Leaf', 'A cyst is a resistant survival form that can persist outside a host.'),
    q('intestinal-release', 'intestinalProtozoa', 'Life cycle', 31, 'What is released when a swallowed protozoan cyst opens in the intestine?', 'Trophozoites', 'Tapeworm larvae', 'Cercariae', 'Excystation releases trophozoites, which can then feed and multiply.'),
    q('intestinal-stomach', 'intestinalProtozoa', 'Transmission', 31, 'Why is the cyst stage important after it is swallowed?', 'It can survive passage through the stomach', 'It immediately becomes a blood fluke', 'It only survives inside red blood cells', 'Cysts can survive passage through the stomach and release trophozoites in the intestine.'),
    q('ciliate-identify', 'ciliates', 'Movement', 30, 'What are the short hair-like structures used by ciliates?', 'Cilia', 'Proglottids', 'Pseudopods', 'Cilia are short hair-like structures that help ciliates move or move material near the cell.'),
    q('apical-tool', 'apicomplexans', 'Host cells', 35, 'What does the apical complex help these parasites do?', 'Enter host cells', 'Move using cilia', 'Absorb food through proglottids', 'The apical complex helps an apicomplexan penetrate host-cell membranes.'),
    q('apical-location', 'apicomplexans', 'Host cells', 35, 'These obligate intracellular parasites need to live where?', 'Inside host cells', 'Only in open stream water', 'Only on the surface of leaves', 'Obligate intracellular parasites depend on living within host cells.'),
    q('apical-definitive', 'apicomplexans', 'Life cycle', 35, 'In a parasite life cycle, where does sexual reproduction occur?', 'In the definitive host', 'In the intermediate host only', 'Outside all hosts only', 'The definitive host is the host in which sexual reproduction occurs.'),
    q('plasmo-disease', 'plasmodium', 'Disease', 36, 'Which disease is caused by Plasmodium species?', 'Malaria', 'Ascariasis', 'Giardiasis', 'Plasmodium species are the parasites responsible for malaria.'),
    q('plasmo-rbc', 'plasmodium', 'Host cells', 36, 'Which blood cells are repeatedly infected during the blood stage of malaria?', 'Red blood cells', 'Platelets', 'White blood cells only', 'Blood-stage Plasmodium parasites infect red blood cells and replicate inside them.'),
    q('plasmo-host', 'plasmodium', 'Life cycle', 36, 'Which host is the definitive host for Plasmodium?', 'The mosquito', 'The human', 'A snail', 'Sexual reproduction occurs in the mosquito, making it the definitive host.'),
    q('plasmo-human', 'plasmodium', 'Life cycle', 36, 'What role does the human have in the Plasmodium life cycle?', 'Intermediate host', 'Snail host', 'Photosynthetic host', 'Humans are intermediate hosts, where the parasite undergoes asexual replication.'),
    q('plasmo-rupture', 'plasmodium', 'Host cells', 36, 'What can happen after Plasmodium multiplies inside a red blood cell?', 'The infected cell ruptures', 'The cell develops cilia', 'The cell becomes a cyst in soil', 'Repeated infection, replication, and rupture of red blood cells are part of the malaria blood stage.'),
    q('tryp-vector', 'trypanosoma', 'Transmission', 37, 'Which insect transmits Trypanosoma brucei?', 'Tsetse fly', 'Kissing bug', 'Sandfly', 'Tsetse flies transmit Trypanosoma brucei; other listed insects transmit different parasites.'),
    q('tryp-disease', 'trypanosoma', 'Disease', 37, 'Trypanosoma brucei can cause which disease?', 'African sleeping sickness', 'Malaria', 'Ascariasis', 'Trypanosoma brucei causes African trypanosomiasis, also called sleeping sickness.'),
    q('tryp-kinetoplast', 'trypanosoma', 'Cell basics', 37, 'The kinetoplast contains a distinctive mass of what?', 'Mitochondrial DNA', 'Nuclear DNA only', 'Egg-containing proglottids', 'Kinetoplastids have a distinctive mass of mitochondrial DNA called a kinetoplast.'),
    q('giardia-place', 'giardia', 'Habitat', 38, 'Giardia lamblia lives in which part of the body?', 'Intestinal tract', 'Blood vessels', 'Liver bile ducts', 'Giardia colonizes the intestinal tract and can cause diarrhea.'),
    q('giardia-water', 'giardia', 'Transmission', 38, 'How can a person acquire Giardia from stream water?', 'By swallowing water containing cysts', 'Through larvae penetrating bare skin', 'Through a tsetse fly bite', 'Drinking water containing Giardia cysts can lead to infection.'),
    q('giardia-move', 'giardia', 'Movement', 38, 'Which structures help Giardia move?', 'Flagella', 'Cilia', 'Proglottids', 'Giardia is a flagellate and uses flagella for movement.'),
    q('giardia-illness', 'giardia', 'Disease', 38, 'Which symptom is commonly associated with Giardia infection?', 'Diarrhea', 'Malaria-like blood-cell cycles', 'Intestinal tapeworm segments', 'Giardia is an important cause of diarrheal illness.'),
    q('giardia-divide', 'giardia', 'Reproduction', 38, 'Giardia can reproduce asexually by which process?', 'Binary fission', 'Producing cercariae', 'Growing proglottids', 'Lumen-dwelling flagellates such as Giardia reproduce asexually by binary fission.'),
    q('worm-size', 'helminths', 'Body basics', 55, 'A helminth is a multicellular…', 'Worm', 'Bacterium', 'Virus', 'Helminths are multicellular animals commonly called worms.'),
    q('worm-find', 'helminths', 'Identification', 55, 'What can help identify many parasitic helminths?', 'Their microscopic eggs', 'Their bacterial cell walls', 'Their chloroplasts', 'Characteristic microscopic eggs can help identify many helminth infections.'),
    q('worm-immature', 'helminths', 'Life cycle', 55, 'Which host may contain an immature stage of a helminth?', 'An intermediate host', 'Only the definitive host in every life cycle', 'Only a red blood cell in every life cycle', 'An intermediate host houses an immature or developing stage in many helminth life cycles.'),
    q('worm-sexual', 'helminths', 'Life cycle', 55, 'A helminth usually reproduces sexually in which host?', 'Definitive host', 'Intermediate host only', 'The external environment only', 'The definitive host is where sexual reproduction takes place.'),
    q('worm-nutrients', 'helminths', 'Nutrition', 55, 'How can some parasitic worms harm a host?', 'By taking nutrients or damaging tissues', 'By making all host cells photosynthesize', 'By turning blood into air', 'Some parasitic helminths take nutrients from the host or invade and damage tissues.'),
    q('round-shape', 'nematodes', 'Appearance', 57, 'What body shape is typical of a roundworm?', 'Cylindrical with tapered ends', 'Flat ribbon made of segments', 'A flat leaf-like body', 'Nematodes have cylindrical bodies that taper toward the ends.'),
    q('round-gut', 'nematodes', 'Body basics', 57, 'A roundworm digestive tract extends from…', 'Mouth to anus', 'Mouth only, without an anus', 'No digestive tract at all', 'Roundworms have a digestive tract with both a mouth and an anus.'),
    q('round-free', 'nematodes', 'Ecology', 57, 'Are all nematodes parasites?', 'No; many are free-living in soil or water', 'Yes; all live only in humans', 'All are bacteria', 'Many nematodes are free-living, while others are parasites.'),
    q('pinworm-entry', 'enterobius', 'Transmission', 56, 'How can pinworm eggs enter the body?', 'By being swallowed', 'Through a mosquito bite', 'Through larvae penetrating skin', 'Pinworm infection can follow ingestion of eggs, including eggs contaminating food.'),
    q('hookworm-entry', 'necator', 'Transmission', 56, 'How can hookworm larvae enter a human?', 'By penetrating the skin', 'Only through an insect bite', 'Only through swallowing adult worms', 'Hookworm larvae in contaminated soil can burrow through skin.'),
    q('hookworm-risk', 'necator', 'Prevention', 56, 'Which habit can increase hookworm exposure in contaminated soil?', 'Walking barefoot', 'Wearing protective footwear', 'Avoiding direct soil contact', 'Bare feet allow infective larvae in contaminated soil to contact and penetrate skin.'),
    q('hookworm-soil', 'necator', 'Habitat', 56, 'Where do infective hookworm larvae develop before entering people?', 'Soil', 'Inside a mosquito', 'In undercooked beef muscle', 'Hookworm larvae develop in soil; poor sanitation contributes to transmission.'),
    q('ascaris-name', 'ascaris', 'Disease', 57, 'What is infection with Ascaris lumbricoides called?', 'Ascariasis', 'Malaria', 'Sleeping sickness', 'Ascaris lumbricoides causes ascariasis.'),
    q('ascaris-eggs', 'ascaris', 'Transmission', 57, 'Which stage is swallowed to begin an Ascaris infection?', 'Infective eggs', 'Free-swimming cercariae', 'Tapeworm larvae in meat', 'Ascaris infection begins when infective eggs are ingested.'),
    q('ascaris-lung', 'ascaris', 'Life cycle', 57, 'Ascaris larvae migrate through which organ before being swallowed again?', 'Lungs', 'Urinary bladder', 'Skin surface only', 'Larvae migrate through the lungs, move up the airways, and are swallowed back into the digestive tract.'),
    q('ascaris-food', 'ascaris', 'Nutrition', 57, 'Adult Ascaris obtain nutrients from where?', 'Material passing through the digestive tract', 'Photosynthesis', 'Feeding on soil after adulthood', 'Adult Ascaris feed on nutrients passing through the host digestive tract.'),
    q('ascaris-exit', 'ascaris', 'Life cycle', 57, 'How do Ascaris eggs leave the human host?', 'In feces', 'Through mosquito bites', 'Through the skin as cercariae', 'Adult female Ascaris produce eggs that leave the host in feces.'),
    q('tape-shape', 'cestodes', 'Appearance', 59, 'What is a typical tapeworm body like?', 'Flat and ribbon-shaped', 'A flat leaf-like body', 'A bell on a stalk', 'Tapeworms have flat, ribbon-shaped bodies with repeated segments.'),
    q('tape-food', 'cestodes', 'Nutrition', 59, 'How do tapeworms obtain nutrients?', 'Absorb them across their body surface', 'Use photosynthesis', 'Ingest food through a complete mouth-to-anus gut', 'Tapeworms absorb nutrients across the body surface.'),
    q('tape-anchor', 'cestodes', 'Body basics', 59, 'Which part anchors a tapeworm to the intestine?', 'Scolex', 'Flagellum', 'Cilium', 'The scolex is the head end that attaches to the host intestine.'),
    q('tape-segments', 'cestodes', 'Appearance', 59, 'What are tapeworm body segments called?', 'Proglottids', 'Pseudopods', 'Cysts', 'Tapeworm segments are called proglottids.'),
    q('tape-eggs', 'cestodes', 'Life cycle', 59, 'Egg-containing tapeworm segments can leave the host in…', 'Feces', 'Urine in every tapeworm infection', 'Saliva only', 'Egg-containing proglottids can be passed in feces.'),
    q('tape-meat', 'cestodes', 'Transmission', 59, 'How can humans acquire an adult intestinal tapeworm?', 'By eating infected undercooked meat containing larvae', 'Through a tsetse fly bite', 'Through cercariae penetrating skin', 'Tapeworm larvae in infected undercooked meat can develop into adult intestinal tapeworms.'),
    q('tape-sexes', 'cestodes', 'Reproduction', 59, 'What reproductive structures can a tapeworm segment contain?', 'Both male and female structures', 'Only male structures in every segment', 'No reproductive structures', 'Proglottids contain male and female reproductive structures.'),
    q('fluke-shape', 'flukes', 'Appearance', 60, 'Most flukes have which general body shape?', 'Flat and leaf-like', 'A long segmented ribbon', 'Cylindrical and tapered like a roundworm', 'Most flukes are flattened and leaf-shaped; blood flukes have a more elongated form.'),
    q('fluke-suckers', 'flukes', 'Body basics', 60, 'What helps a fluke attach to surfaces?', 'Suckers', 'Cilia covering the whole body', 'Pseudopods', 'Flukes use suckers for attachment or movement along a surface.'),
    q('fluke-snail', 'flukes', 'Life cycle', 60, 'Which animal commonly serves as an intermediate host for flukes?', 'Snail', 'Tsetse fly', 'Mosquito', 'Snails are intermediate hosts in the fluke life cycles covered here.'),
    q('fluke-hosts', 'flukes', 'Life cycle', 60, 'Fluke life cycles commonly require…', 'At least two hosts', 'No intermediate host', 'Only one host in every case', 'Flukes have complex life cycles involving at least two hosts.'),
    q('fluke-gut', 'flukes', 'Body basics', 60, 'Which statement fits the digestive system of these flukes?', 'A mouth but no anus', 'A complete mouth-to-anus gut', 'No digestive opening at all', 'Flukes have a mouth but lack an anus.'),
    q('fluke-sexes', 'tissueFlukes', 'Reproduction', 60, 'Tissue flukes generally have…', 'Both male and female reproductive organs', 'Only male organs in every individual', 'No reproductive organs', 'Tissue flukes are generally hermaphroditic, unlike schistosome blood flukes.'),
    q('schisto-disease', 'schistosoma', 'Disease', 60, 'Schistosoma blood flukes cause…', 'Schistosomiasis', 'Giardiasis', 'Malaria', 'Schistosomes are blood flukes that cause schistosomiasis.'),
    q('schisto-skin', 'schistosoma', 'Transmission', 61, 'How can Schistosoma cercariae enter people?', 'Penetrate the skin in contaminated freshwater', 'Only through eating pork', 'Only through a tsetse fly bite', 'Cercariae released by infected snails can penetrate human skin in freshwater.'),
    q('schisto-blood', 'schistosoma', 'Habitat', 61, 'Adult schistosomes mature in the human…', 'Blood vessels', 'Intestinal lumen', 'Liver bile ducts', 'Adult schistosomes live in blood vessels, where mating and egg production occur.'),
    q('schisto-snail', 'schistosoma', 'Life cycle', 61, 'Which host releases the infective cercariae?', 'An infected snail', 'A cow', 'A tsetse fly', 'Infected snails release cercariae into water.'),
    q('schisto-exit', 'schistosoma', 'Life cycle', 61, 'Depending on the species, schistosome eggs can leave the body in…', 'Feces or urine', 'Saliva only', 'Sweat only', 'Schistosome eggs may leave through feces or urine, depending on the species.'),
    q('schisto-sexes', 'schistosoma', 'Reproduction', 60, 'Unlike most tissue flukes, schistosomes have…', 'Separate male and female worms', 'No reproductive organs', 'Only female worms', 'Blood flukes such as Schistosoma have separate sexes.'),
    q('schisto-damage', 'schistosoma', 'Disease', 61, 'What is a major cause of tissue damage in schistosomiasis?', 'Inflammation around trapped eggs', 'Loss of chloroplasts from red blood cells', 'Adults turning into tapeworm segments', 'Eggs trapped in tissues can trigger inflammation and ongoing tissue damage.')
];
BATTLE_QUESTIONS.push(...[
  {
    "id": "roster-bacterium-0",
    "species": [
      "alcaligenes",
      "cereus",
      "megaterium",
      "aerogenes",
      "faecalis",
      "ecoli",
      "klebsiella",
      "micrococcus",
      "mycobacterium",
      "proteus",
      "pseudomonas",
      "salmonella",
      "serratia",
      "shigella",
      "aureus",
      "epidermidis",
      "lactococcus",
      "mitis",
      "pyogenes",
      "sarcina",
      "sporogenes"
    ],
    "topic": "Cell basics",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Bacterium"
    },
    "text": "What type of cell is a bacterium?",
    "answers": [
      "Prokaryotic",
      "Animal tissue",
      "Acellular virus"
    ],
    "correct": 0,
    "explanation": "Bacteria are prokaryotic cells without a membrane-bound nucleus."
  },
  {
    "id": "roster-bacterium-1",
    "species": [
      "alcaligenes",
      "cereus",
      "megaterium",
      "aerogenes",
      "faecalis",
      "ecoli",
      "klebsiella",
      "micrococcus",
      "mycobacterium",
      "proteus",
      "pseudomonas",
      "salmonella",
      "serratia",
      "shigella",
      "aureus",
      "epidermidis",
      "lactococcus",
      "mitis",
      "pyogenes",
      "sarcina",
      "sporogenes"
    ],
    "topic": "Reproduction",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Bacterium"
    },
    "text": "How do most bacteria multiply?",
    "answers": [
      "Binary fission",
      "Producing tapeworm eggs",
      "Budding mushrooms"
    ],
    "correct": 0,
    "explanation": "Most bacteria multiply by binary fission."
  },
  {
    "id": "roster-bacterium-2",
    "species": [
      "alcaligenes",
      "cereus",
      "megaterium",
      "aerogenes",
      "faecalis",
      "ecoli",
      "klebsiella",
      "micrococcus",
      "mycobacterium",
      "proteus",
      "pseudomonas",
      "salmonella",
      "serratia",
      "shigella",
      "aureus",
      "epidermidis",
      "lactococcus",
      "mitis",
      "pyogenes",
      "sarcina",
      "sporogenes"
    ],
    "topic": "Appearance",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Bacterium"
    },
    "text": "What does the term bacillus describe?",
    "answers": [
      "Rod shape",
      "A flat worm",
      "A viral envelope"
    ],
    "correct": 0,
    "explanation": "Bacillus describes a rod-shaped cell; it is also the name of a bacterial genus."
  },
  {
    "id": "roster-bacterium-3",
    "species": [
      "alcaligenes",
      "cereus",
      "megaterium",
      "aerogenes",
      "faecalis",
      "ecoli",
      "klebsiella",
      "micrococcus",
      "mycobacterium",
      "proteus",
      "pseudomonas",
      "salmonella",
      "serratia",
      "shigella",
      "aureus",
      "epidermidis",
      "lactococcus",
      "mitis",
      "pyogenes",
      "sarcina",
      "sporogenes"
    ],
    "topic": "Appearance",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Bacterium"
    },
    "text": "What does the term coccus describe?",
    "answers": [
      "Spherical shape",
      "A segmented worm",
      "A leaf-shaped fluke"
    ],
    "correct": 0,
    "explanation": "Cocci are spherical or approximately spherical bacterial cells."
  },
  {
    "id": "roster-bacterium-4",
    "species": [
      "alcaligenes",
      "cereus",
      "megaterium",
      "aerogenes",
      "faecalis",
      "ecoli",
      "klebsiella",
      "micrococcus",
      "mycobacterium",
      "proteus",
      "pseudomonas",
      "salmonella",
      "serratia",
      "shigella",
      "aureus",
      "epidermidis",
      "lactococcus",
      "mitis",
      "pyogenes",
      "sarcina",
      "sporogenes"
    ],
    "topic": "Cell basics",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Bacterium"
    },
    "text": "What structure commonly surrounds a bacterial cell membrane?",
    "answers": [
      "Cell wall",
      "Nuclear envelope",
      "Mushroom cap"
    ],
    "correct": 0,
    "explanation": "Most bacteria have a cell wall containing peptidoglycan."
  },
  {
    "id": "roster-bacterium-5",
    "species": [
      "alcaligenes",
      "cereus",
      "megaterium",
      "aerogenes",
      "faecalis",
      "ecoli",
      "klebsiella",
      "micrococcus",
      "mycobacterium",
      "proteus",
      "pseudomonas",
      "salmonella",
      "serratia",
      "shigella",
      "aureus",
      "epidermidis",
      "lactococcus",
      "mitis",
      "pyogenes",
      "sarcina",
      "sporogenes"
    ],
    "topic": "Ecology",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Bacterium"
    },
    "text": "Are all bacteria harmful?",
    "answers": [
      "No; many have beneficial roles",
      "Yes; all cause disease",
      "All are parasites"
    ],
    "correct": 0,
    "explanation": "Bacteria have varied ecological roles; many are beneficial or harmless."
  },
  {
    "id": "roster-fungus-0",
    "species": [
      "rhizopus",
      "mucor",
      "aspergillus",
      "penicillium",
      "peziza",
      "coprinus",
      "saccharomyces",
      "cryptococcus",
      "candida",
      "pseudotropicalis"
    ],
    "topic": "Cell basics",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Fungus"
    },
    "text": "Fungal cells are…",
    "answers": [
      "Eukaryotic",
      "Acellular",
      "Prokaryotic"
    ],
    "correct": 0,
    "explanation": "Fungi are eukaryotic organisms with membrane-bound nuclei."
  },
  {
    "id": "roster-fungus-1",
    "species": [
      "rhizopus",
      "mucor",
      "aspergillus",
      "penicillium",
      "peziza",
      "coprinus",
      "saccharomyces",
      "cryptococcus",
      "candida",
      "pseudotropicalis"
    ],
    "topic": "Nutrition",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Fungus"
    },
    "text": "How do fungi obtain nutrients?",
    "answers": [
      "Absorption",
      "Eating with teeth",
      "Only photosynthesis"
    ],
    "correct": 0,
    "explanation": "Fungi absorb organic nutrients from their surroundings."
  },
  {
    "id": "roster-fungus-2",
    "species": [
      "rhizopus",
      "mucor",
      "aspergillus",
      "penicillium",
      "peziza",
      "coprinus",
      "saccharomyces",
      "cryptococcus",
      "candida",
      "pseudotropicalis"
    ],
    "topic": "Body basics",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Fungus"
    },
    "text": "What are fungal filaments called?",
    "answers": [
      "Hyphae",
      "Flagella",
      "Proglottids"
    ],
    "correct": 0,
    "explanation": "Hyphae are fungal filaments; a network of hyphae is a mycelium."
  },
  {
    "id": "roster-fungus-3",
    "species": [
      "rhizopus",
      "mucor",
      "aspergillus",
      "penicillium",
      "peziza",
      "coprinus",
      "saccharomyces",
      "cryptococcus",
      "candida",
      "pseudotropicalis"
    ],
    "topic": "Body basics",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Fungus"
    },
    "text": "What is a network of fungal hyphae called?",
    "answers": [
      "Mycelium",
      "Scolex",
      "Capsid"
    ],
    "correct": 0,
    "explanation": "A mycelium is the network formed by fungal hyphae."
  },
  {
    "id": "roster-fungus-4",
    "species": [
      "rhizopus",
      "mucor",
      "aspergillus",
      "penicillium",
      "peziza",
      "coprinus",
      "saccharomyces",
      "cryptococcus",
      "candida",
      "pseudotropicalis"
    ],
    "topic": "Reproduction",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Fungus"
    },
    "text": "Which process is common in yeasts?",
    "answers": [
      "Budding",
      "Laying worm eggs",
      "Forming cercariae"
    ],
    "correct": 0,
    "explanation": "Many yeasts reproduce asexually by budding."
  },
  {
    "id": "roster-fungus-5",
    "species": [
      "rhizopus",
      "mucor",
      "aspergillus",
      "penicillium",
      "peziza",
      "coprinus",
      "saccharomyces",
      "cryptococcus",
      "candida",
      "pseudotropicalis"
    ],
    "topic": "Ecology",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Fungus"
    },
    "text": "What is an important ecological role of many fungi?",
    "answers": [
      "Decomposition",
      "Making all oxygen",
      "Preventing nutrient recycling"
    ],
    "correct": 0,
    "explanation": "Many fungi decompose organic matter and recycle nutrients."
  },
  {
    "id": "roster-virus-0",
    "species": [
      "bacteriophage",
      "influenza"
    ],
    "topic": "Cell basics",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Virus"
    },
    "text": "A virus is…",
    "answers": [
      "Acellular",
      "A multicellular animal",
      "A fungal cell"
    ],
    "correct": 0,
    "explanation": "Viruses are acellular infectious agents that depend on host cells for replication."
  },
  {
    "id": "roster-virus-1",
    "species": [
      "bacteriophage",
      "influenza"
    ],
    "topic": "Reproduction",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Virus"
    },
    "text": "Viruses replicate using…",
    "answers": [
      "Host cells",
      "Only water",
      "Tapeworm segments"
    ],
    "correct": 0,
    "explanation": "Viruses depend on host-cell machinery to produce new virus particles."
  },
  {
    "id": "roster-virus-2",
    "species": [
      "bacteriophage",
      "influenza"
    ],
    "topic": "Body basics",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Virus"
    },
    "text": "What is a viral capsid made of?",
    "answers": [
      "Protein",
      "Peptidoglycan",
      "Cellulose only"
    ],
    "correct": 0,
    "explanation": "A capsid is the protein coat surrounding a viral genome."
  },
  {
    "id": "roster-virus-3",
    "species": [
      "bacteriophage",
      "influenza"
    ],
    "topic": "Cell basics",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Virus"
    },
    "text": "A viral genome can be composed of…",
    "answers": [
      "DNA or RNA",
      "Only protein",
      "Only sugar"
    ],
    "correct": 0,
    "explanation": "Different viruses have DNA or RNA genomes."
  },
  {
    "id": "roster-virus-4",
    "species": [
      "bacteriophage",
      "influenza"
    ],
    "topic": "Body basics",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Virus"
    },
    "text": "What can surround the capsid of an enveloped virus?",
    "answers": [
      "Lipid envelope",
      "Hyphal wall",
      "Scolex"
    ],
    "correct": 0,
    "explanation": "Enveloped viruses possess a lipid-containing envelope."
  },
  {
    "id": "roster-virus-5",
    "species": [
      "bacteriophage",
      "influenza"
    ],
    "topic": "Ecology",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Virus"
    },
    "text": "Do all viruses infect the same host?",
    "answers": [
      "No; host ranges differ",
      "Yes; all infect every cell",
      "All infect only plants"
    ],
    "correct": 0,
    "explanation": "Viruses differ in host range and the cell types they can infect."
  },
  {
    "id": "roster-cestode-0",
    "species": [
      "pisiformis"
    ],
    "topic": "Body basics",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Cestode"
    },
    "text": "A tapeworm is a…",
    "answers": [
      "Flatworm",
      "Bacterium",
      "Virus"
    ],
    "correct": 0,
    "explanation": "Tapeworms are multicellular flatworms."
  },
  {
    "id": "roster-cestode-1",
    "species": [
      "pisiformis"
    ],
    "topic": "Appearance",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Cestode"
    },
    "text": "Tapeworm segments are called…",
    "answers": [
      "Proglottids",
      "Pseudopods",
      "Cilia"
    ],
    "correct": 0,
    "explanation": "Tapeworm bodies consist of segments called proglottids."
  },
  {
    "id": "roster-cestode-2",
    "species": [
      "pisiformis"
    ],
    "topic": "Body basics",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Cestode"
    },
    "text": "The attachment end of a tapeworm is its…",
    "answers": [
      "Scolex",
      "Flagellum",
      "Capsid"
    ],
    "correct": 0,
    "explanation": "The scolex bears attachment structures such as suckers."
  },
  {
    "id": "roster-cestode-3",
    "species": [
      "pisiformis"
    ],
    "topic": "Nutrition",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Cestode"
    },
    "text": "Tapeworms obtain nutrients mainly by…",
    "answers": [
      "Absorption through their surface",
      "Photosynthesis",
      "A complete mouth-to-anus gut"
    ],
    "correct": 0,
    "explanation": "Tapeworms lack a digestive tract and absorb nutrients through their surface."
  },
  {
    "id": "roster-cestode-4",
    "species": [
      "pisiformis"
    ],
    "topic": "Life cycle",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Cestode"
    },
    "text": "A definitive host contains a parasite's…",
    "answers": [
      "Sexually mature stage",
      "Bacterial spore",
      "Viral capsid"
    ],
    "correct": 0,
    "explanation": "Sexual maturity and reproduction occur in the definitive host."
  },
  {
    "id": "roster-cestode-5",
    "species": [
      "pisiformis"
    ],
    "topic": "Reproduction",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Cestode"
    },
    "text": "Tapeworms generally possess…",
    "answers": [
      "Male and female reproductive organs",
      "Only chloroplasts",
      "No reproductive structures"
    ],
    "correct": 0,
    "explanation": "Tapeworms generally have both male and female reproductive organs."
  },
  {
    "id": "roster-alcaligenes-feature",
    "species": [
      "alcaligenes"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Alcaligenes faecalis"
    },
    "text": "Which feature or association fits Alcaligenes faecalis?",
    "answers": [
      "Rod-shaped",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "A motile rod associated with soil and water."
  },
  {
    "id": "roster-cereus-feature",
    "species": [
      "cereus"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Bacillus cereus"
    },
    "text": "Which feature or association fits Bacillus cereus?",
    "answers": [
      "Endospores",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Bacillus cereus is a rod-shaped bacterium that can form endospores."
  },
  {
    "id": "roster-megaterium-feature",
    "species": [
      "megaterium"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Bacillus megaterium"
    },
    "text": "Which feature or association fits Bacillus megaterium?",
    "answers": [
      "Large rods",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Bacillus megaterium is a large rod-shaped soil bacterium."
  },
  {
    "id": "roster-aerogenes-feature",
    "species": [
      "aerogenes"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Klebsiella aerogenes"
    },
    "text": "Which feature or association fits Klebsiella aerogenes?",
    "answers": [
      "Rod-shaped",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Formerly Enterobacter aerogenes, Klebsiella aerogenes is a motile rod-shaped bacterium."
  },
  {
    "id": "roster-faecalis-feature",
    "species": [
      "faecalis"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Enterococcus faecalis"
    },
    "text": "Which feature or association fits Enterococcus faecalis?",
    "answers": [
      "Cocci in pairs or chains",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Enterococcus faecalis is a coccus often arranged in pairs or short chains."
  },
  {
    "id": "roster-ecoli-feature",
    "species": [
      "ecoli"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Escherichia coli"
    },
    "text": "Which feature or association fits Escherichia coli?",
    "answers": [
      "Rod-shaped",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Escherichia coli is a rod-shaped bacterium commonly found in intestines."
  },
  {
    "id": "roster-klebsiella-feature",
    "species": [
      "klebsiella"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Klebsiella pneumoniae"
    },
    "text": "Which feature or association fits Klebsiella pneumoniae?",
    "answers": [
      "Capsule",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Klebsiella pneumoniae is a nonmotile rod with a prominent capsule."
  },
  {
    "id": "roster-micrococcus-feature",
    "species": [
      "micrococcus"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Micrococcus luteus"
    },
    "text": "Which feature or association fits Micrococcus luteus?",
    "answers": [
      "Tetrads",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Micrococcus luteus forms cocci that commonly occur in tetrads."
  },
  {
    "id": "roster-mycobacterium-feature",
    "species": [
      "mycobacterium"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Mycobacterium smegmatis"
    },
    "text": "Which feature or association fits Mycobacterium smegmatis?",
    "answers": [
      "Acid-fast rods",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Mycobacterium smegmatis is a rod-shaped acid-fast bacterium with a mycolic-acid-rich envelope."
  },
  {
    "id": "roster-proteus-feature",
    "species": [
      "proteus"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Proteus vulgaris"
    },
    "text": "Which feature or association fits Proteus vulgaris?",
    "answers": [
      "Swarming growth",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Proteus vulgaris is a motile rod known for swarming growth."
  },
  {
    "id": "roster-pseudomonas-feature",
    "species": [
      "pseudomonas"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Pseudomonas aeruginosa"
    },
    "text": "Which feature or association fits Pseudomonas aeruginosa?",
    "answers": [
      "Moist environments",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Pseudomonas aeruginosa is a rod-shaped bacterium often associated with moist environments."
  },
  {
    "id": "roster-salmonella-feature",
    "species": [
      "salmonella"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Salmonella enterica serovar Typhimurium"
    },
    "text": "Which feature or association fits Salmonella enterica serovar Typhimurium?",
    "answers": [
      "Rod-shaped",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Salmonella Typhimurium is a rod-shaped bacterium associated with intestinal disease."
  },
  {
    "id": "roster-serratia-feature",
    "species": [
      "serratia"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Serratia marcescens"
    },
    "text": "Which feature or association fits Serratia marcescens?",
    "answers": [
      "Prodigiosin",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Some Serratia marcescens strains produce a red pigment called prodigiosin."
  },
  {
    "id": "roster-shigella-feature",
    "species": [
      "shigella"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Shigella dysenteriae"
    },
    "text": "Which feature or association fits Shigella dysenteriae?",
    "answers": [
      "Nonmotile rods",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Shigella dysenteriae is a nonmotile rod-shaped bacterium."
  },
  {
    "id": "roster-aureus-feature",
    "species": [
      "aureus"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Staphylococcus aureus"
    },
    "text": "Which feature or association fits Staphylococcus aureus?",
    "answers": [
      "Clusters of cocci",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Staphylococcus aureus commonly forms grape-like clusters of cocci."
  },
  {
    "id": "roster-epidermidis-feature",
    "species": [
      "epidermidis"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Staphylococcus epidermidis"
    },
    "text": "Which feature or association fits Staphylococcus epidermidis?",
    "answers": [
      "Skin",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Staphylococcus epidermidis is a common skin-associated coccus."
  },
  {
    "id": "roster-lactococcus-feature",
    "species": [
      "lactococcus"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Lactococcus lactis"
    },
    "text": "Which feature or association fits Lactococcus lactis?",
    "answers": [
      "Dairy fermentation",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Lactococcus lactis, formerly Streptococcus lactis, is used in dairy fermentation."
  },
  {
    "id": "roster-mitis-feature",
    "species": [
      "mitis"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Streptococcus mitis"
    },
    "text": "Which feature or association fits Streptococcus mitis?",
    "answers": [
      "Mouth",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Streptococcus mitis is a coccus associated with the mouth."
  },
  {
    "id": "roster-pyogenes-feature",
    "species": [
      "pyogenes"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Streptococcus pyogenes"
    },
    "text": "Which feature or association fits Streptococcus pyogenes?",
    "answers": [
      "Chains of cocci",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Streptococcus pyogenes commonly forms chains of cocci."
  },
  {
    "id": "roster-sarcina-feature",
    "species": [
      "sarcina"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Sarcina subflava"
    },
    "text": "Which feature or association fits Sarcina subflava?",
    "answers": [
      "Cubical packets",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "The Sarcina body arrangement consists of cubical packets of cocci."
  },
  {
    "id": "roster-sporogenes-feature",
    "species": [
      "sporogenes"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Clostridium sporogenes"
    },
    "text": "Which feature or association fits Clostridium sporogenes?",
    "answers": [
      "Anaerobic spore-forming rods",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Clostridium sporogenes is an anaerobic rod-shaped endospore-forming bacterium."
  },
  {
    "id": "roster-rhizopus-feature",
    "species": [
      "rhizopus"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Rhizopus nigricans"
    },
    "text": "Which feature or association fits Rhizopus nigricans?",
    "answers": [
      "Sporangia",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Rhizopus produces asexual sporangiospores inside sporangia; the name R. nigricans is commonly treated as R. stolonifer."
  },
  {
    "id": "roster-mucor-feature",
    "species": [
      "mucor"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Mucor"
    },
    "text": "Which feature or association fits Mucor?",
    "answers": [
      "Sporangia",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Mucor produces sporangia and generally lacks the rhizoids typical of Rhizopus."
  },
  {
    "id": "roster-aspergillus-feature",
    "species": [
      "aspergillus"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Aspergillus niger"
    },
    "text": "Which feature or association fits Aspergillus niger?",
    "answers": [
      "Conidia",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Aspergillus niger forms dark conidial heads bearing asexual conidia."
  },
  {
    "id": "roster-penicillium-feature",
    "species": [
      "penicillium"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Penicillium notatum"
    },
    "text": "Which feature or association fits Penicillium notatum?",
    "answers": [
      "Brush-like conidiophores",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Penicillium has brush-like conidiophores bearing chains of conidia."
  },
  {
    "id": "roster-peziza-feature",
    "species": [
      "peziza"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Peziza"
    },
    "text": "Which feature or association fits Peziza?",
    "answers": [
      "Cup-shaped fruiting body",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Peziza forms cup-shaped fruiting bodies with asci containing ascospores."
  },
  {
    "id": "roster-coprinus-feature",
    "species": [
      "coprinus"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Coprinus"
    },
    "text": "Which feature or association fits Coprinus?",
    "answers": [
      "Basidiospores",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Coprinus mushrooms produce basidiospores on basidia."
  },
  {
    "id": "roster-saccharomyces-feature",
    "species": [
      "saccharomyces"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Saccharomyces cerevisiae"
    },
    "text": "Which feature or association fits Saccharomyces cerevisiae?",
    "answers": [
      "Budding yeast",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Saccharomyces cerevisiae is a budding yeast used in baking and fermentation."
  },
  {
    "id": "roster-cryptococcus-feature",
    "species": [
      "cryptococcus"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Cryptococcus neoformans"
    },
    "text": "Which feature or association fits Cryptococcus neoformans?",
    "answers": [
      "Capsule",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Cryptococcus neoformans is an encapsulated budding yeast."
  },
  {
    "id": "roster-candida-feature",
    "species": [
      "candida"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Candida albicans"
    },
    "text": "Which feature or association fits Candida albicans?",
    "answers": [
      "Yeast and filamentous forms",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Candida albicans can grow as budding yeast, pseudohyphae, and true hyphae."
  },
  {
    "id": "roster-pseudotropicalis-feature",
    "species": [
      "pseudotropicalis"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Candida pseudotropicalis"
    },
    "text": "Which feature or association fits Candida pseudotropicalis?",
    "answers": [
      "Budding yeast",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Candida pseudotropicalis is an older name associated with Kluyveromyces marxianus, a budding yeast."
  },
  {
    "id": "roster-pisiformis-feature",
    "species": [
      "pisiformis"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Taenia pisiformis"
    },
    "text": "Which feature or association fits Taenia pisiformis?",
    "answers": [
      "Rabbits or hares",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Taenia pisiformis cycles between canids as definitive hosts and rabbits or hares as intermediate hosts."
  },
  {
    "id": "roster-trichinella-feature",
    "species": [
      "trichinella"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Trichinella spiralis"
    },
    "text": "Which feature or association fits Trichinella spiralis?",
    "answers": [
      "Skeletal muscle",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Trichinella spiralis larvae can occupy nurse cells in skeletal muscle."
  },
  {
    "id": "roster-bacteriophage-feature",
    "species": [
      "bacteriophage"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Bacteriophage"
    },
    "text": "Which feature or association fits Bacteriophage?",
    "answers": [
      "Bacteria",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Bacteriophages are viruses that infect bacteria."
  },
  {
    "id": "roster-influenza-feature",
    "species": [
      "influenza"
    ],
    "topic": "Identification",
    "source": {
      "file": "Microbemon roster biology review",
      "section": "Influenza virus"
    },
    "text": "Which feature or association fits Influenza virus?",
    "answers": [
      "RNA",
      "Tapeworm proglottids",
      "Photosynthetic leaves"
    ],
    "correct": 0,
    "explanation": "Influenza viruses are enveloped RNA viruses associated with respiratory infection."
  }
]);
export const questionsForSpecies = id => BATTLE_QUESTIONS.filter(question => question.species.includes(id));
export function microbeBasics(id) {
    const questions = questionsForSpecies(id);
    const ordered = [...questions].sort((a, b) => a.species.length - b.species.length || Number(b.topic === 'Movement') - Number(a.topic === 'Movement'));
    return [...new Set(ordered.map(q => q.explanation))].slice(0, 3);
}

