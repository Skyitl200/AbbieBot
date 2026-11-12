// Keep the source wording for provenance, but don't print an ordering answer
// as a "Start with ..." instruction on the student's question card.
export function displayedQuestionPrompt(question) {
    if (question.type !== 'ordering') return question.question;
    let prompt = question.question
        .replace(/\.\s*Start\s+(?:with|at)\s+.*$/i, '.')
        .replace(/,\s*(?:starting|beginning)\s+(?:with|at)\s+.*$/i, '.');
    // Some prompts also repeat the first selected entry in a "from X toward Y"
    // clause. Keep the destination/direction without spelling out that entry.
    const first = question.options?.[question.correct?.[0]];
    if (first) {
        const escaped = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        prompt = prompt.replace(new RegExp(`\\bfrom\\s+(?:the\\s+)?${escaped}(?=\\s+(?:toward|to)\\b)\\s*`, 'i'), '');
    }
    return prompt;
}
