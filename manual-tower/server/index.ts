import express from "express";
import { execSync } from "child_process";
import { getPendingWords, approveWord, rejectWord, getApprovedWordsMap, deleteApprovedWord, addApprovedWordManual } from "./db.js";
import { authMiddleware, loginHandler, logoutHandler, statusHandler } from "./auth.js";
import { VATECH_DICTIONARY } from "./vatech-dictionary.js";

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// ─── Auth endpoints (public) ────────────────────────────
app.post("/api/auth/login", loginHandler);
app.post("/api/auth/logout", logoutHandler);
app.get("/api/auth/status", statusHandler);

// ─── Public: approved words (needed by tower without auth) ─
app.get("/api/words/approved", (_req, res) => {
  try {
    const words = getApprovedWordsMap();
    res.json(words);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch approved words" });
  }
});

// ─── Protected endpoints (require auth) ─────────────────
app.use("/api/words", authMiddleware);
app.use("/api/docker", authMiddleware);

// ─── Docker status ──────────────────────────────────────
app.get("/api/docker/status", (_req, res) => {
  try {
    const output = execSync(
      'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}"',
      { timeout: 5000 }
    ).toString().trim();

    const containers = output
      ? output.split("\n").map(line => {
          const [id, name, image, status, state, ports] = line.split("|");
          return { id, name, image, status, state, ports };
        })
      : [];

    res.json({ available: true, containers });
  } catch (err) {
    res.json({
      available: false,
      containers: [],
      error: "Docker not accessible",
    });
  }
});

// ─── Moderation endpoints ───────────────────────────────
app.get("/api/words/pending", (_req, res) => {
  try {
    const words = getPendingWords();
    res.json(words);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending words" });
  }
});

app.post("/api/words/:id/approve", (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const ok = approveWord(id);
  if (ok) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Word not found or already moderated" });
  }
});

app.post("/api/words/:id/reject", (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const ok = rejectWord(id);
  if (ok) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Word not found or already moderated" });
  }
});

// ─── Delete approved word ───────────────────────────────
app.delete("/api/words/approved/:word", (req, res) => {
  const word = decodeURIComponent(req.params.word);
  if (!word) return res.status(400).json({ error: "Missing word" });

  const ok = deleteApprovedWord(word);
  if (ok) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Word not found" });
  }
});

// ─── Manual add approved word ───────────────────────────
app.post("/api/words/manual", (req, res) => {
  const word = String(req.body?.word || "").trim();
  const count = Number(req.body?.count || 1);
  if (!word) return res.status(400).json({ error: "Word is required" });

  try {
    const result = addApprovedWordManual(word, count);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to add word" });
  }
});

function pickRandomUnique<T>(items: T[], count: number): T[] {
  if (items.length <= count) return [...items];
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function seedApprovedWordsIfEmpty(count: number) {
  const safeCount = Math.max(1, Math.min(count, VATECH_DICTIONARY.length));
  const existing = Object.keys(getApprovedWordsMap()).length;
  if (existing > 0) {
    console.log(`Seed skipped: approved words already exist (${existing})`);
    return;
  }

  const picked = pickRandomUnique(VATECH_DICTIONARY, safeCount);
  let inserted = 0;
  for (const word of picked) {
    addApprovedWordManual(word, 1);
    inserted += 1;
  }
  console.log(`Seed done: inserted ${inserted} approved words`);
}

app.post("/api/words/manual/add-three", (_req, res) => {
  try {
    const approvedSet = new Set(
      Object.keys(getApprovedWordsMap()).map((word) => word.toLowerCase())
    );

    const unseen = VATECH_DICTIONARY.filter(
      (word) => !approvedSet.has(word.toLowerCase())
    );
    const source = unseen.length >= 3 ? unseen : VATECH_DICTIONARY;
    const picked = pickRandomUnique(source, 3);

    const added = picked.map((word) => addApprovedWordManual(word, 1));
    res.json({
      success: true,
      dictionarySize: VATECH_DICTIONARY.length,
      added,
      remainingUnseen: Math.max(0, unseen.length - picked.length),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to add words" });
  }
});

// ─── Start server ───────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Docker status API running on http://localhost:${PORT}`);
});

const SEED_APPROVED_WORDS_ON_EMPTY = Number(process.env.SEED_APPROVED_WORDS_ON_EMPTY || 0);
if (Number.isFinite(SEED_APPROVED_WORDS_ON_EMPTY) && SEED_APPROVED_WORDS_ON_EMPTY > 0) {
  try {
    seedApprovedWordsIfEmpty(SEED_APPROVED_WORDS_ON_EMPTY);
  } catch (err) {
    console.error("Failed to seed approved words:", err);
  }
}
