import { Bot } from "grammy";
import { filterWord } from "./filter.js";
import { insertWord, upsertUser, insertMessage } from "./db.js";

let bot: Bot | null = null;

export function getBot(): Bot | null {
  return bot;
}

export function startBot(token: string) {
  bot = new Bot(token);

  // Track every user interaction
  bot.use((ctx, next) => {
    if (ctx.from) {
      upsertUser(
        String(ctx.from.id),
        ctx.from.username,
        ctx.from.first_name,
        ctx.from.last_name
      );
    }
    return next();
  });

  bot.command("start", (ctx) => {
    ctx.reply(
      "👋 Привет! Напиши мне любое слово, и оно появится на башне после модерации.\n\n" +
        "Правила:\n" +
        "• Одно слово за раз\n" +
        "• Только кириллица\n" +
        "• Без мата 😉\n" +
        "• До 5 слов в минуту"
    );
  });

  bot.on("message:text", (ctx) => {
    const userId = String(ctx.from.id);
    const username = ctx.from.username || ctx.from.first_name || "anon";
    const text = ctx.message.text;

    // Log every incoming message
    insertMessage(userId, "incoming", text);

    const result = filterWord(text, userId);

    if (!result.ok) {
      return ctx.reply(result.reason);
    }

    const inserted = insertWord(result.word, userId, username);

    if (inserted.isNew) {
      return ctx.reply(
        `✅ Спасибо! Слово «${result.word}» отправлено на модерацию.`
      );
    } else {
      return ctx.reply(
        `👍 Слово «${result.word}» уже на модерации (голосов: ${inserted.count}).`
      );
    }
  });

  const tryStart = async (retries = 0) => {
    try {
      await bot!.start({ drop_pending_updates: true });
    } catch (err: any) {
      if (err?.error_code === 409) {
        const delay = Math.min(5000 * (retries + 1), 30000);
        console.warn(`⚠️ Bot conflict (409), retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        if (bot) await tryStart(retries + 1);
      } else {
        console.error("❌ Bot error:", err?.message || err);
        process.exit(1);
      }
    }
  };

  tryStart();
  console.log("🤖 Telegram bot started");

  return bot;
}

export function stopBot() {
  if (bot) {
    bot.stop();
    bot = null;
  }
}
