require("dotenv").config();

const express = require("express");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

/* =========================
   API KEYS
========================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/* =========================
   MODELS
========================= */

// Gemini
const GEMINI_MODEL = "gemini-flash-latest";

// Groq
// Current supported GPT-OSS model
const GROQ_MODEL = "openai/gpt-oss-20b";

// OpenRouter
const OPENROUTER_MODEL = "openrouter/free";

/* =========================
   API URLS
========================= */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1/interactions";

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

/* =========================
   SYSTEM PROMPT
========================= */

const SYSTEM_PROMPT = `
أنت Chat AI Pro، مساعد ذكاء اصطناعي ذكي ومفيد.

افهم اللغة العربية واللهجات العربية، وخاصة اللهجة المصرية والسعودية.

أجب باللغة التي يستخدمها المستخدم، إلا إذا طلب لغة أخرى.

كن واضحًا ومباشرًا ومفيدًا.

إذا طلب المستخدم ترجمة، ترجم النص كما هو دون تغيير المعنى.

إذا طلب المستخدم شرحًا، اشرح بطريقة سهلة ومنظمة.

إذا طلب المستخدم كودًا، أعطه الكود كاملًا عندما يكون ذلك مناسبًا.

لا تضف معلومات غير مطلوبة.

لا تكرر السؤال الموجود في رسالة المستخدم.

استخدم Markdown بشكل طبيعي عند الحاجة:
- العناوين
- القوائم
- النص العريض
- الأكواد

لا تكتب أي معلومات تقنية عن مزود الذكاء الاصطناعي أو API إلا إذا سأل المستخدم عنها مباشرة.

أنت Chat AI Pro.
`;

/* =========================
   CLEAN AI RESPONSE
========================= */

function cleanAIResponse(text) {
  if (!text) return "";

  let result = String(text);

  // Remove safety metadata that may accidentally appear
  result = result.replace(
    /^\s*(User Safety|Response Safety|Input Safety|Output Safety|Prompt Safety|Content Safety)\s*:\s*.*$/gim,
    ""
  );

  // Remove lines containing only safe/unsafe
  result = result.replace(
    /^\s*(safe|unsafe)\s*$/gim,
    ""
  );

  // Remove excessive blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/* =========================
   NORMALIZE MESSAGES
========================= */

function getMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter(
      (message) =>
        message &&
        typeof message.content === "string" &&
        (message.role === "user" || message.role === "assistant")
    )
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 20000),
    }))
    .slice(-30);
}

/* =========================
   EXTRACT GEMINI TEXT
========================= */

function extractGeminiText(data) {
  // New Interactions API response
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  // New steps format
  if (Array.isArray(data?.steps)) {
    const texts = [];

    for (const step of data.steps) {
      if (step?.type !== "model_output") continue;

      if (Array.isArray(step.content)) {
        for (const item of step.content) {
          if (
            item?.type === "text" &&
            typeof item.text === "string"
          ) {
            texts.push(item.text);
          }
        }
      }
    }

    if (texts.length > 0) {
      return texts.join("\n");
    }
  }

  // Legacy outputs format
  if (Array.isArray(data?.outputs)) {
    const texts = [];

    for (const item of data.outputs) {
      if (
        item?.type === "text" &&
        typeof item.text === "string"
      ) {
        texts.push(item.text);
      }
    }

    if (texts.length > 0) {
      return texts.join("\n");
    }
  }

  return "";
}

/* =========================
   GEMINI
========================= */

async function callGemini(messages) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const input = messages
    .map((message) => {
      const role =
        message.role === "assistant"
          ? "المساعد"
          : "المستخدم";

      return `${role}: ${message.content}`;
    })
    .join("\n\n");

  const response = await fetch(
    `${GEMINI_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        model: GEMINI_MODEL,

        system_instruction: SYSTEM_PROMPT,

        input: input,

        store: false,

        generation_config: {
          max_output_tokens: 2048,
        },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Gemini HTTP ${response.status}`;

    throw new Error(message);
  }

  const text = extractGeminiText(data);

  if (!text) {
    throw new Error(
      "Gemini returned an empty response"
    );
  }

  return cleanAIResponse(text);
}

/* =========================
   GROQ
========================= */

async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const groqMessages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...messages,
  ];

  const response = await fetch(GROQ_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },

    body: JSON.stringify({
      model: GROQ_MODEL,

      messages: groqMessages,

      temperature: 0.7,

      max_completion_tokens: 4096,

      include_reasoning: false,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Groq HTTP ${response.status}`;

    throw new Error(message);
  }

  const text =
    data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(
      "Groq returned an empty response"
    );
  }

  return cleanAIResponse(text);
}

/* =========================
   OPENROUTER
========================= */

async function callOpenRouter(messages) {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is missing"
    );
  }

  const openRouterMessages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...messages,
  ];

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",

      Authorization: `Bearer ${OPENROUTER_API_KEY}`,

      "HTTP-Referer":
        "https://chat-ai-pro-ymod.onrender.com",

      "X-Title": "Chat AI Pro",
    },

    body: JSON.stringify({
      model: OPENROUTER_MODEL,

      messages: openRouterMessages,

      temperature: 0.7,

      max_tokens: 4096,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `OpenRouter HTTP ${response.status}`;

    throw new Error(message);
  }

  const text =
    data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(
      "OpenRouter returned an empty response"
    );
  }

  return cleanAIResponse(text);
}

/* =========================
   AI FALLBACK SYSTEM
========================= */

async function getAIResponse(messages) {
  const providers = [];

  if (GEMINI_API_KEY) {
    providers.push({
      name: "Gemini",
      call: () => callGemini(messages),
    });
  }

  if (GROQ_API_KEY) {
    providers.push({
      name: "Groq",
      call: () => callGroq(messages),
    });
  }

  if (OPENROUTER_API_KEY) {
    providers.push({
      name: "OpenRouter",
      call: () => callOpenRouter(messages),
    });
  }

  if (providers.length === 0) {
    throw new Error(
      "No AI provider API keys configured"
    );
  }

  const errors = [];

  for (const provider of providers) {
    try {
      console.log(
        `[AI] Trying provider: ${provider.name}`
      );

      const result = await provider.call();

      console.log(
        `[AI] Success: ${provider.name}`
      );

      return result;
    } catch (error) {
      const errorMessage =
        error?.message || String(error);

      console.error(
        `[AI] ${provider.name} failed: ${errorMessage}`
      );

      errors.push(
        `${provider.name}: ${errorMessage}`
      );
    }
  }

  throw new Error(
    `All AI providers failed | ${errors.join(" | ")}`
  );
}

/* =========================
   CHAT API
========================= */

app.post("/api/chat", async (req, res) => {
  try {
    const messages = getMessages(req.body?.messages);

    if (messages.length === 0) {
      return res.status(400).json({
        error: "لا توجد رسالة صالحة.",
      });
    }

    const answer = await getAIResponse(messages);

    return res.json({
      answer: answer || "لم أتمكن من إنشاء إجابة.",
    });
  } catch (error) {
    console.error(
      "[CHAT ERROR]",
      error?.message || error
    );

    return res.status(500).json({
      error:
        "تعذر الحصول على إجابة حاليًا. حاول مرة أخرى بعد قليل.",
    });
  }
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",

    service: "Chat AI Pro",

    providers: {
      gemini: Boolean(GEMINI_API_KEY),
      groq: Boolean(GROQ_API_KEY),
      openrouter: Boolean(OPENROUTER_API_KEY),
    },

    models: {
      gemini: GEMINI_MODEL,
      groq: GROQ_MODEL,
      openrouter: OPENROUTER_MODEL,
    },

    time: new Date().toISOString(),
  });
});

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(
    `Chat AI Pro running on port ${PORT}`
  );

  console.log(
    `[CONFIG] Gemini key: ${
      GEMINI_API_KEY ? "YES" : "NO"
    }`
  );

  console.log(
    `[CONFIG] Groq key: ${
      GROQ_API_KEY ? "YES" : "NO"
    }`
  );

  console.log(
    `[CONFIG] OpenRouter key: ${
      OPENROUTER_API_KEY ? "YES" : "NO"
    }`
  );

  console.log(
    `[CONFIG] Groq model: ${GROQ_MODEL}`
  );

  console.log(
    `[CONFIG] Gemini model: ${GEMINI_MODEL}`
  );

  console.log(
    `[CONFIG] OpenRouter model: ${OPENROUTER_MODEL}`
  );
});
