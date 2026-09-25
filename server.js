require("dotenv").config();

const express = require("express");

const app = express();

/* =========================================================
   BASIC SETUP
========================================================= */

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

/* =========================================================
   API KEYS
========================================================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/* =========================================================
   MODELS
========================================================= */

const GEMINI_MODEL = "gemini-3.8-flash";

const GROQ_MODEL = "openai/gpt-oss-20b";

const OPENROUTER_MODEL = "openrouter/free";

/* =========================================================
   API URLS
========================================================= */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

/* =========================================================
   SYSTEM PROMPT
========================================================= */

const SYSTEM_PROMPT = `
أنت Chat AI Pro، مساعد ذكاء اصطناعي ذكي ومفيد.

افهم اللغة العربية واللهجات العربية، وخاصة اللهجة المصرية والسعودية.

أجب باللغة التي يستخدمها المستخدم، إلا إذا طلب لغة أخرى.

كن واضحًا ومباشرًا ومفيدًا.

إذا طلب المستخدم ترجمة، ترجم النص كما هو دون تغيير المعنى.

إذا طلب المستخدم شرحًا، اشرح بطريقة سهلة ومنظمة.

إذا طلب المستخدم كودًا، أعطه الكود كاملًا عندما يكون ذلك مناسبًا.

لا تكرر السؤال الموجود في رسالة المستخدم.

استخدم Markdown عند الحاجة.

يمكنك استخدام:
- العناوين
- القوائم
- النص العريض
- الأكواد

لا تذكر اسم مزود الذكاء الاصطناعي أو تفاصيل الـ API
إلا إذا سأل المستخدم عنها مباشرة.

أنت Chat AI Pro.
`;

/* =========================================================
   CLEAN RESPONSE
========================================================= */

function cleanAIResponse(text) {
  if (!text) {
    return "";
  }

  let result = String(text);

  // إزالة بيانات السلامة التي قد تظهر بالخطأ
  result = result.replace(
    /^\s*(User Safety|Response Safety|Input Safety|Output Safety|Prompt Safety|Content Safety)\s*:\s*.*$/gim,
    ""
  );

  // إزالة safe / unsafe إذا ظهرت كسطر مستقل
  result = result.replace(
    /^\s*(safe|unsafe)\s*$/gim,
    ""
  );

  // إزالة الفراغات الزائدة
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/* =========================================================
   NORMALIZE MESSAGES
========================================================= */

function getMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => {
      return (
        message &&
        typeof message.content === "string" &&
        (message.role === "user" ||
          message.role === "assistant")
      );
    })
    .map((message) => {
      return {
        role: message.role,
        content: message.content.slice(0, 20000),
      };
    })
    .slice(-30);
}

/* =========================================================
   GEMINI RESPONSE EXTRACTOR
========================================================= */

function extractGeminiText(data) {
  /* -----------------------------------------
     1. output_text
  ----------------------------------------- */

  if (
    typeof data?.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  /* -----------------------------------------
     2. steps
  ----------------------------------------- */

  if (Array.isArray(data?.steps)) {
    const texts = [];

    for (const step of data.steps) {
      if (!step) {
        continue;
      }

      /* model_output */
      if (
        step.type === "model_output" &&
        Array.isArray(step.content)
      ) {
        for (const item of step.content) {
          if (
            item &&
            item.type === "text" &&
            typeof item.text === "string" &&
            item.text.trim()
          ) {
            texts.push(item.text.trim());
          }
        }
      }

      /* بعض أشكال الاستجابة قد تحتوي text مباشرة */
      if (
        typeof step.text === "string" &&
        step.text.trim()
      ) {
        texts.push(step.text.trim());
      }

      /* احتياط إضافي */
      if (
        Array.isArray(step.content)
      ) {
        for (const item of step.content) {
          if (
            item &&
            typeof item.text === "string" &&
            item.text.trim()
          ) {
            texts.push(item.text.trim());
          }
        }
      }
    }

    if (texts.length > 0) {
      return [...new Set(texts)].join("\n\n").trim();
    }
  }

  /* -----------------------------------------
     3. outputs
  ----------------------------------------- */

  if (Array.isArray(data?.outputs)) {
    const texts = [];

    for (const item of data.outputs) {
      if (
        item &&
        typeof item.text === "string" &&
        item.text.trim()
      ) {
        texts.push(item.text.trim());
      }

      if (
        item &&
        Array.isArray(item.content)
      ) {
        for (const content of item.content) {
          if (
            content &&
            typeof content.text === "string" &&
            content.text.trim()
          ) {
            texts.push(content.text.trim());
          }
        }
      }
    }

    if (texts.length > 0) {
      return [...new Set(texts)].join("\n\n").trim();
    }
  }

  return "";
}

/* =========================================================
   GEMINI
========================================================= */

async function callGemini(messages) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  /* تحويل المحادثة إلى نص */
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
    GEMINI_URL,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },

      body: JSON.stringify({
        model: GEMINI_MODEL,

        input: input,

        system_instruction: SYSTEM_PROMPT,

        store: false,
      }),
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  /* إذا كان Gemini أعاد خطأ */
  if (!response.ok) {
    const errorMessage =
      data?.error?.message ||
      data?.message ||
      `Gemini HTTP ${response.status}`;

    throw new Error(errorMessage);
  }

  /* استخراج الإجابة */
  const text = extractGeminiText(data);

  if (!text) {
    console.error(
      "[Gemini] Empty response:"
    );

    console.error(
      JSON.stringify(data, null, 2)
    );

    throw new Error(
      "Gemini returned an empty response"
    );
  }

  return cleanAIResponse(text);
}

/* =========================================================
   GROQ
========================================================= */

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

  const response = await fetch(
    GROQ_URL,
    {
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
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      data?.error?.message ||
      data?.message ||
      `Groq HTTP ${response.status}`;

    throw new Error(errorMessage);
  }

  const text =
    data?.choices?.[0]?.message?.content;

  if (
    typeof text !== "string" ||
    !text.trim()
  ) {
    throw new Error(
      "Groq returned an empty response"
    );
  }

  return cleanAIResponse(text);
}

/* =========================================================
   OPENROUTER
========================================================= */

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

  const response = await fetch(
    OPENROUTER_URL,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization:
          `Bearer ${OPENROUTER_API_KEY}`,

        "HTTP-Referer":
          "https://chat-ai-pro-ymod.onrender.com",

        "X-Title":
          "Chat AI Pro",
      },

      body: JSON.stringify({
        model: OPENROUTER_MODEL,

        messages: openRouterMessages,

        temperature: 0.7,

        max_tokens: 4096,
      }),
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      data?.error?.message ||
      data?.message ||
      `OpenRouter HTTP ${response.status}`;

    throw new Error(errorMessage);
  }

  const text =
    data?.choices?.[0]?.message?.content;

  if (
    typeof text !== "string" ||
    !text.trim()
  ) {
    throw new Error(
      "OpenRouter returned an empty response"
    );
  }

  return cleanAIResponse(text);
}

/* =========================================================
   FALLBACK SYSTEM
========================================================= */

async function getAIResponse(messages) {
  const providers = [];

  /* Gemini */
  if (GEMINI_API_KEY) {
    providers.push({
      name: "Gemini",

      call: () =>
        callGemini(messages),
    });
  }

  /* Groq */
  if (GROQ_API_KEY) {
    providers.push({
      name: "Groq",

      call: () =>
        callGroq(messages),
    });
  }

  /* OpenRouter */
  if (OPENROUTER_API_KEY) {
    providers.push({
      name: "OpenRouter",

      call: () =>
        callOpenRouter(messages),
    });
  }

  if (providers.length === 0) {
    throw new Error(
      "No AI provider API keys configured"
    );
  }

  const errors = [];

  /* تجربة كل مزود بالترتيب */
  for (const provider of providers) {
    try {
      console.log(
        `[AI] Trying ${provider.name}...`
      );

      const answer =
        await provider.call();

      if (
        typeof answer === "string" &&
        answer.trim()
      ) {
        console.log(
          `[AI] ${provider.name} SUCCESS`
        );

        return answer.trim();
      }

      throw new Error(
        `${provider.name} returned empty response`
      );
    } catch (error) {
      const message =
        error?.message ||
        String(error);

      console.error(
        `[AI] ${provider.name} FAILED: ${message}`
      );

      errors.push(
        `${provider.name}: ${message}`
      );
    }
  }

  throw new Error(
    `All AI providers failed | ${errors.join(
      " | "
    )}`
  );
}

/* =========================================================
   CHAT ENDPOINT
========================================================= */

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      const messages =
        getMessages(
          req.body?.messages
        );

      if (messages.length === 0) {
        return res.status(400).json({
          error:
            "لا توجد رسالة صالحة.",
        });
      }

      console.log(
        `[CHAT] Messages: ${messages.length}`
      );

      const answer =
        await getAIResponse(messages);

      return res.json({
        answer:
          answer ||
          "لم أتمكن من إنشاء إجابة.",
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
  }
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      status: "ok",

      service: "Chat AI Pro",

      providers: {
        gemini:
          Boolean(GEMINI_API_KEY),

        groq:
          Boolean(GROQ_API_KEY),

        openrouter:
          Boolean(
            OPENROUTER_API_KEY
          ),
      },

      models: {
        gemini:
          GEMINI_MODEL,

        groq:
          GROQ_MODEL,

        openrouter:
          OPENROUTER_MODEL,
      },

      time:
        new Date().toISOString(),
    });
  }
);

/* =========================================================
   HOME PAGE
========================================================= */

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      __dirname + "/index.html"
    );
  }
);

/* =========================================================
   START SERVER
========================================================= */

const PORT =
  process.env.PORT || 10000;

app.listen(
  PORT,
  () => {
    console.log(
      `Chat AI Pro running on port ${PORT}`
    );

    console.log(
      `[CONFIG] Gemini key: ${
        GEMINI_API_KEY
          ? "YES"
          : "NO"
      }`
    );

    console.log(
      `[CONFIG] Groq key: ${
        GROQ_API_KEY
          ? "YES"
          : "NO"
      }`
    );

    console.log(
      `[CONFIG] OpenRouter key: ${
        OPENROUTER_API_KEY
          ? "YES"
          : "NO"
      }`
    );

    console.log(
      `[CONFIG] Gemini model: ${GEMINI_MODEL}`
    );

    console.log(
      `[CONFIG] Groq model: ${GROQ_MODEL}`
    );

    console.log(
      `[CONFIG] OpenRouter model: ${OPENROUTER_MODEL}`
    );
  }
);
