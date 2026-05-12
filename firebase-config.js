// WordJar public runtime hooks.

(function installWordJarPlainAnalysisMode() {
  if (window.__wordjarPlainAnalysisModeInstalled) return;
  window.__wordjarPlainAnalysisModeInstalled = true;

  const GUIDE = `
You are an English learning analyst inside WordJar.
Do not use a mascot persona. Do not use cat wording. Do not add cute filler.
Respond in Thai by default.

Output style:
- Plain text only.
- No Markdown symbols: no #, no **bold**, no bullet star, no nested bullets.
- Avoid long numbered lists. Use short lines and short paragraphs.
- Use section names as plain text headings only.
- Insert ONE blank line after every section heading.
- Insert ONE blank line between every major paragraph or vocabulary group.
- Keep examples inline and brief.

For a word, phrase, subtitle, lyric, or Reader text, use this format exactly, including blank lines:

การแปล

แปลไทยแบบธรรมชาติและตรงบริบท 1-2 ประโยค

ความหมายในบริบท

อธิบายว่าข้อความนี้สื่ออะไรจริง ๆ เป็นย่อหน้าเดียว

คำศัพท์และวลีสำคัญ

คำหรือวลี [IPA ถ้ามั่นใจ] = ความหมายไทย สั้น ๆ พร้อม label ถ้าจำเป็น เช่น idiom, slang, informal
คำหรือวลี = ความหมายไทย

ไวยากรณ์

อธิบายโครงสร้างสำคัญเป็นย่อหน้า ไม่แตก list ยาว ถ้ามีการละคำ ให้บอกประโยคเต็ม

น้ำเสียงและข้อควรระวัง

อธิบาย tone, register, warning และสถานการณ์ที่ควรหรือไม่ควรใช้

Flashcards ที่ควรเก็บ

เลือกเฉพาะคำหรือวลีที่มีค่าต่อการเรียน 2-5 รายการ ใช้บรรทัดละหนึ่งรายการ ไม่ต้องใส่เลข

Rules:
- Do not use Markdown formatting.
- Do not use numbered vocabulary lists unless the user asks.
- Do not explain tiny basic words unless they are part of a useful phrase.
- Prefer idioms, collocations, phrase patterns, tone, and nuance.
- Do not add follow-up filler questions.
- Do not over-format.

User message:
`;

  const SECTION_NAMES = [
    'การแปล',
    'ความหมายในบริบท',
    'คำศัพท์และวลีสำคัญ',
    'ไวยากรณ์',
    'น้ำเสียงและข้อควรระวัง',
    'Flashcards ที่ควรเก็บ'
  ];

  function patchMushyAI() {
    const ai = window.WordJarMushyAI;
    if (!ai || typeof ai.ask !== 'function' || ai.__plainAnalysisPatched) return false;

    const originalAsk = ai.ask.bind(ai);
    ai.ask = function askPlainAnalysis(input = {}) {
      const raw = String(input.question || input.message || '').trim();
      return originalAsk({
        ...input,
        question: `${GUIDE}${raw}`,
        preferSmart: true,
        maxOutputTokens: 2600,
        temperature: 0.12
      });
    };

    ai.__plainAnalysisPatched = true;
    return true;
  }

  function escapeText(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function splitMushySections(text) {
    const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const escapedNames = SECTION_NAMES.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const headingPattern = new RegExp(`(^|\\n)(${escapedNames.join('|')})(?=\\n|$)`, 'g');
    const matches = [...normalized.matchAll(headingPattern)];
    if (!matches.length) return [{ title: '', body: normalized }];

    return matches.map((match, index) => {
      const title = match[2];
      const bodyStart = match.index + match[0].length;
      const bodyEnd = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
      return { title, body: normalized.slice(bodyStart, bodyEnd).trim() };
    }).filter(section => section.title || section.body);
  }

  function renderSectionBody(body) {
    const lines = String(body || '').split('\n').map(line => line.trim()).filter(Boolean);
    const blocks = [];
    let current = [];

    lines.forEach(line => {
      const isTermLine = /^[^=]{1,80}\s=\s/.test(line);
      const isFlashcard = lines.length <= 6 && !line.includes('.') && line.length <= 70;

      if (isTermLine || isFlashcard) {
        if (current.length) {
          blocks.push(`<p>${escapeText(current.join(' '))}</p>`);
          current = [];
        }
        blocks.push(`<div class="wordjar-mushy-line">${escapeText(line)}</div>`);
        return;
      }

      current.push(line);
    });

    if (current.length) blocks.push(`<p>${escapeText(current.join(' '))}</p>`);
    return blocks.join('');
  }

  function formatMushyBubble(bubble) {
    if (!bubble || bubble.dataset.wordjarFormatted === '1') return;

    const firstParagraph = bubble.querySelector(':scope > p');
    if (!firstParagraph) return;

    const text = firstParagraph.innerText || firstParagraph.textContent || '';
    const sections = splitMushySections(text);
    if (!sections.length) return;

    firstParagraph.outerHTML = sections.map(section => {
      const heading = section.title
        ? `<div class="wordjar-mushy-section-title">${escapeText(section.title)}</div>`
        : '';
      return `<section class="wordjar-mushy-section">${heading}${renderSectionBody(section.body)}</section>`;
    }).join('');

    bubble.dataset.wordjarFormatted = '1';
  }

  function formatVisibleMushyMessages() {
    document
      .querySelectorAll('#wordjarMushyMessages .wordjar-mushy-msg.assistant .wordjar-mushy-bubble')
      .forEach(formatMushyBubble);
  }

  function injectFormatterStyle() {
    if (document.getElementById('wordjarMushyReadableAnswerStyle')) return;

    const style = document.createElement('style');
    style.id = 'wordjarMushyReadableAnswerStyle';
    style.textContent = `
      #wordjarMushyMessages .wordjar-mushy-section {
        margin: 0 0 24px;
      }

      #wordjarMushyMessages .wordjar-mushy-section:last-child {
        margin-bottom: 0;
      }

      #wordjarMushyMessages .wordjar-mushy-section-title {
        margin: 0 0 10px;
        color: var(--ink);
        font-weight: 850;
        line-height: 1.25;
      }

      #wordjarMushyMessages .wordjar-mushy-section p {
        margin: 0 0 14px;
        line-height: 1.75;
      }

      #wordjarMushyMessages .wordjar-mushy-section p:last-child {
        margin-bottom: 0;
      }

      #wordjarMushyMessages .wordjar-mushy-line {
        margin: 0 0 9px;
        line-height: 1.65;
      }

      #wordjarMushyMessages .wordjar-mushy-line:last-child {
        margin-bottom: 0;
      }
    `;
    document.head.appendChild(style);
  }

  function installMessageFormatter() {
    injectFormatterStyle();
    formatVisibleMushyMessages();

    const target = document.getElementById('wordjarMushyMessages');
    if (!target || target.dataset.wordjarFormatterObserver === '1') return;

    target.dataset.wordjarFormatterObserver = '1';
    const observer = new MutationObserver(() => formatVisibleMushyMessages());
    observer.observe(target, { childList: true, subtree: true });
  }

  if (patchMushyAI()) installMessageFormatter();

  const timer = setInterval(() => {
    if (patchMushyAI()) installMessageFormatter();
  }, 120);

  setTimeout(() => clearInterval(timer), 60000);
  document.addEventListener('click', () => setTimeout(installMessageFormatter, 0), true);
})();
