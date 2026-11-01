/**
 * Deterministic fallback summarizer.
 *
 * Builds a 2-sentence extractive spiritMessage, a single-line epitaph,
 * and exactly 3 search queries from extracted text. Output depends only
 * on the input text (same input ⇒ same output).
 */

/**
 * Split text into sentences.
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  if (!text) return [];
  // Match sentence-ending punctuation followed by space/end
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return sentences;
}

/**
 * Score a sentence by word frequency in the text (simple extractive approach).
 * @param {string} sentence
 * @param {Map<string, number>} wordFreq
 * @returns {number}
 */
function scoreSentence(sentence, wordFreq) {
  const words = sentence.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  if (words.length === 0) return 0;
  let score = 0;
  for (const word of words) {
    score += wordFreq.get(word) || 0;
  }
  // Normalize by sentence length to avoid bias toward long sentences
  return score / Math.sqrt(words.length);
}

/**
 * Build word frequency map from text.
 * @param {string} text
 * @returns {Map<string, number>}
 */
function buildWordFreq(text) {
  const freq = new Map();
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  return freq;
}

/**
 * Extract keywords from text for search queries.
 * @param {string} text
 * @param {number} count
 * @returns {string[]}
 */
function extractKeywords(text, count) {
  const freq = buildWordFreq(text);
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was',
    'one', 'our', 'out', 'has', 'had', 'his', 'how', 'its', 'may', 'new', 'now',
    'old', 'see', 'way', 'who', 'did', 'this', 'that', 'with', 'from', 'they',
    'have', 'been', 'were', 'what', 'when', 'your', 'their', 'there', 'would',
    'could', 'should', 'about', 'which', 'them', 'these', 'those', 'into',
    'will', 'than', 'then', 'also', 'more', 'most', 'some', 'such', 'only',
    'very', 'just', 'like', 'many', 'much', 'over', 'page', 'site', 'http',
    'https', 'html', 'text', 'title', 'link', 'home', 'main', 'body',
  ]);

  const sorted = [...freq.entries()]
    .filter(([word]) => !stopWords.has(word))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return sorted.slice(0, count).map(([word]) => word);
}

/**
 * Build a deterministic 2-sentence extractive spirit message.
 * @param {string} text
 * @returns {string}
 */
function buildSpiritMessage(text) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 'No readable text could be extracted from the remains.';
  if (sentences.length === 1) return sentences[0] + '.';

  const freq = buildWordFreq(text);
  // Score each sentence, pick top 2 by score
  const scored = sentences.map((s, i) => ({ sentence: s, score: scoreSentence(s, freq), index: i }));
  scored.sort((a, b) => b.score - a.score);

  // Take top 2, but preserve original order
  const topTwo = scored.slice(0, 2).sort((a, b) => a.index - b.index);
  return topTwo.map((s) => s.sentence).join(' ');
}

/**
 * Build a single-line epitaph from text.
 * @param {string} text
 * @param {string} [title]
 * @returns {string}
 */
function buildEpitaph(text, title) {
  const sentences = splitSentences(text);
  const firstSentence = sentences[0] || '';

  // Truncate to ~100 chars
  let epitaph = firstSentence;
  if (epitaph.length > 100) {
    epitaph = epitaph.slice(0, 97).trimEnd() + '...';
  }
  if (!epitaph) {
    epitaph = title ? `An archived page: ${title}` : 'An archived page from the Wayback Machine.';
  }

  // Ensure single line
  return epitaph.replace(/\n/g, ' ').trim();
}

/**
 * Build exactly 3 search queries from text.
 * @param {string} text
 * @param {string} [title]
 * @returns {string[]}
 */
function buildSearchQueries(text, title) {
  const queries = [];

  // Query 1: top keywords
  const keywords = extractKeywords(text, 5);
  if (keywords.length >= 2) {
    queries.push(keywords.slice(0, 3).join(' '));
  } else if (title) {
    queries.push(title);
  }

  // Query 2: title + first keyword
  if (title) {
    const titleWords = title.split(/\s+/).slice(0, 3).join(' ');
    if (titleWords) queries.push(titleWords);
  }

  // Query 3: another set of keywords
  if (keywords.length >= 5) {
    queries.push(keywords.slice(2, 5).join(' '));
  }

  // Fill up to exactly 3
  while (queries.length < 3) {
    if (keywords.length > queries.length) {
      queries.push(keywords[queries.length] || 'archived page');
    } else {
      queries.push(['wayback machine', 'archived web page', 'internet archive'][queries.length] || 'archived page');
    }
  }

  // Ensure all are non-empty and exactly 3
  return queries.slice(0, 3).map((q) => q.trim() || 'archived page');
}

/**
 * Generate a deterministic summary (spirit message, epitaph, search queries)
 * from extracted text.
 *
 * @param {string} text - the plain text extracted from the page
 * @param {string} [title] - optional page title for context
 * @returns {{ spiritMessage: string, epitaph: string, searchQueries: string[], source: string }}
 */
export function deterministicSummary(text, title) {
  const cleanText = (text || '').trim();

  const spiritMessage = buildSpiritMessage(cleanText);
  const epitaph = buildEpitaph(cleanText, title);
  const searchQueries = buildSearchQueries(cleanText, title);

  return {
    spiritMessage,
    epitaph,
    searchQueries,
    source: 'fallback',
  };
}

/**
 * Try Gemini for summary, fall back to deterministic on any failure.
 *
 * @param {string} text - extracted text
 * @param {string} [title] - page title
 * @param {{ fetch?: typeof globalThis.fetch, apiKey?: string }} [opts]
 * @returns {Promise<{ spiritMessage: string, epitaph: string, searchQueries: string[], source: string }>}
 */
export async function summarize(text, title, opts = {}) {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const result = await geminiSummary(text, title, apiKey, opts);
      if (result) return result;
    } catch (err) {
      // Swallow — fall back to deterministic
      // Never log the key or full error that might contain key
      console.error('Gemini summary failed, using fallback');
    }
  }

  return deterministicSummary(text, title);
}

/**
 * Call the Gemini generateContent API for a summary.
 * Tries multiple models in order, 20s timeout each.
 *
 * @param {string} text
 * @param {string} title
 * @param {string} apiKey
 * @param {{ fetch?: typeof globalThis.fetch }} [opts]
 * @returns {Promise<{ spiritMessage: string, epitaph: string, searchQueries: string[], source: string } | null>}
 */
async function geminiSummary(text, title, apiKey, opts = {}) {
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const models = (process.env.GEMINI_MODELS || 'gemini-3.6-flash,gemini-3.5-flash-lite,gemini-2.5-flash')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  const prompt = buildGeminiPrompt(text, title);

  for (const model of models) {
    try {
      const result = await callGeminiModel(fetchFn, model, apiKey, prompt);
      if (result) {
        return { ...result, source: `gemini:${model}` };
      }
    } catch (err) {
      // Try next model
      console.error(`Gemini model ${model} failed, trying next`);
    }
  }

  return null;
}

/**
 * Build the prompt for Gemini.
 * @param {string} text
 * @param {string} title
 * @returns {string}
 */
function buildGeminiPrompt(text, title) {
  const truncated = (text || '').slice(0, 5000);
  const titlePart = title ? `Title: ${title}\n` : '';
  return `You are analyzing an archived web page. Provide a summary in this exact JSON format:
{"spiritMessage": "exactly 2 sentences summarizing the page content", "epitaph": "one line describing what this page was about", "searchQueries": ["query 1", "query 2", "query 3"]}

${titlePart}Content:
${truncated}

Respond with ONLY valid JSON, no markdown.`;
}

/**
 * Call a single Gemini model.
 * @param {typeof fetch} fetchFn
 * @param {string} model
 * @param {string} apiKey
 * @param {string} prompt
 * @returns {Promise<{ spiritMessage: string, epitaph: string, searchQueries: string[] } | null>}
 */
async function callGeminiModel(fetchFn, model, apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const timeout = 20000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new Error(`Gemini API returned ${response.status}`);
  }

  const data = await response.json();

  // Extract text from response
  const candidate = data.candidates?.[0];
  const responseText = candidate?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error('Empty Gemini response');
  }

  // Parse JSON from response
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    // Try to extract JSON from markdown
    const match = responseText.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error('Invalid JSON from Gemini');
    }
  }

  const spiritMessage = parsed.spiritMessage || '';
  const epitaph = (parsed.epitaph || '').replace(/\n/g, ' ').trim();
  const searchQueries = Array.isArray(parsed.searchQueries) ? parsed.searchQueries.slice(0, 3) : [];

  // Validate
  if (!spiritMessage || !epitaph || searchQueries.length === 0) {
    throw new Error('Incomplete Gemini response');
  }

  // Ensure exactly 3 search queries
  while (searchQueries.length < 3) {
    searchQueries.push('archived page');
  }

  return {
    spiritMessage,
    epitaph,
    searchQueries: searchQueries.slice(0, 3),
  };
}
