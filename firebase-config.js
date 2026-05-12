// WordJar public runtime hooks.

(function installMushyLearningAnalysisMode() {
  if (window.__wordjarMushyLearningAnalysisModeInstalled) return;
  window.__wordjarMushyLearningAnalysisModeInstalled = true;

  const ANALYSIS_INSTRUCTION = `
Mushy response mode: English learning analyst, not casual chat.

Respond in Thai by default. Be smart and useful, not just cute.
If the user sends a word, sentence, lyric, subtitle, or Reader text, give a structured language-learning breakdown.
Long answers are allowed in Mushy chat when analysis is useful.

Use this structure when relevant:
1. การแปลแบบธรรมชาติ
2. ความหมายจริงในบริบท
3. คำศัพท์ / วลีสำคัญ
4. ไวยากรณ์หรือโครงสร้างประโยค
5. น้ำเสียง / ความสุภาพ / slang / คำหยาบ
6. Suggested flashcards

Rules:
- Prioritize idioms, slang, phrasal verbs, collocations, nuance, and grammar patterns.
- Do not waste space on very basic words like your, the, a, is unless the learner specifically asks or the level is A1.
- If the text is from lyrics/subtitles, explain the meaning in context and mark slang/rude/informal usage clearly.
- Keep Mushy personality minimal. Do not end every answer with meow.
- Avoid filler like “อยากเรียนคำอื่นไหม” until the analysis is complete.
- Suggested flashcards must be short, ready to save, and useful for WordJar.

User's actual message follows:
`;

  function shouldUseLearningMode(input = {}) {
    const task = String(input.task || 'chat');
    const text = `${input.question || ''} ${input.contextText || ''}`.trim();
    if (!text) return false;
    return task === 'reader' || task === 'deck' || task === 'chat';
  }

  function patchMushyAI() {
    const ai = window.WordJarMushyAI;
    if (!ai || typeof ai.ask !== 'function' || ai.__learningAnalysisPatched) return false;

    const originalAsk = ai.ask.bind(ai);

    ai.ask = function askWithLearningAnalysis(input = {}) {
      if (!shouldUseLearningMode(input)) return originalAsk(input);

      const originalQuestion = String(input.question || input.message || '').trim();
      const question = originalQuestion.startsWith('Mushy response mode:')
        ? originalQuestion
        : `${ANALYSIS_INSTRUCTION}${originalQuestion}`;

      return originalAsk({
        ...input,
        question,
        preferSmart: true,
        maxOutputTokens: Math.max(Number(input.maxOutputTokens || 0), 2600),
        temperature: input.temperature ?? 0.25
      });
    };

    ai.__learningAnalysisPatched = true;
    return true;
  }

  if (patchMushyAI()) return;

  const timer = setInterval(() => {
    if (patchMushyAI()) clearInterval(timer);
  }, 120);

  setTimeout(() => clearInterval(timer), 12000);
})();
