import { BACTERIA } from './bacteria.js';
// Game rarity is a balancing choice, not real-world prevalence or severity.
const entry = (id, name, common, tier, group, fact, question, answers, correct = 0) =>
    ({ id, name, common, tier, group, fact, question, answers, correct });
export const SPECIES = [
    entry('amoeba', 'Amoeba', 'Amoeba', 'common', 'Amoeboid protist', 'Amoebas extend pseudopods to move and engulf food.', 'What helps an amoeba move?', ['Pseudopods', 'Wings', 'Roots']),
    entry('paramecium', 'Paramecium', 'Slipper ciliate', 'common', 'Ciliate', 'Paramecium uses many short cilia for movement.', 'Paramecium moves using…', ['Cilia', 'Legs', 'Hooks']),
    entry('enterobius', 'Enterobius vermicularis', 'Pinworm', 'common', 'Nematode', 'Pinworm eggs are deposited around the anus, often at night.', 'Which organism is called a pinworm?', ['Enterobius vermicularis', 'Taenia solium', 'Giardia lamblia']),
    entry('ascaris', 'Ascaris lumbricoides', 'Intestinal roundworm', 'common', 'Nematode', 'Ascaris infection follows ingestion of infective eggs; adults live in the small intestine.', 'Ascaris belongs to which worm group?', ['Roundworms', 'Tapeworms', 'Flukes']),
    entry('stentor', 'Stentor', 'Trumpet ciliate', 'uncommon', 'Ciliate', 'Stentor is a trumpet-shaped freshwater ciliate.', 'Stentor is often shaped like a…', ['Trumpet', 'Cube', 'Star']),
    entry('vorticella', 'Vorticella', 'Bell ciliate', 'uncommon', 'Ciliate', 'Vorticella has a bell-shaped body and a contractile stalk.', 'Which feature fits Vorticella?', ['Bell-shaped body on a stalk', 'Segmented ribbon body', 'Four legs']),
    entry('giardia', 'Giardia lamblia', 'Giardia', 'uncommon', 'Flagellated protist', 'Giardia has flagella and a cyst stage; infection can follow swallowing contaminated water.', 'Giardia moves using…', ['Flagella', 'Cilia', 'Feet']),
    entry('necator', 'Necator americanus', 'Hookworm', 'uncommon', 'Nematode', 'Infective hookworm larvae can penetrate skin exposed to contaminated soil.', 'Hookworm larvae can enter through…', ['Skin', 'Hair shafts only', 'Sound waves']),
    entry('solium', 'Taenia solium', 'Pork tapeworm', 'rare', 'Cestode', 'The pork tapeworm has a scolex with four suckers and an armed rostellum with hooks.', 'Which tapeworm has hooks on its scolex?', ['Taenia solium', 'Taenia saginata', 'Neither']),
    entry('saginata', 'Taenia saginata', 'Beef tapeworm', 'rare', 'Cestode', 'The beef tapeworm has four suckers and no rostellar hooks.', 'The beef tapeworm scolex has…', ['Four suckers without hooks', 'Cilia all over', 'Wings']),
    entry('entamoeba', 'Entamoeba histolytica', 'Dysentery amoeba', 'rare', 'Amoeboid protist', 'Entamoeba histolytica moves using pseudopods and can cause amoebic dysentery.', 'Entamoeba histolytica can cause…', ['Amoebic dysentery', 'Malaria', 'Influenza']),
    entry('balantidium', 'Balantidium coli', 'Intestinal ciliate', 'rare', 'Ciliate', 'Balantidium coli is a ciliated intestinal parasite; its cysts can spread by contaminated food or water.', 'Balantidium coli is a…', ['Ciliate', 'Tapeworm', 'Bacterium']),
    entry('fasciola', 'Fasciola hepatica', 'Liver fluke', 'epic', 'Trematode', 'Fasciola hepatica is a liver fluke; infection can follow eating contaminated aquatic plants.', 'Fasciola hepatica is known as the…', ['Liver fluke', 'Pinworm', 'Beef tapeworm']),
    entry('fasciolopsis', 'Fasciolopsis buski', 'Intestinal fluke', 'epic', 'Trematode', 'Fasciolopsis buski is a large intestinal fluke associated with contaminated aquatic plants.', 'Fasciolopsis buski is an intestinal…', ['Fluke', 'Ciliate', 'Amoeba']),
    entry('paragonimus', 'Paragonimus westermani', 'Lung fluke', 'epic', 'Trematode', 'Paragonimus westermani is a lung fluke associated with eating infected undercooked crab or crayfish.', 'Which food can transmit Paragonimus?', ['Undercooked crab or crayfish', 'Properly cooked rice', 'Pasteurized milk']),
    entry('trypanosoma', 'Trypanosoma brucei gambiense', 'Sleeping sickness parasite', 'epic', 'Flagellated protist', 'Trypanosoma brucei gambiense is transmitted by tsetse flies and causes African sleeping sickness.', 'Which insect transmits this parasite?', ['Tsetse fly', 'Flea', 'Housefly']),
    entry('toxoplasma', 'Toxoplasma gondii', 'Toxoplasma', 'epic', 'Apicomplexan', 'Toxoplasma gondii is an apicomplexan parasite that forms tissue cysts.', 'Toxoplasma gondii can form…', ['Tissue cysts', 'Tapeworm segments', 'Bacterial spores']),
    entry('plasmodium', 'Plasmodium vivax', 'Malaria parasite', 'epic', 'Apicomplexan', 'Plasmodium vivax causes malaria and has stages within red blood cells.', 'Plasmodium vivax causes…', ['Malaria', 'Pinworm infection', 'Giardiasis']),
    entry('schistosoma', 'Schistosoma', 'Blood fluke', 'epic', 'Trematode', 'Schistosoma blood flukes have separate male and female worms, unlike most other flukes.', 'Schistosoma adults have…', ['Separate sexes', 'No reproductive organs', 'Cilia for movement']),
    ...BACTERIA
];
export const TIERS = [{ name: 'common', weight: 55 }, { name: 'uncommon', weight: 30 }, { name: 'rare', weight: 12 }, { name: 'epic', weight: 3 }];
export const speciesById = id => SPECIES.find(species => species.id === id);
