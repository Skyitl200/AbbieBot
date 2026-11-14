// The roster is transcribed from the user's textbook photograph, not a culture guide.
// Descriptions/questions add general educational knowledge; see question provenance.
const roster = [
    ['alcaligenes-faecalis', 'Alcaligenes faecalis', 'Alcaligenes faecalis', 'common', 'rod', 'Gram-negative', 'Alcaligenes faecalis is a rod-shaped bacterium found in environmental habitats.'],
    ['bacillus-cereus', 'Bacillus cereus', 'Bacillus cereus', 'uncommon', 'rod', 'Gram-positive', 'Bacillus cereus is an endospore-forming bacterium; some strains cause foodborne illness.'],
    ['bacillus-megaterium', 'Priestia megaterium', 'Bacillus megaterium', 'common', 'rod', 'Gram-positive', 'Priestia megaterium, formerly Bacillus megaterium, is a large rod-shaped bacterium.'],
    ['enterobacter-aerogenes', 'Klebsiella aerogenes', 'Enterobacter aerogenes', 'uncommon', 'rod', 'Gram-negative', 'Klebsiella aerogenes is the current name for the bacterium historically called Enterobacter aerogenes.'],
    ['enterococcus-faecalis', 'Enterococcus faecalis', 'Enterobacter faecalis', 'uncommon', 'coccus', 'Gram-positive', 'Enterococcus faecalis is a spherical bacterium; the textbook roster prints Enterobacter faecalis in error.'],
    ['escherichia-coli', 'Escherichia coli', 'Escherichia coli', 'common', 'rod', 'Gram-negative', 'Many Escherichia coli strains live in the intestine without causing disease; some strains are pathogenic.'],
    ['klebsiella-pneumoniae', 'Klebsiella pneumoniae', 'Klebsiella pneumoniae', 'rare', 'rod', 'Gram-negative', 'Klebsiella pneumoniae can have a prominent capsule outside its cell wall.'],
    ['micrococcus-luteus', 'Micrococcus luteus', 'Micrococcus luteus', 'common', 'coccus', 'Gram-positive', 'Micrococcus luteus is a spherical bacterium often associated with yellow pigmentation.'],
    ['mycobacterium-smegmatis', 'Mycobacterium smegmatis', 'Mycobacterium smegmatis', 'rare', 'rod', 'Acid-fast', 'Mycobacterium smegmatis has a lipid-rich cell envelope containing mycolic acids.'],
    ['proteus-vulgaris', 'Proteus vulgaris', 'Proteus vulgaris', 'uncommon', 'rod', 'Gram-negative', 'Proteus vulgaris is a rod-shaped bacterium that can move using flagella.'],
    ['pseudomonas-aeruginosa', 'Pseudomonas aeruginosa', 'Pseudomonas aeruginosa', 'rare', 'rod', 'Gram-negative', 'Pseudomonas aeruginosa is an opportunistic pathogen that can produce blue-green pigments.'],
    ['salmonella-typhimurium', 'Salmonella enterica serovar Typhimurium', 'Salmonella typhimurium', 'rare', 'rod', 'Gram-negative', 'Typhimurium is a serovar of Salmonella enterica, rather than a separate species in current usage.'],
    ['serratia-marcescens', 'Serratia marcescens', 'Serratia marcescens', 'uncommon', 'rod', 'Gram-negative', 'Some Serratia marcescens strains produce a red pigment called prodigiosin.'],
    ['shigella-dysenteriae', 'Shigella dysenteriae', 'Shigella dysenteriae', 'rare', 'rod', 'Gram-negative', 'Shigella dysenteriae is a bacterial cause of dysentery.'],
    ['staphylococcus-aureus', 'Staphylococcus aureus', 'Staphylococcus aureus', 'rare', 'coccus', 'Gram-positive', 'Staphylococcus aureus commonly forms grape-like clusters of spherical cells.'],
    ['staphylococcus-epidermidis', 'Staphylococcus epidermidis', 'Staphylococcus epidermidis', 'common', 'coccus', 'Gram-positive', 'Staphylococcus epidermidis is commonly part of the normal human skin microbiota.'],
    ['streptococcus-lactis', 'Lactococcus lactis', 'Streptococcus lactis', 'common', 'coccus', 'Gram-positive', 'Lactococcus lactis, formerly Streptococcus lactis, is associated with lactic acid fermentation in dairy foods.'],
    ['streptococcus-mitis', 'Streptococcus mitis', 'Streptococcus mitis', 'uncommon', 'coccus', 'Gram-positive', 'Streptococcus mitis is commonly associated with the human oral microbiota.'],
    ['streptococcus-pyogenes', 'Streptococcus pyogenes', 'Streptococcus pyogenes', 'rare', 'coccus', 'Gram-positive', 'Streptococcus pyogenes is a group A streptococcus that can cause strep throat.'],
    ['sarcina-subflava', 'Sarcina subflava', 'Sarcina subflava', 'epic', null, null, 'Sarcina subflava is preserved as printed in the textbook roster; its modern taxonomic identity has not been verified.'],
    ['clostridium-sporogenes', 'Clostridium sporogenes', 'Clostridium sporogenes', 'epic', 'rod', 'Gram-positive', 'Clostridium sporogenes is an anaerobic, endospore-forming bacterium.']
];

export const BACTERIA = roster.map(([id, name, textbookName, tier, shape, stain, fact]) => ({
    id, name, textbookName, common: textbookName, tier, group: 'Bacterium', shape, stain, fact,
    aliases: [...new Set([textbookName, name])],
    question: `${textbookName} is listed in this collection as which kind of organism?`,
    answers: ['Bacterium', 'Tapeworm', 'Ciliate'], correct: 0,
    rosterSource: { kind: 'user-textbook-photo', label: 'User-provided textbook bacterial roster' },
    ...(id === 'enterococcus-faecalis' ? { nameNote: 'The printed Enterobacter faecalis is corrected to Enterococcus faecalis.' } : {}),
    ...(id === 'sarcina-subflava' ? { nameNote: 'Unverified legacy label; no species-specific morphology, Gram reaction, or disease claims are assigned.' } : {}),
}));

export const BACTERIA_IDS = BACTERIA.map(species => species.id);
