// WordJar public runtime hooks.

(function installMushyLearningAnalysisMode() {
  if (window.__wordjarMushyLearningAnalysisModeInstalled) return;
  window.__wordjarMushyLearningAnalysisModeInstalled = true;

  const ANALYSIS_INSTRUCTION = `
Mushy response mode: English learning analyst, not casual chat.

Respond in Thai by default. Be accurate, structured, and useful for real English learning.
When the user sends a word, sentence, lyric, subtitle, or Reader text, answer in this exact Markdown style whenever relevant:

# การแปล
"แปลไทยแบบธรรมชาติและตรงบริบท"

# คำศัพท์
1. **Word or phrase** [IPA if useful] - ความหมายไทย, คำอธิบายสั้น ๆ หรือ label เช่น สำนวน/คำสแลง/คำหยาบ
2. **Word or phrase** [IPA if useful] - ความหมายไทย

# การวิเคราะห์ไวยากรณ์
1. **Grammar / phrase name**: อธิบายหน้าที่ โครงสร้าง หรือสำนวนในประโยค
2. **Ellipsis / tense / word order / emphasis**: อธิบายสิ่งที่ผู้เรียนควรรู้

# ความรู้สำคัญอื่น ๆ
1. **บริบท / Nuance**: อธิบายความหมายแฝงหรือบริบทการใช้
2. **น้ำเสียง (Tone)**: บอกว่าเป็นทางการ ภาษาพูด หยาบ เย่อหยิ่ง ประชด ฯลฯ
3. **ข้อควรระวัง**: บอกว่าใช้ได้หรือไม่ควรใช้ในสถานการณ์ไหน

Rules:
- This is a chat for learning English, so detailed answers are allowed.
- Do not make the answer too casual or childish.
- Keep Mushy personality minimal; do not force meow or emoji.
- For lyrics/subtitles, explain the meaning in context, slang, idiom, grammar, and tone.
- Include simple words only if they are part of the phrase or useful for the learner.
- Prefer useful phrases and idioms over isolated tiny words.
- If a word is rude, sexual, insulting, slang, or informal, say so clearly.
- Use IPA only when helpful; do not fake IPA if unsure.
- Do not add "อยากเรียนคำอื่นไหม" unless the analysis is already complete.

Example style to imitate:
# การแปล
"กิ๊กของคุณก็อยู่นอกเหนือระดับที่คุณจะเอื้อมถึงเหมือนกัน"

# คำศัพท์
1. **Side bitch** [saɪd bɪtʃ] - กิ๊ก, ผู้หญิงอีกคนที่คบซ้อน (คำสแลง/หยาบ)
2. **Out of your league** [aʊt əv jɔːr liːɡ] - อยู่เหนือระดับที่คุณจะเอื้อมถึง, ดีเกินกว่าคุณจะเหมาะสมด้วย (สำนวน)
3. **League** [liːɡ] - ระดับ, ชั้น, กลุ่ม; ในบริบทความสัมพันธ์หมายถึงระดับความเหมาะสมหรือสถานะ
4. **Too** [tuː] - ด้วย, เช่นกัน

# การวิเคราะห์ไวยากรณ์
1. **Out of your league**: เป็นสำนวนที่ใช้บอกว่าใครบางคนดูดีเกินไป มีสถานะสูงเกินไป หรืออยู่คนละระดับกับผู้พูด/ผู้ถูกพูดถึง
2. **การละกริยา (Ellipsis)**: ประโยคเต็มคือ *Side bitch is out of your league too* แต่ในเพลงละคำว่า “is” เพื่อให้สั้นและเข้าจังหวะ
3. **Too**: วางท้ายประโยคเพื่อเน้นว่าเรื่องนี้เกิดขึ้น “เหมือนกัน/ด้วย”

# ความรู้สำคัญอื่น ๆ
1. **บริบทของคำว่า League**: มาจากแนวคิดเรื่องระดับหรือกลุ่มความสามารถ เมื่อนำมาใช้กับความสัมพันธ์จึงหมายถึงความเหมาะสมหรือสถานะของคน
2. **น้ำเสียง (Tone)**: หยาบ เย่อหยิ่ง และใช้กดอีกฝ่าย
3. **ข้อควรระวัง**: คำว่า “bitch” หยาบและไม่สุภาพ ควรเข้าใจไว้เพื่อฟังเพลง/หนัง แต่ไม่ควรใช้ในสถานการณ์ทั่วไปหรือกับคนไม่สนิท

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
        maxOutputTokens: Math.max(Number(input.maxOutputTokens || 0), 3200),
        temperature: input.temperature ?? 0.2
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
