/**
 * ИИ-репетитор: серверная прослойка к Gemini.
 *
 * Почему это функция, а не вызов из браузера. Сайт публичный, и ключ,
 * положенный в клиентский код, забирает любой, кто откроет devtools, —
 * дальше он жжёт нашу квоту от нашего имени. Поэтому ключ живёт только
 * в переменных окружения Vercel, а браузер разговаривает с этим эндпоинтом.
 *
 * Существующий облачный режим в src/engine/tutor.js работает иначе и это
 * нормально: там ключ вводит сам ученик и он остаётся в его браузере.
 * Здесь ключ наш, поэтому наружу он не выходит.
 *
 * Оффлайн-режим при этом остаётся главным: если функция недоступна,
 * приложение молча возвращается к разбору по учебному графу на устройстве.
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const ENDPOINT = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

/** Ответ агента жёстко описан схемой: UI рисует кнопки, а не парсит текст. */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    text: { type: 'STRING', description: 'Ответ ученику. Максимум 5 предложений.' },
    intent: { type: 'STRING', enum: ['explain', 'diagnose', 'plan', 'encourage', 'refuse_answer', 'offtopic'] },
    actions: {
      type: 'ARRAY',
      description: 'До трёх предложений следующего шага.',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['learn', 'hint', 'easier', 'plan', 'graph'] },
          topicId: { type: 'STRING', description: 'id темы из списка, если применимо' },
          label: { type: 'STRING', description: 'Надпись на кнопке, на языке ученика' },
        },
        required: ['type', 'label'],
      },
    },
  },
  required: ['text', 'intent', 'actions'],
};

const LANG_NAME = { kk: 'қазақша', ru: 'русском', en: 'English' };

/** JSON.parse, который не бросает: модель не всегда возвращает валидный объект. */
function safeParse(t) {
  if (typeof t !== 'string') return null;
  const s = t.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  if (!s.startsWith('{')) return null;
  try { return JSON.parse(s); } catch { return null; }
}

/**
 * Достаёт значение "text" из повреждённого JSON.
 *
 * Модель изредка выводит объект дважды — вложенный в собственное поле text.
 * Внешний объект тогда упирается в лимит токенов и обрывается на середине,
 * из-за чего JSON.parse бессилен, а ученик видит сырые фигурные скобки.
 * Здесь мы вынимаем строку вручную, разворачивая экранирование.
 */
function rescueText(t) {
  if (typeof t !== 'string') return null;
  const m = t.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;
  try { return JSON.parse('"' + m[1] + '"'); } catch { return null; }
}

function systemPrompt({ lang, profile, topics, currentItem }) {
  const known = (topics || [])
    .map((t) => `- ${t.id} · ${t.title} · освоено ${Math.round((t.mastery ?? 0) * 100)}%`)
    .join('\n');

  return `Ты — AQYL, репетитор для школьников Казахстана (7–11 класс).

ГЛАВНОЕ ПРАВИЛО, НАРУШАТЬ НЕЛЬЗЯ.
Ты никогда не выдаёшь готовый ответ на задание, которое ученик решает прямо сейчас.
На прямую просьбу «скажи ответ» ты возвращаешь наводящий вопрос — следующую ступень
подсказки. Готовое решение допустимо только после того, как ученик прислал свою попытку.
Если ученик настаивает — вежливо держишь границу и объясняешь, зачем.

ОСТАЛЬНЫЕ ПРАВИЛА.
1. Отвечай на ${LANG_NAME[lang] || 'русском'} языке.
2. Максимум 5 предложений. Коротко и по делу, без вступлений.
3. Опирайся только на темы из списка ниже. Если темы там нет — честно скажи,
   что она вне программы, которую ты знаешь, и предложи ближайшую из списка.
4. Не выдумывай проценты освоения и не ссылайся на данные, которых нет ниже.
5. Обращайся к ученику на «ты», спокойно и без снисходительности.

КАРТА УЧЕНИКА.
Уровень θ: ${(profile?.theta ?? 0).toFixed(2)} (шкала примерно от −3 до +3)
Класс: ${profile?.grade ?? '—'}. Цель: ${profile?.goal ?? '—'}.
Решено заданий: ${profile?.attempts ?? 0}.

ТЕМЫ И ОСВОЕНИЕ.
${known || '(данных пока нет — ученик ещё не проходил диагностику)'}

${currentItem ? `СЕЙЧАС РЕШАЕТ ЗАДАНИЕ: "${currentItem}"\nЭто именно то задание, ответ на которое выдавать запрещено.` : 'Сейчас ученик не решает конкретное задание.'}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // Не 500: для клиента это штатный повод уйти в оффлайн-режим.
    return res.status(503).json({ error: 'offline', reason: 'GEMINI_API_KEY не задан' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body.message !== 'string' || !body.message.trim()) {
    return res.status(400).json({ error: 'Пустой запрос' });
  }
  // Простой предохранитель от случайной или намеренной перегрузки квоты.
  if (body.message.length > 2000) {
    return res.status(413).json({ error: 'Слишком длинный вопрос' });
  }

  const lang = ['kk', 'ru', 'en'].includes(body.lang) ? body.lang : 'ru';
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

  const contents = [
    ...history
      .filter((m) => m && typeof m.text === 'string')
      .map((m) => ({ role: m.role === 'bot' ? 'model' : 'user', parts: [{ text: m.text.slice(0, 1500) }] })),
    { role: 'user', parts: [{ text: body.message.slice(0, 2000) }] },
  ];

  const payload = {
    contents,
    systemInstruction: { parts: [{ text: systemPrompt({ lang, profile: body.profile, topics: body.topics, currentItem: body.currentItem }) }] },
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 1200,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  try {
    /* Десять секунд, а не двадцать.
       Двадцать секунд ожидания — это не «терпеливо», это сломанный экран:
       ученик успевает решить, что приложение зависло, и уйти. Разбор на
       устройстве всё это время лежит готовый, и отдать его на десятой
       секунде честнее, чем показывать пустоту на двадцатой. */
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(ENDPOINT(MODEL), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('Gemini error', r.status, detail.slice(0, 400));
      return res.status(502).json({ error: 'upstream', status: r.status });
    }

    const data = await r.json();
    const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    let parsed = safeParse(raw) || { text: raw, intent: 'explain', actions: [] };

    /* Модель иногда кладёт готовый JSON внутрь поля text — чаще на казахском.
       Тогда ученик увидел бы сырые фигурные скобки, поэтому разворачиваем. */
    for (let i = 0; i < 2 && typeof parsed.text === 'string'; i++) {
      if (!parsed.text.trim().startsWith('{')) break;
      const inner = safeParse(parsed.text);
      if (inner && typeof inner.text === 'string') { parsed = { ...parsed, ...inner }; continue; }
      const rescued = rescueText(parsed.text);   // вложенный JSON оборвался на полуслове
      if (rescued) { parsed = { ...parsed, text: rescued }; }
      break;
    }

    if (!parsed.text || typeof parsed.text !== 'string') return res.status(502).json({ error: 'empty' });

    return res.status(200).json({
      text: String(parsed.text),
      intent: parsed.intent || 'explain',
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [],
      model: MODEL,
    });
  } catch (e) {
    console.error('tutor handler failed:', e.message);
    return res.status(504).json({ error: 'timeout' });
  }
}
