// Anti-spam filter for incoming Telegram words

const CYRILLIC_RE = /^[а-яёА-ЯЁ-]+$/;
const MIN_LEN = 2;
const MAX_LEN = 32;
const RATE_LIMIT = 5; // max words per minute per user
const RATE_WINDOW = 60_000; // 1 minute in ms

// Stems of profanity — enough to catch common forms
const BAD_STEMS = [
  "хуй", "хуе", "хуё", "пизд", "блят", "блядь", "бляд", "ебат",
  "ёбан", "ебан", "ёбт", "ебал", "еблан", "ебло", "ебуч", "ёбу",
  "сука", "сучк", "сучар", "мудак", "мудач", "мудил", "пидор",
  "пидар", "педик", "жоп", "залуп", "манда", "шлюх", "давалк",
  "гандон", "гондон",
  "пенис", "член", "влагал", "анус", "задниц", "проститут",
  "шалав", "блядск", "порно", "секс", "еротик", "эротик",
];

// Rate-limit state: userId → list of timestamps
const rateLimits = new Map<string, number[]>();

export type FilterResult =
  | { ok: true; word: string }
  | { ok: false; reason: string };

function normalizeWord(raw: string): string {
  return raw.trim().toLowerCase().replace(/ё/g, "е");
}

function containsProfanity(word: string): boolean {
  const normalized = word.toLowerCase().replace(/ё/g, "е");
  return BAD_STEMS.some((stem) => normalized.includes(stem.replace(/ё/g, "е")));
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimits.get(userId) || [];

  // Remove entries older than the window
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);

  if (recent.length >= RATE_LIMIT) {
    rateLimits.set(userId, recent);
    return false; // rate limited
  }

  recent.push(now);
  rateLimits.set(userId, recent);
  return true;
}

export function filterWord(raw: string, userId: string): FilterResult {
  // Extract first word only
  const firstWord = raw.trim().split(/\s+/)[0];
  if (!firstWord) {
    return { ok: false, reason: "Пустое сообщение." };
  }

  const word = normalizeWord(firstWord);

  // Length check
  if (word.length < MIN_LEN) {
    return { ok: false, reason: `Слишком короткое слово (минимум ${MIN_LEN} буквы).` };
  }
  if (word.length > MAX_LEN) {
    return { ok: false, reason: `Слишком длинное слово (максимум ${MAX_LEN} букв).` };
  }

  // Cyrillic only
  if (!CYRILLIC_RE.test(word)) {
    return { ok: false, reason: "Только кириллица, пожалуйста." };
  }

  // Profanity check
  if (containsProfanity(word)) {
    return { ok: false, reason: "Это слово не пройдёт модерацию 🙅" };
  }

  // Rate limit
  if (!checkRateLimit(userId)) {
    return {
      ok: false,
      reason: `Слишком много слов! Подождите минутку (лимит: ${RATE_LIMIT} слов/мин).`,
    };
  }

  return { ok: true, word };
}
