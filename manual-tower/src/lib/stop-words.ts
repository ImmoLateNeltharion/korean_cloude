const STORAGE_KEY = "wordtower-stop-words";

// Built-in stop words — always filtered regardless of user settings
export const DEFAULT_STOP_WORDS: ReadonlySet<string> = new Set([
  // ── Russian: предлоги, союзы, частицы, местоимения ──────────────────
  "а","б","в","г","д","е","ж","з","и","й","к","л","м","н","о","п","р","с","т","у","ф","х","ц","ч","ш","щ","ъ","ы","ь","э","ю","я",
  "во","на","не","но","об","по","за","до","из","ли","же","бы","ни","то","со","ко","де","ну","да","нет","то","как","так","вот","вон","уже","ещё","ещe","еще",
  "все","всё","всех","всем","всему","всей","всего","всеми",
  "это","этот","эта","эти","этих","этим","этому","этой","этого",
  "то","та","те","тот","тех","тем","тому","той","того",
  "я","мне","меня","мной","мою","моя","моё","моего","моей","мои","моих","моим",
  "ты","тебе","тебя","тобой","твой","твоя","твоё","твоего","твоей","твои","твоих","твоим",
  "он","его","ему","него","нему","им","ним","нём","них","ней",
  "она","её","ей","неё","ней",
  "мы","нас","нам","нами","нашего","нашей","нашем","нашему","наши","наших","нашим","наш","наша","наше",
  "вы","вас","вам","вами","вашего","вашей","вашем","вашему","ваши","ваших","вашим","ваш","ваша","ваше",
  "они","их","им","ими","них","ним","ними",
  "себя","себе","собой","сам","сама","само","сами",
  "кто","что","чего","чему","чем","чём","кого","кому","кем",
  "где","куда","когда","как","зачем","почему","откуда","сколько",
  "или","тоже","также","чтобы","чтоб","если","хотя","пока","после","перед","через","между","около","вместе","кроме","против","без","при","над","под","про","для",
  "очень","уж","уже","ведь","вдруг","именно","просто","только","лишь","даже","почти","именно","вообще","конечно","нибудь","либо","либо",
  "тут","там","здесь","сюда","туда","отсюда","оттуда",
  "быть","есть","был","была","было","были","буду","будет","будут","будь","будем","будете",
  "один","одна","одно","одни",
  "который","которая","которое","которые","которых","которым","которому","которой","которого",

  // ── English: articles, prepositions, conjunctions, pronouns, aux verbs ─
  "a","an","the",
  "i","me","my","myself","we","our","ours","ourselves","you","your","yours","yourself","yourselves",
  "he","him","his","himself","she","her","hers","herself","it","its","itself",
  "they","them","their","theirs","themselves",
  "what","which","who","whom","this","that","these","those",
  "am","is","are","was","were","be","been","being","have","has","had","having",
  "do","does","did","doing","will","would","should","could","can","may","might","shall","ought",
  "not","no","nor","so","yet","both","either","neither","whether","if","then","than",
  "and","but","or","as","at","by","for","in","of","on","to","up","with","about","above","after","against","along","among","around","before","behind","below","beneath","beside","between","beyond","during","except","from","inside","into","like","near","off","out","outside","over","past","since","through","throughout","till","toward","under","until","upon","within","without",
  "here","there","when","where","why","how","all","each","every","few","more","most","other","some","such","no","only","same","than","too","very","just","because","while","although","though","even","also","too","again","further","once",
]);

export function loadStopWords(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStopWords(words: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

/** Merge user stop words with built-in defaults */
export function getAllStopWords(userWords: string[]): Set<string> {
  return new Set([...DEFAULT_STOP_WORDS, ...userWords]);
}
