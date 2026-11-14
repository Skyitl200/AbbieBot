import { BACTERIA, BACTERIA_IDS } from './bacteria.js';

const basicsSource = {
    kind: 'general-knowledge', title: 'OpenStax Microbiology: Unique Characteristics of Prokaryotic Cells',
    url: 'https://openstax.org/books/microbiology/pages/3-3-unique-characteristics-of-prokaryotic-cells',
};
const specificReferences = {
    'alcaligenes-faecalis': ['Alcaligenes faecalis descriptive study', 'https://pubmed.ncbi.nlm.nih.gov/9354352/'],
    'bacillus-megaterium': ['Bacillus megaterium descriptive study', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7053513/'],
    'micrococcus-luteus': ['BacDive: Micrococcus luteus type strain', 'https://bacdive.dsmz.de/strain/7673'],
    'streptococcus-lactis': ['NLM MeSH: Lactococcus lactis', 'https://www.ncbi.nlm.nih.gov/mesh?Cmd=DetailsSearch&Db=mesh&Term=%22Lactococcus+lactis%22%5BMeSH+Terms%5D'],
    'streptococcus-mitis': ['Streptococcus mitis oral study', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC98734/'],
};
const speciesSource = species => specificReferences[species.id] ? {
    kind: 'general-knowledge', title: specificReferences[species.id][0], url: specificReferences[species.id][1],
} : ({
    kind: 'general-knowledge', title: `OpenStax Microbiology: ${species.stain === 'Gram-negative' ? 'Proteobacteria' : 'Gram-positive bacteria'}`,
    url: `https://openstax.org/books/microbiology/pages/${species.stain === 'Gram-negative' ? '4-2-proteobacteria' : '4-4-gram-positive-bacteria'}`,
});
const question = (id, topic, text, answers, explanation) => ({
    id: `bacteria-${id}`, species: BACTERIA_IDS, topic, text, answers, correct: 0,
    explanation, source: basicsSource,
});
const factChecks = [
    ['bacillus-cereus', 'Survival', 'Which resistant structure can Bacillus cereus form?', ['Endospores', 'Tapeworm eggs', 'Protozoan cysts']],
    ['klebsiella-pneumoniae', 'Cell basics', 'What structure can surround Klebsiella pneumoniae outside its cell wall?', ['A capsule', 'A membrane-bound nucleus', 'A scolex']],
    ['micrococcus-luteus', 'Appearance', 'Which pigment color is commonly associated with Micrococcus luteus?', ['Yellow', 'Blue-green', 'Red']],
    ['mycobacterium-smegmatis', 'Cell basics', 'Which lipids are characteristic of the Mycobacterium smegmatis cell envelope?', ['Mycolic acids', 'Chlorophyll molecules', 'Cellulose fibers']],
    ['proteus-vulgaris', 'Movement', 'Which structures can Proteus vulgaris use for movement?', ['Flagella', 'Pseudopods', 'Tapeworm segments']],
    ['pseudomonas-aeruginosa', 'Appearance', 'Which pigment colors can be associated with Pseudomonas aeruginosa?', ['Blue-green', 'Only bright red', 'Only yellow']],
    ['serratia-marcescens', 'Appearance', 'What is the red pigment produced by some Serratia marcescens strains called?', ['Prodigiosin', 'Chlorophyll', 'Melanin in every strain']],
    ['shigella-dysenteriae', 'Disease', 'Shigella dysenteriae is associated with which illness?', ['Bacterial dysentery', 'Malaria', 'Pinworm infection']],
    ['staphylococcus-aureus', 'Appearance', 'What cell arrangement is commonly associated with Staphylococcus aureus?', ['Grape-like clusters', 'Segmented ribbons', 'A single multicellular worm']],
    ['staphylococcus-epidermidis', 'Habitat', 'Where is Staphylococcus epidermidis commonly part of normal microbiota?', ['Human skin', 'Only inside red blood cells', 'Only inside tapeworm eggs']],
    ['streptococcus-lactis', 'Nutrition', 'Lactococcus lactis is associated with which food process?', ['Lactic acid fermentation in dairy foods', 'Photosynthesis in leaves', 'Making tapeworm segments']],
    ['streptococcus-mitis', 'Habitat', 'Streptococcus mitis is commonly associated with which microbiota?', ['The human mouth', 'Only hot volcanic vents', 'Only mosquito salivary glands']],
    ['streptococcus-pyogenes', 'Disease', 'Which illness can Streptococcus pyogenes cause?', ['Strep throat', 'Malaria', 'Giardiasis']],
    ['clostridium-sporogenes', 'Survival', 'Which statement fits Clostridium sporogenes?', ['It is an anaerobic endospore-forming bacterium', 'It is a photosynthetic tapeworm', 'It is a ciliate with a nucleus']],
];

export const BACTERIA_QUESTIONS = [
    question('cell', 'Cell basics', 'Bacteria are which type of cells?', ['Prokaryotic cells', 'Multicellular animal tissues', 'Eukaryotic cells with a nucleus'], 'Bacteria are prokaryotes: their DNA is not enclosed in a membrane-bound nucleus.'),
    question('dna', 'Cell basics', 'Where is the main bacterial chromosome located?', ['In the nucleoid region', 'Inside a membrane-bound nucleus', 'Inside a chloroplast'], 'The nucleoid is the region containing the main bacterial chromosome; it is not enclosed by a nuclear membrane.'),
    question('ribosomes', 'Cell basics', 'What do bacterial ribosomes make?', ['Proteins', 'Tapeworm segments', 'Cell nuclei'], 'Bacterial ribosomes synthesize proteins, just as ribosomes do in other cellular organisms.'),
    question('rod', 'Appearance', 'Which term describes a rod-shaped bacterial cell?', ['Bacillus', 'Coccus', 'Helminth'], 'The shape term bacillus means rod-shaped; a lowercase shape term is distinct from the genus Bacillus.'),
    question('coccus', 'Appearance', 'Which term describes a spherical bacterial cell?', ['Coccus', 'Bacillus', 'Tapeworm'], 'A coccus is a spherical bacterial cell; cocci is the plural form.'),
    question('membrane', 'Cell basics', 'What helps control substances entering and leaving a bacterial cell?', ['The plasma membrane', 'A scolex', 'A cell nucleus'], 'The plasma membrane forms a selective boundary between the cell and its surroundings.'),
    { ...question('fission', 'Reproduction', 'How do many bacteria reproduce?', ['Binary fission', 'Producing worm eggs', 'Forming tapeworm segments'], 'During binary fission a bacterial cell replicates its DNA and divides into two daughter cells.'), source: { kind: 'general-knowledge', title: 'OpenStax Microbiology: How Microbes Grow', url: 'https://openstax.org/books/microbiology/pages/9-1-how-microbes-grow' } },
    ...BACTERIA.filter(species => species.shape).map(species => ({
        id: `${species.id}-shape`, species: [species.id], topic: 'Appearance',
        text: `What basic cell shape is associated with ${species.name}?`,
        answers: species.shape === 'rod' ? ['Rod-shaped', 'Spherical', 'Segmented ribbon'] : ['Spherical', 'Rod-shaped', 'Segmented ribbon'],
        correct: 0, explanation: `${species.name} is ${species.shape === 'rod' ? 'rod-shaped (a bacillus)' : 'spherical (a coccus)'}. These are basic cell-shape descriptions, not an identification test.`,
        source: speciesSource(species),
    })),
    ...BACTERIA.filter(species => species.name !== species.textbookName).map(species => ({
        id: `${species.id}-name`, species: [species.id], topic: 'Names',
        text: `Which name does this collection use for the textbook label “${species.textbookName}”?`,
        answers: [species.name, 'Giardia lamblia', 'Taenia solium'], correct: 0,
        explanation: species.nameNote || `The textbook label ${species.textbookName} is retained as an alias; this collection displays ${species.name}.`,
        source: { kind: 'taxonomy-note', title: 'Textbook label and taxonomy cross-reference', url: `https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?name=${encodeURIComponent(species.name)}` },
    })),
    ...factChecks.map(([id, topic, text, answers]) => ({
        id: `${id}-fact`, species: [id], topic, text, answers, correct: 0,
        explanation: BACTERIA.find(species => species.id === id).fact,
        source: speciesSource(BACTERIA.find(species => species.id === id)),
    })),
];
