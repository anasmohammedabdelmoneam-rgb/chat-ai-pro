require("dotenv").config();

const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

// ======================================================
// Basic setup
// ======================================================

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

// ======================================================
// API KEYS
// Put these ONLY in Render Environment Variables
// ======================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AUTHENTICA_API_KEY = process.env.AUTHENTICA_API_KEY;

// ======================================================
// Models
// ======================================================

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.8-flash";

const GROQ_MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "openrouter/free";

// ======================================================
// URLs
// ======================================================

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1/interactions";

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const AUTHENTICA_SEND_OTP_URL =
  "https://api.authentica.sa/api/v2/send-otp";

const AUTHENTICA_VERIFY_OTP_URL =
  "https://api.authentica.sa/api/v2/verify-otp";

const AUTHENTICA_BALANCE_URL =
  "https://api.authentica.sa/api/v2/balance";

// ======================================================
// System prompt
// ======================================================

const SYSTEM_PROMPT = `
You are Chat AI Pro, a helpful AI assistant.

You understand Arabic, English, and mixed Arabic-English messages.

Important rules:

1. Understand the user's exact question before answering.
2. If the user writes Arabic, normally answer in Arabic.
3. If the user writes English, normally answer in English.
4. If the user mixes languages, understand the meaning and answer naturally.
5. Do not unnecessarily change the user's wording.
6. Give direct and useful answers.
7. For coding questions, provide complete working code when appropriate.
8. Use Markdown when it makes the answer easier to read.
9. Do not reveal API keys, environment variables, secrets, or internal server information.
10. Do not claim that an operation succeeded if it did not actually succeed.
`;

// ======================================================
// Helpers
// ======================================================

function safeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function cleanAIResponse(text) {
  let result = safeString(text);

  // Remove accidental null characters
  result = result.replace(/\u0000/g, "");

  // Normalize excessive blank lines
  result = result.replace(/\n{4,}/g, "\n\n");

  return result.trim();
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => {
      return (
        message &&
        typeof message === "object" &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim()
      );
    })
    .slice(-30)
    .map((message) => ({
      role: message.role,
      content: message.content.trim()
    }));
}

function logProviderError(provider, error) {
  console.error(
    `[${provider}]`,
    error instanceof Error ? error.message : error
  );
}

// ======================================================
// Gemini
// ======================================================

async function callGemini(messages) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const input = messages
    .map((message) => {
      const role =
        message.role === "assistant"
          ? "Assistant"
          : "User";

      return `${role}: ${message.content}`;
    })
    .join("\n\n");

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input: input,
      system_instruction: SYSTEM_PROMPT,
      store: false,
      generation_config: {
        max_output_tokens: 4096
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Gemini HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }

  let text = "";

  // Current Interactions API response
  if (typeof data.output_text === "string") {
    text = data.output_text;
  }

  // Fallback: inspect steps
  if (!text && Array.isArray(data.steps)) {
    for (const step of data.steps) {
      if (
        step &&
        step.type === "model_output" &&
        Array.isArray(step.content)
      ) {
        for (const item of step.content) {
          if (
            item &&
            item.type === "text" &&
            typeof item.text === "string"
          ) {
            text += item.text;
          }
        }
      }
    }
  }

  if (!text) {
    throw new Error(
      `Gemini returned no text: ${JSON.stringify(data)}`
    );
  }

  return cleanAIResponse(text);
}

// ======================================================
// Groq
// ======================================================

async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const groqMessages = [
    {
      role: "system",
      content: SYSTEM_PROMPT
    },
    ...messages
  ];

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 4096,

      // GPT-OSS supports reasoning.
      // We don't need the reasoning text in the user's answer.
      reasoning_effort: "low",
      include_reasoning: false
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Groq HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }

  const text =
    data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(
      `Groq returned no text: ${JSON.stringify(data)}`
    );
  }

  return cleanAIResponse(text);
}

// ======================================================
// OpenRouter
// ======================================================

async function callOpenRouter(messages) {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured"
    );
  }

  const openRouterMessages = [
    {
      role: "system",
      content: SYSTEM_PROMPT
    },
    ...messages
  ];

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,

      // Optional metadata for OpenRouter
      "HTTP-Referer":
        "https://anasmohammedabdelmoneam-rgb.github.io/",
      "X-Title": "Chat AI Pro"
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: openRouterMessages,
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `OpenRouter HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }

  const text =
    data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(
      `OpenRouter returned no text: ${JSON.stringify(data)}`
    );
  }

  return cleanAIResponse(text);
}

// ======================================================
// AI FALLBACK SYSTEM
//
// Gemini → Groq → OpenRouter
// ======================================================

async function getAIResponse(messages) {
  const providers = [
    {
      name: "Gemini",
      enabled: Boolean(GEMINI_API_KEY),
      call: () => callGemini(messages)
    },
    {
      name: "Groq",
      enabled: Boolean(GROQ_API_KEY),
      call: () => callGroq(messages)
    },
    {
      name: "OpenRouter",
      enabled: Boolean(OPENROUTER_API_KEY),
      call: () => callOpenRouter(messages)
    }
  ];

  const errors = [];

  for (const provider of providers) {
    if (!provider.enabled) {
      continue;
    }

    try {
      console.log(`Trying AI provider: ${provider.name}`);

      const answer = await provider.call();

      console.log(
        `AI provider succeeded: ${provider.name}`
      );

      return {
        answer,
        provider: provider.name
      };
    } catch (error) {
      logProviderError(provider.name, error);

      errors.push({
        provider: provider.name,
        error:
          error instanceof Error
            ? error.message
            : String(error)
      });
    }
  }

  const error = new Error(
    "All AI providers failed"
  );

  error.providers = errors;

  throw error;
}

// ======================================================
// CHAT API
// ======================================================

app.post("/api/chat", async (req, res) => {
  try {
    const messages = normalizeMessages(req.body?.messages);

    if (!messages.length) {
      return res.status(400).json({
        error: "لم يتم إرسال رسالة صحيحة."
      });
    }

    const result = await getAIResponse(messages);

    return res.json({
      ok: true,
      answer: result.answer,
      provider: result.provider
    });
  } catch (error) {
    console.error(
      "CHAT ERROR:",
      error instanceof Error
        ? error.message
        : error
    );

    // Do NOT send API keys or full provider errors
    // to the browser.
    return res.status(503).json({
      ok: false,
      error:
        "تعذر الحصول على إجابة حاليًا. حاول مرة أخرى بعد قليل."
    });
  }
});

// ======================================================
// AUTHENTICA HELPERS
// ======================================================

function normalizeSaudiPhone(phone) {
  let value = safeString(phone).trim();

  // Remove spaces, hyphens and parentheses
  value = value.replace(/[\s\-()]/g, "");

  // Convert 05xxxxxxxx to +9665xxxxxxxx
  if (/^05\d{8}$/.test(value)) {
    value = "+966" + value.substring(1);
  }

  // Convert 5xxxxxxxx to +9665xxxxxxxx
  if (/^5\d{8}$/.test(value)) {
    value = "+966" + value;
  }

  return value;
}

function validatePhone(phone) {
  const normalized = normalizeSaudiPhone(phone);

  // Basic international phone validation.
  // Authentica requires international format.
  if (!/^\+\d{8,15}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function validateEmail(email) {
  const value = safeString(email)
    .trim()
    .toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  ) {
    return null;
  }

  return value;
}

// ======================================================
// AUTHENTICA - SEND OTP
// ======================================================

app.post("/api/auth/send-otp", async (req, res) => {
  try {
    if (!AUTHENTICA_API_KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "AUTHENTICA_API_KEY is not configured on the server."
      });
    }

    const method =
      safeString(req.body?.method)
        .trim()
        .toLowerCase() || "whatsapp";

    if (!["whatsapp", "sms", "email"].includes(method)) {
      return res.status(400).json({
        ok: false,
        error:
          "طريقة التحقق غير صحيحة."
      });
    }

    const body = {
      method
    };

    if (method === "whatsapp" || method === "sms") {
      const phone = validatePhone(
        req.body?.phone
      );

      if (!phone) {
        return res.status(400).json({
          ok: false,
          error:
            "أدخل رقم جوال صحيح بصيغة دولية، مثل +9665XXXXXXXX."
        });
      }

      body.phone = phone;
    }

    if (method === "email") {
      const email = validateEmail(
        req.body?.email
      );

      if (!email) {
        return res.status(400).json({
          ok: false,
          error:
            "أدخل بريدًا إلكترونيًا صحيحًا."
        });
      }

      body.email = email;
    }

    // Optional template
    if (req.body?.template_id !== undefined) {
      const templateId =
        Number(req.body.template_id);

      if (
        Number.isInteger(templateId) &&
        templateId > 0
      ) {
        body.template_id = templateId;
      }
    }

    // Optional fallback phone
    if (req.body?.fallback_phone) {
      const fallbackPhone =
        validatePhone(
          req.body.fallback_phone
        );

      if (!fallbackPhone) {
        return res.status(400).json({
          ok: false,
          error:
            "رقم fallback غير صحيح."
        });
      }

      body.fallback_phone = fallbackPhone;
    }

    // Optional fallback email
    if (req.body?.fallback_email) {
      const fallbackEmail =
        validateEmail(
          req.body.fallback_email
        );

      if (!fallbackEmail) {
        return res.status(400).json({
          ok: false,
          error:
            "بريد fallback غير صحيح."
        });
      }

      body.fallback_email = fallbackEmail;
    }

    // Optional custom OTP.
    // Only accept digits and do not log it.
    if (req.body?.otp !== undefined) {
      const otp = safeString(
        req.body.otp
      ).trim();

      if (!/^\d+$/.test(otp)) {
        return res.status(400).json({
          ok: false,
          error:
            "رمز OTP المخصص يجب أن يحتوي على أرقام فقط."
        });
      }

      body.otp = otp;
    }

    console.log(
      `Authentica: sending ${method} OTP`
    );

    const response = await fetch(
      AUTHENTICA_SEND_OTP_URL,
      {
        method: "POST",
        headers: {
          "X-Authorization":
            AUTHENTICA_API_KEY,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    const data =
      await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "Authentica SEND OTP failed:",
        response.status,
        JSON.stringify(data)
      );

      return res.status(502).json({
        ok: false,
        error:
          "لم تتمكن Authentica من إرسال رمز التحقق."
      });
    }

    return res.json({
      ok: true,
      message:
        "تم إرسال رمز التحقق."
    });
  } catch (error) {
    console.error(
      "AUTHENTICA SEND OTP ERROR:",
      error instanceof Error
        ? error.message
        : error
    );

    return res.status(500).json({
      ok: false,
      error:
        "حدث خطأ أثناء إرسال رمز التحقق."
    });
  }
});

// ======================================================
// AUTHENTICA - VERIFY OTP
// ======================================================

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    if (!AUTHENTICA_API_KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "AUTHENTICA_API_KEY is not configured on the server."
      });
    }

    const otp = safeString(
      req.body?.otp
    ).trim();

    if (!otp) {
      return res.status(400).json({
        ok: false,
        error:
          "أدخل رمز التحقق."
      });
    }

    if (!/^\d+$/.test(otp)) {
      return res.status(400).json({
        ok: false,
        error:
          "رمز التحقق يجب أن يحتوي على أرقام فقط."
      });
    }

    const body = {
      otp
    };

    // Authentica accepts phone when SMS/WhatsApp
    // is the primary or fallback channel.
    if (req.body?.phone) {
      const phone = validatePhone(
        req.body.phone
      );

      if (!phone) {
        return res.status(400).json({
          ok: false,
          error:
            "رقم الهاتف غير صحيح."
        });
      }

      body.phone = phone;
    }

    // Authentica accepts email when email is used.
    if (req.body?.email) {
      const email = validateEmail(
        req.body.email
      );

      if (!email) {
        return res.status(400).json({
          ok: false,
          error:
            "البريد الإلكتروني غير صحيح."
        });
      }

      body.email = email;
    }

    if (!body.phone && !body.email) {
      return res.status(400).json({
        ok: false,
        error:
          "أرسل رقم الهاتف أو البريد الإلكتروني."
      });
    }

    console.log(
      "Authentica: verifying OTP"
    );

    const response = await fetch(
      AUTHENTICA_VERIFY_OTP_URL,
      {
        method: "POST",
        headers: {
          "X-Authorization":
            AUTHENTICA_API_KEY,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    const data =
      await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "Authentica VERIFY OTP failed:",
        response.status,
        JSON.stringify(data)
      );

      return res.status(401).json({
        ok: false,
        verified: false,
        error:
          "رمز التحقق غير صحيح أو انتهت صلاحيته."
      });
    }

    return res.json({
      ok: true,
      verified: true,
      message:
        "تم التحقق بنجاح."
    });
  } catch (error) {
    console.error(
      "AUTHENTICA VERIFY OTP ERROR:",
      error instanceof Error
        ? error.message
        : error
    );

    return res.status(500).json({
      ok: false,
      verified: false,
      error:
        "حدث خطأ أثناء التحقق من الرمز."
    });
  }
});

// ======================================================
// AUTHENTICA - BALANCE
// Optional server-side endpoint
// ======================================================

app.get("/api/auth/balance", async (req, res) => {
  try {
    if (!AUTHENTICA_API_KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "AUTHENTICA_API_KEY is not configured."
      });
    }

    const response = await fetch(
      AUTHENTICA_BALANCE_URL,
      {
        method: "GET",
        headers: {
          "X-Authorization":
            AUTHENTICA_API_KEY,
          Accept: "application/json"
        }
      }
    );

    const data =
      await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error:
          "تعذر الحصول على رصيد Authentica."
      });
    }

    return res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error(
      "AUTHENTICA BALANCE ERROR:",
      error instanceof Error
        ? error.message
        : error
    );

    return res.status(500).json({
      ok: false,
      error:
        "حدث خطأ أثناء قراءة الرصيد."
    });
  }
});

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/api/health", (req, res) => {
  return res.json({
    ok: true,
    service: "Chat AI Pro",

    providers: {
      gemini: Boolean(GEMINI_API_KEY),
      groq: Boolean(GROQ_API_KEY),
      openrouter: Boolean(OPENROUTER_API_KEY),
      authentica: Boolean(AUTHENTICA_API_KEY)
    },

    models: {
      gemini: GEMINI_MODEL,
      groq: GROQ_MODEL,
      openrouter: OPENROUTER_MODEL
    }
  });
});

// ======================================================
// Root
// ======================================================

app.get("/", (req, res) => {
  res.sendFile(
    require("path").join(
      __dirname,
      "index.html"
    )
  );
});

// ======================================================
// 404
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not Found"
  });
});

// ======================================================
// Error handler
// ======================================================

app.use((err, req, res, next) => {
  console.error(
    "SERVER ERROR:",
    err instanceof Error
      ? err.message
      : err
  );

  res.status(500).json({
    ok: false,
    error:
      "حدث خطأ داخلي في الخادم."
  });
});

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {
  console.log(
    `Chat AI Pro running on port ${PORT}`
  );

  console.log(
    `Gemini: ${GEMINI_API_KEY ? "configured" : "missing"}`
  );

  console.log(
    `Groq: ${GROQ_API_KEY ? "configured" : "missing"}`
  );

  console.log(
    `OpenRouter: ${
      OPENROUTER_API_KEY
        ? "configured"
        : "missing"
    }`
  );

  console.log(
    `Authentica: ${
      AUTHENTICA_API_KEY
        ? "configured"
        : "missing"
    }`
  );
});
