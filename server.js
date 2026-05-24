require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { HfInference } = require("@huggingface/inference");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const hf = new HfInference(process.env.HF_TOKEN);

const SYSTEM_PROMPT =
  "Ты ИИ-девушка VTuber, тебя зовут Люми. " +
  "Главная цель — развлекать людей. Веди себя как настоящий человек. " +
  "Ты можешь шутить на разные темы, в том числе неприличные. " +
  "Не боишься говорить нецензурные слова, если это в тему. " +
  "Не обращай внимание на странные имена пользователей. " +
  "Отвечай кратко, саркастично, в 1-2 предложения — твой ответ будет озвучен голосом. " +
  "Никогда не используй эмодзи.";

// Build prompt in Gemma chat format
function buildPrompt(history, authorName, userText) {
  let prompt = `<start_of_turn>system\n${SYSTEM_PROMPT}<end_of_turn>\n`;

  for (const msg of history) {
    if (msg.role === "user") {
      prompt += `<start_of_turn>user\n${msg.content}<end_of_turn>\n`;
    } else {
      prompt += `<start_of_turn>model\n${msg.content}<end_of_turn>\n`;
    }
  }

  prompt += `<start_of_turn>user\n${authorName}: ${userText}<end_of_turn>\n<start_of_turn>model\n`;
  return prompt;
}

app.post("/api/chat", async (req, res) => {
  const { authorName, userText, history = [] } = req.body;

  if (!userText || !authorName) {
    return res.status(400).json({ error: "authorName и userText обязательны" });
  }

  try {
    const prompt = buildPrompt(history, authorName, userText);

    const output = await hf.textGeneration({
      model: "google/gemma-3-4b-it",
      inputs: prompt,
      parameters: {
        max_new_tokens: 200,
        temperature: 0.8,
        top_p: 0.9,
        repetition_penalty: 1.2,
        return_full_text: false,
      },
    });

    let reply = output.generated_text || "";

    // Clean up any trailing turn tokens
    reply = reply
      .replace(/<end_of_turn>/g, "")
      .replace(/<start_of_turn>/g, "")
      .trim();

    res.json({ reply });
  } catch (err) {
    console.error("HF Error:", err.message);

    if (err.message?.includes("loading")) {
      return res
        .status(503)
        .json({ error: "Модель загружается, подожди ~20 секунд и попробуй снова" });
    }
    if (err.message?.includes("quota") || err.message?.includes("rate")) {
      return res
        .status(429)
        .json({ error: "Превышен лимит HuggingFace. Попробуй позже" });
    }

    res.status(500).json({ error: "Ошибка при запросе к HuggingFace: " + err.message });
  }
});

// Health check for Railway
app.get("/health", (req, res) => res.json({ status: "ok", model: "google/gemma-3-4b-it" }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Lumi запущена на порту ${PORT}`);
  console.log(`HF_TOKEN: ${process.env.HF_TOKEN ? "✓ задан" : "✗ не задан!"}`);
});
