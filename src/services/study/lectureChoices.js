// Lecture-only choice preparation. All biology statements come from the existing
// source-linked banks; no generic filler or unrelated-topic answer pool is used.
const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const stop = new Set('the a an of in to and is for with from by at its it that this which what does has are can on or as be not through normal normally system process structure'.split(' '));
const tokens = value => new Set(normalize(value).split(' ').filter(word => word.length > 2 && !stop.has(word)));
const overlap = (a, b) => [...a].reduce((sum, word) => sum + (b.has(word) ? 1 : 0), 0);
const correctText = q => q.options[q.correct[0]];
const reviewedPeerGroups = [
    ['Anatomy', 'Physiology', 'Histology', 'Cytology', 'Embryology', 'Pathology'],
    ['Matter', 'Energy', 'Heat', 'Temperature', 'Kinetic energy', 'Potential energy', 'Work'],
    ['Mediastinum', 'Pericardial cavity', 'Pleural cavity', 'Thoracic cavity', 'Abdominopelvic cavity'],
    ['Central nervous system', 'Peripheral nervous system', 'Sensory afferent division', 'Somatic motor division', 'Autonomic motor division', 'Enteric nervous system'],
    ['Right atrium', 'Left atrium', 'Right ventricle', 'Left ventricle'],
    ['Tricuspid valve', 'Mitral valve', 'Pulmonary valve', 'Aortic valve'],
    ['Sodium', 'Potassium', 'Calcium', 'Chloride', 'Bicarbonate', 'Magnesium', 'Phosphate'],
    ['Primary protein structure', 'Secondary protein structure', 'Tertiary protein structure', 'Quaternary protein structure'],
    ['Neutrophil', 'Eosinophil', 'Basophil', 'Monocyte', 'Lymphocyte'],
    ['IgG', 'IgM', 'IgA', 'IgE', 'IgD'],
    ['Alpha-1', 'Alpha-2', 'Beta-1', 'Beta-2', 'Beta-3', 'M2', 'M3'],
];
const familyPatterns = [
    /arter|vein|capillar|venule|vascular|vessel|aorta/,
    /duct|lymphatic trunk|cisterna|venous angle/,
    /cavity|space|mediastin|ventricle|canal|sinus/,
    /layer|epitheli|epiderm|derm|stratum|membrane|pericardi|endocardi|myocardi|mening|dura|arachnoid|pia mater/,
    /neuron|glia|astrocyte|oligodendro|schwann|microglia|ependym|satellite cell/,
    /receptor|adrenergic|muscarinic|nicotinic|alpha|beta/,
    /hormone|insulin|glucagon|cortisol|aldosterone|thyroxin|thyroid|calcitonin|parathyroid|prolactin|oxytocin|vasopressin|somatotropin/,
    /gland|pituitary|adrenal|pancrea|hypothalam|pineal/,
    /erythro|leuko|neutroph|eosinoph|basoph|monocyte|lymphocyte|platelet|megakaryocyte/,
    /bone|osteon|osteocyte|osteoblast|osteoclast|cartilage|chondro|perioste|endoste/,
    /joint|synovial|suture|syndesmos|gomphos|symphys|synchondros/,
    /tendon|ligament|muscle|myofibril|sarco|actin|myosin|fascicle/,
    /filament|fiber|collagen|elastin|reticular/,
    /immune|antigen|antibody|immunoglobulin|lymphocyte|t cell|b cell|complement|cytokine/,
    /ion|sodium|potassium|calcium|chloride|hydrogen|bicarbonate|phosphate|magnesium/,
    /bond|hydrolys|synthesis|oxidation|reduction|reaction|catalys/,
    /protein|peptide|amino|enzyme|lipid|fatty acid|triglyceride|carbohydrate|glucose|glycogen|nucleic|nucleotide/,
    /organelle|ribosome|reticulum|golgi|mitochond|lysosome|peroxisome|nucleus|cytosol/,
    /mitosis|meiosis|prophase|metaphase|anaphase|telophase|interphase|cytokinesis/,
    /respirat|ventilat|inhal|exhal|inspir|expir|volume|capacity/,
    /acidosis|alkalosis|hyper|hypo|stenosis|regurgitation|ischemi|infarct|edema|asplenia/,
];
function families(term) { return familyPatterns.flatMap((pattern, i) => pattern.test(term.toLowerCase()) ? [i] : []); }
function choiceSimilarity(value, reference) {
    const a = tokens(value), b = tokens(reference);
    return overlap(a, b) / Math.sqrt(Math.max(1, a.size * b.size));
}
function wrongChoice(q) {
    return q.options.filter((_, i) => i !== q.correct[0]).map((value, index) => ({ value, index,
        score: choiceSimilarity(value, correctText(q)) - (/\b(?:every|all|always|never|completely|only)\b/i.test(value) ? .12 : 0),
    })).sort((a, b) => b.score - a.score || a.index - b.index)[0].value;
}

export function buildLectureChoiceContext(banks) {
    const contexts = new Map();
    const globalTerms = new Map(), globalCatalog = new Map();
    for (const [, questions] of banks) for (const q of questions) {
        if (q.type !== 'multiple_choice') continue;
        for (const [i, term] of q.options.entries()) {
            const key = normalize(term), isCorrect = q.correct.includes(i);
            if (!globalTerms.has(key) || (isCorrect && !globalTerms.get(key).isCorrect)) globalTerms.set(key, { key, term, isCorrect, sourceId: q.id, sourceFile: q.source.file, slides: q.source.slides });
        }
    }
    for (const [topicId, questions] of banks) {
        const multiple = questions.filter(q => q.type === 'multiple_choice');
        const catalog = new Map();
        for (const q of multiple) {
            const answer = correctText(q);
            const colon = q.explanation.indexOf(':');
            if (colon < 1 || normalize(q.explanation.slice(0, colon)) !== normalize(answer) || answer.length > 100) continue;
            const definition = q.explanation.slice(colon + 1).trim().split(/\.\s+(?=[A-Z])/)[0].replace(/\.$/, '');
            if (definition.length < 8 || definition.length > 320) continue;
            const key = normalize(answer);
            if (!catalog.has(key)) catalog.set(key, { key, term: answer, definition, sourceId: q.id, sourceFile: q.source.file,
                slides: q.source.slides, words: tokens(answer + ' ' + definition), families: families(answer), aliases: new Set([key]),
            });
        }
        for (const q of questions) {
            if (q.type !== 'fill_blank') continue;
            for (const entry of catalog.values()) {
                if (q.answers.some(answer => normalize(answer) === entry.key)) {
                    for (const answer of q.answers) entry.aliases.add(normalize(answer));
                }
            }
        }
        const records = multiple.map(q => ({ q, words: tokens(q.question + ' ' + q.explanation), explanationWords: tokens(q.explanation), answerKey: normalize(correctText(q)), slides: new Set(q.source?.slides || []) }));
        for (const [key, entry] of catalog) if (!globalCatalog.has(key)) globalCatalog.set(key, entry);
        contexts.set(topicId, { multiple, records, catalog, peers: new Map(), companions: new Map() });
    }
    for (const context of contexts.values()) { context.globalTerms = globalTerms; context.globalCatalog = globalCatalog; }
    return contexts;
}

function peersFor(context, entry) {
    const group = reviewedPeerGroups.find(group => group.some(term => normalize(term) === entry.key));
    if (group) {
        const peers = group.map(term => context.catalog.get(normalize(term)) || context.globalCatalog.get(normalize(term))).filter(other => other && other.key !== entry.key && !entry.aliases.has(other.key) && !other.aliases.has(entry.key));
        if (peers.length >= 3) return peers.slice(0, 4);
    }
    if (context.peers.has(entry.key)) return context.peers.get(entry.key);
    const unique = new Set([normalize(entry.definition)]);
    const candidates = [...context.catalog.values()].filter(other => other.key !== entry.key && !entry.aliases.has(other.key) && !other.aliases.has(entry.key) &&
        !entry.key.includes(other.key + ' ') && !other.key.includes(entry.key + ' ')).map(other => ({ other,
        score: overlap(entry.words, other.words) / Math.sqrt(Math.max(1, entry.words.size * other.words.size)) +
            .65 * overlap(new Set(entry.families), new Set(other.families)),
    })).sort((a, b) => b.score - a.score || a.other.term.localeCompare(b.other.term));
    const peers = [];
    for (const { other, score } of candidates) {
        if (score < .12) continue;
        const definitionKey = normalize(other.definition);
        if (unique.has(definitionKey)) continue;
        unique.add(definitionKey); peers.push(other);
        if (peers.length === 4) break;
    }
    context.peers.set(entry.key, peers);
    return peers;
}
function companionFor(context, question) {
    if (context.companions.has(question.id)) return context.companions.get(question.id);
    const own = tokens(question.question + ' ' + question.explanation), explanationWords = tokens(question.explanation), answerKey = normalize(correctText(question)), slides = new Set(question.source?.slides || []);
    const candidates = context.records.filter(({ q, answerKey: otherKey }) => q.id !== question.id && q.question !== question.question && otherKey !== answerKey && !/\b(?:shown|figure|diagram|image|arrow|photograph)\b/i.test(q.question));
    let best, bestScore = -Infinity;
    for (const { q, words, explanationWords: otherExplanationWords, slides: otherSlides } of candidates) {
        const common = overlap(own, words);
        const sharedSlides = overlap(slides, otherSlides);
        const score = 5 * overlap(explanationWords, otherExplanationWords) / Math.sqrt(Math.max(1, explanationWords.size * otherExplanationWords.size)) + common / Math.sqrt(Math.max(1, own.size * words.size)) +
            .25 * sharedSlides / Math.max(1, slides.size, otherSlides.size);
        if (score > bestScore) { bestScore = score; best = q; }
    }
    // Only synthetic/isolated banks lack a distinct companion. Real lecture
    // banks are exhaustively checked to ensure companions are different items.
    const result = best || context.multiple.find(q => q.id !== question.id) || question;
    context.companions.set(question.id, result);
    return result;
}

export function prepareLectureChoice(question, contexts, topicId) {
    if (question.type !== 'multiple_choice') return question;
    const context = contexts.get(topicId);
    if (!context) throw new Error('Missing lecture choice context');
    const answer = correctText(question), direct = context.catalog.get(normalize(answer));
    const reviewedGroup = reviewedPeerGroups.find(group => group.some(term => normalize(term) === normalize(answer)));
    if (reviewedGroup && /\bterm\b|\bmeans\b|\bdescription\b|\bprimarily studies\b|\bfield\b/i.test(question.question)) {
        const records = reviewedGroup.map(term => context.globalTerms.get(normalize(term))).filter(Boolean);
        const own = records.find(record => record.key === normalize(answer));
        const others = records.filter(record => record !== own).slice(0, 4);
        if (own && others.length >= 3) {
            const choices = [own, ...others];
            return { ...question, options: choices.map(record => record.term), correct: [0],
                lectureChoice: { strategy: 'related_terms', topicId, concept: own.term, sourceId: own.sourceId,
                    optionConcepts: choices.map(record => record.term), sourceIds: choices.map(record => record.sourceId) } };
        }
    }
    const colon = question.explanation.indexOf(':');
    const explained = colon > 0 ? context.catalog.get(normalize(question.explanation.slice(0, colon))) : null;
    const isTermPrompt = /\bterm\b|\bmeans\b|\bdescription\b|\bbest fits\b|\bidentif/i.test(question.question);
    const isFactPrompt = /^Which (?:statement|fact)\b|^Which .*statement about\b|^Which .*correctly describes\b/i.test(question.question);
    const entry = (direct && isTermPrompt ? direct : null) || (explained && isFactPrompt ? explained : null);
    const peers = entry ? peersFor(context, entry) : [];
    if (entry && peers.length >= 3) {
        const records = [entry, ...peers];
        const termMode = entry === direct && isTermPrompt;
        const options = records.map(record => termMode ? record.term : record.definition[0].toUpperCase() + record.definition.slice(1));
        return { ...question,
            question: termMode ? question.question : `${question.question}\n\nChoose the most specific defining description of ${entry.term}.`,
            options, correct: [0],
            source: { ...question.source, slides: [...new Set([...question.source.slides, ...(entry.sourceFile === question.source.file ? entry.slides : [])])] },
            lectureChoice: { strategy: termMode ? 'related_terms' : 'related_definitions', topicId,
                concept: entry.term, sourceId: entry.sourceId,
                optionConcepts: records.map(record => record.term), sourceIds: records.map(record => record.sourceId),
            },
        };
    }

    // Four combinations of two source-linked checks give a short-choice item a
    // full set of meaningful alternatives. Each wrong choice fails at least one
    // actual concept; no invented biological claims or "all of the above" filler.
    const companion = companionFor(context, question);
    const primaryAnswers = [answer, wrongChoice(question)];
    const secondaryAnswers = [correctText(companion), wrongChoice(companion)];
    const parts = [[0, 0], [0, 1], [1, 0], [1, 1]];
    return { ...question,
        difficulty: question.difficulty === 'easy' ? 'medium' : question.difficulty,
        question: `Answer both related checks.\n\n1. ${question.question}\n\n2. ${companion.question}\n\nChoose the answers in that order.`,
        options: parts.map(([a, b]) => `${primaryAnswers[a]} | ${secondaryAnswers[b]}`), correct: [0],
        explanation: `1. ${question.explanation}\n\n2. ${companion.explanation}`,
        source: { ...question.source, slides: [...new Set([...question.source.slides, ...companion.source.slides])] },
        lectureChoice: { strategy: 'related_checks', topicId, primaryId: question.id, secondaryId: companion.id,
            primaryAnswers, secondaryAnswers, parts,
        },
    };
}
