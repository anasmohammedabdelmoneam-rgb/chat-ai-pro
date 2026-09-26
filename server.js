require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;

// ======================================================
// API KEYS
// ======================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AUTHENTICA_API_KEY = process.env.AUTHENTICA_API_KEY;

// ======================================================
// AUTHENTICA
// ======================================================

const AUTHENTICA_SEND_URL =
  "https://api.authentica.sa/api/v2/send-otp";

const AUTHENTICA_VERIFY_URL =
  "https://api.authentica.sa/api/v2/verify-otp";

const AUTHENTICA_BALANCE_URL =
  "https://api.authentica.sa/api/v2/balance";

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

// Serve frontend files
app.use(express.static(path.join(__dirname)));

// ======================================================
// HELPERS
// ======================================================

function normalizeSaudiPhone(phone) {
  if (!phone) {
    return null;
  }

  let value = String(phone).trim();

  value = value.replace(/[\s\-()]/g, "");

  // 05XXXXXXXX
  if (/^05\d{8}$/.test(value)) {
    return "+966" + value.substring(1);
  }

  // 5XXXXXXXX
  if (/^5\d{8}$/.test(value)) {
    return "+966" + value;
  }

  // 9665XXXXXXXX
  if (/^9665\d{8}$/.test(value)) {
    return "+" + value;
  }

  // +9665XXXXXXXX
  if (/^\+9665\d{8}$/.test(value)) {
    return value;
  }

  return null;
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text
    };
  }
}

function getApiMessage(data, fallback) {
  if (!data) {
    return fallback;
  }

  return (
    data.message ||
    data.error ||
    data.raw ||
    fallback
  );
}

// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

// ======================================================
// HEALTH
// ======================================================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Chat AI Pro",

    providers: {
      gemini: !!GEMINI_API_KEY,
      groq: !!GROQ_API_KEY,
      openrouter: !!OPENROUTER_API_KEY,
      authentica: !!AUTHENTICA_API_KEY
    },

    models: {
      gemini: "gemini-3.8-flash",
      groq: "openai/gpt-oss-20b",
      openrouter: "openrouter/free"
    },

    authenticaChannel: "whatsapp"
  });
});

// ======================================================
// AUTHENTICA - SEND WHATSAPP OTP
// ======================================================

app.post("/api/auth/send-otp", async (req, res) => {
  try {
    if (!AUTHENTICA_API_KEY) {
      return res.status(500).json({
        success: false,
        message:
          "AUTHENTICA_API_KEY غير موجود في إعدادات Render."
      });
    }

    const phone = normalizeSaudiPhone(
      req.body.phone
    );

    if (!phone) {
      return res.status(400).json({
        success: false,
        message:
          "رقم الجوال السعودي غير صحيح."
      });
    }

    console.log(
      "Authentica: sending WhatsApp OTP to",
      phone
    );

    const payload = {
      method: "whatsapp",
      phone: phone
    };

    const response = await fetch(
      AUTHENTICA_SEND_URL,
      {
        method: "POST",

        headers: {
          "X-Authorization": AUTHENTICA_API_KEY,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },

        body: JSON.stringify(payload)
      }
    );

    const data = await parseResponse(response);

    if (!response.ok || data.success === false) {
      console.error(
        "Authentica WHATSAPP OTP failed:",
        response.status,
        JSON.stringify(data)
      );

      return res.status(
        response.status || 500
      ).json({
        success: false,
        message: getApiMessage(
          data,
          "تعذر إرسال رمز التحقق عبر WhatsApp."
        )
      });
    }

    console.log(
      "Authentica: WhatsApp OTP sent successfully"
    );

    return res.json({
      success: true,
      message:
        "تم إرسال رمز التحقق عبر WhatsApp."
    });

  } catch (error) {
    console.error(
      "Authentica send OTP error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "حدث خطأ أثناء الاتصال بخدمة Authentica."
    });
  }
});

// ======================================================
// AUTHENTICA - VERIFY OTP
// ======================================================

app.post(
  "/api/auth/verify-otp",
  async (req, res) => {
    try {
      if (!AUTHENTICA_API_KEY) {
        return res.status(500).json({
          success: false,
          message:
            "AUTHENTICA_API_KEY غير موجود في Render."
        });
      }

      const phone = normalizeSaudiPhone(
        req.body.phone
      );

      const otp = String(
        req.body.otp || ""
      ).trim();

      if (!phone) {
        return res.status(400).json({
          success: false,
          message:
            "رقم الجوال غير صحيح."
        });
      }

      if (!/^\d{4,8}$/.test(otp)) {
        return res.status(400).json({
          success: false,
          message:
            "رمز التحقق غير صحيح."
        });
      }

      console.log(
        "Authentica: verifying WhatsApp OTP"
      );

      const payload = {
        phone: phone,
        otp: otp
      };

      const response = await fetch(
        AUTHENTICA_VERIFY_URL,
        {
          method: "POST",

          headers: {
            "X-Authorization":
              AUTHENTICA_API_KEY,
            "Accept":
              "application/json",
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify(payload)
        }
      );

      const data = await parseResponse(
        response
      );

      if (
        !response.ok ||
        data.success === false
      ) {
        console.error(
          "Authentica VERIFY failed:",
          response.status,
          JSON.stringify(data)
        );

        return res.status(
          response.status || 400
        ).json({
          success: false,
          message: getApiMessage(
            data,
            "رمز التحقق غير صحيح أو انتهت صلاحيته."
          )
        });
      }

      console.log(
        "Authentica: OTP verified successfully"
      );

      return res.json({
        success: true,
        message:
          "تم التحقق من رقم الجوال بنجاح."
      });

    } catch (error) {
      console.error(
        "Authentica verify error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "حدث خطأ أثناء التحقق من رمز OTP."
      });
    }
  }
);

// ======================================================
// AUTHENTICA - BALANCE
// ======================================================

app.get(
  "/api/auth/balance",
  async (req, res) => {
    try {
      if (!AUTHENTICA_API_KEY) {
        return res.status(500).json({
          success: false,
          message:
            "AUTHENTICA_API_KEY غير موجود."
        });
      }

      const response = await fetch(
        AUTHENTICA_BALANCE_URL,
        {
          method: "GET",

          headers: {
            "X-Authorization":
              AUTHENTICA_API_KEY,
            "Accept":
              "application/json"
          }
        }
      );

      const data = await parseResponse(
        response
      );

      return res
        .status(response.status)
        .json(data);

    } catch (error) {
      console.error(
        "Authentica balance error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "تعذر الاتصال بخدمة Authentica."
      });
    }
  }
);

// ======================================================
// GEMINI
// ======================================================

async function askGemini(message) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Gemini API key is not configured"
    );
  }

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1/interactions",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "x-goog-api-key":
          GEMINI_API_KEY
      },

      body: JSON.stringify({
        model: "gemini-3.8-flash",

        input: message
      })
    }
  );

  const data = await parseResponse(
    response
  );

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        data,
        `Gemini HTTP ${response.status}`
      )
    );
  }

  const answer =
    data.output_text ||
    data.output?.text ||
    data.text;

  if (!answer) {
    throw new Error(
      "Gemini returned an empty response"
    );
  }

  return answer;
}

// ======================================================
// GROQ
// ======================================================

async function askGroq(message) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "Groq API key is not configured"
    );
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Authorization":
          `Bearer ${GROQ_API_KEY}`,

        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        model:
          "openai/gpt-oss-20b",

        messages: [
          {
            role: "system",
            content:
              "You are Chat AI Pro, a helpful, accurate and friendly AI assistant."
          },

          {
            role: "user",
            content: message
          }
        ],

        temperature: 0.7,

        max_tokens: 2048
      })
    }
  );

  const data = await parseResponse(
    response
  );

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        data,
        `Groq HTTP ${response.status}`
      )
    );
  }

  const answer =
    data.choices?.[0]?.message?.content;

  if (!answer) {
    throw new Error(
      "Groq returned an empty response"
    );
  }

  return answer;
}

// ======================================================
// OPENROUTER
// ======================================================

async function askOpenRouter(message) {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OpenRouter API key is not configured"
    );
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Authorization":
          `Bearer ${OPENROUTER_API_KEY}`,

        "Content-Type":
          "application/json",

        "HTTP-Referer":
          "https://chat-ai-pro-ymod.onrender.com",

        "X-Title":
          "Chat AI Pro"
      },

      body: JSON.stringify({
        model: "openrouter/free",

        messages: [
          {
            role: "system",
            content:
              "You are Chat AI Pro, a helpful, accurate and friendly AI assistant."
          },

          {
            role: "user",
            content: message
          }
        ],

        temperature: 0.7,

        max_tokens: 2048
      })
    }
  );

  const data = await parseResponse(
    response
  );

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        data,
        `OpenRouter HTTP ${response.status}`
      )
    );
  }

  const answer =
    data.choices?.[0]?.message?.content;

  if (!answer) {
    throw new Error(
      "OpenRouter returned an empty response"
    );
  }

  return answer;
}

// ======================================================
// CHAT API
// ======================================================

app.post("/api/chat", async (req, res) => {
  console.log("CHAT REQUEST BODY:", req.body);

  let message = "";

  // الطريقة الأساسية
  if (req.body && typeof req.body.message === "string") {
    message = req.body.message.trim();
  }

  // دعم messages إذا أرسلت الواجهة سجل المحادثة
  if (
    !message &&
    req.body &&
    Array.isArray(req.body.messages)
  ) {
    const lastMessage =
      req.body.messages[req.body.messages.length - 1];

    if (
      lastMessage &&
      typeof lastMessage.content === "string"
    ) {
      message = lastMessage.content.trim();
    }
  }

  // دعم prompt أيضًا
  if (
    !message &&
    req.body &&
    typeof req.body.prompt === "string"
  ) {
    message = req.body.prompt.trim();
  }

  console.log("CHAT MESSAGE:", message);

  if (!message) {
    return res.status(400).json({
      success: false,
      message: "اكتب رسالة أولًا."
    });
  }

  const providers = [];

  if (GEMINI_API_KEY) {
    providers.push({
      name: "Gemini",
      function: () => askGemini(message)
    });
  }

  if (GROQ_API_KEY) {
    providers.push({
      name: "Groq",
      function: () => askGroq(message)
    });
  }

  if (OPENROUTER_API_KEY) {
    providers.push({
      name: "OpenRouter",
      function: () => askOpenRouter(message)
    });
  }

  if (providers.length === 0) {
    return res.status(500).json({
      success: false,
      message: "لا توجد خدمة AI مفعّلة."
    });
  }

  for (const provider of providers) {
    try {
      console.log(`AI: trying ${provider.name}`);

      const answer =
        await provider.function();

      console.log(
        `AI: ${provider.name} succeeded`
      );

      return res.json({
        success: true,
        provider: provider.name,
        answer: answer
      });

    } catch (error) {
      console.error(
        `AI: ${provider.name} failed:`,
        error.message
      );
    }
  }

  return res.status(503).json({
    success: false,
    message:
      "جميع خدمات الذكاء الاصطناعي غير متاحة حاليًا. حاول مرة أخرى."
  });
});
  if (!message) {
    return res.status(400).json({
      success: false,
      message:
        "اكتب رسالة أولًا."
    });
  }

  const providers = [];

  if (GEMINI_API_KEY) {
    providers.push({
      name: "Gemini",
      function: () =>
        askGemini(message)
    });
  }

  if (GROQ_API_KEY) {
    providers.push({
      name: "Groq",
      function: () =>
        askGroq(message)
    });
  }

  if (OPENROUTER_API_KEY) {
    providers.push({
      name: "OpenRouter",
      function: () =>
        askOpenRouter(message)
    });
  }

  if (providers.length === 0) {
    return res.status(500).json({
      success: false,
      message:
        "لا توجد خدمة AI مفعّلة."
    });
  }

  for (const provider of providers) {
    try {
      console.log(
        `AI: trying ${provider.name}`
      );

      const answer =
        await provider.function();

      console.log(
        `AI: ${provider.name} succeeded`
      );

      return res.json({
        success: true,
        provider:
          provider.name,
        answer: answer
      });

    } catch (error) {
      console.error(
        `AI: ${provider.name} failed:`,
        error.message
      );
    }
  }

  return res.status(503).json({
    success: false,
    message:
      "جميع خدمات الذكاء الاصطناعي غير متاحة حاليًا. حاول مرة أخرى."
  });
});

// ======================================================
// FRONTEND FALLBACK
// ======================================================

// Express 4 supports this wildcard.
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
  (err, req, res, next) => {
    console.error(
      "Server error:",
      err
    );

    if (res.headersSent) {
      return next(err);
    }

    res.status(500).json({
      success: false,
      message:
        "حدث خطأ داخلي في الخادم."
    });
  }
);

// ======================================================
// START
// ======================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Chat AI Pro running on port ${PORT}`
    );

    console.log(
      `Gemini: ${
        GEMINI_API_KEY
          ? "configured"
          : "not configured"
      }`
    );

    console.log(
      `Groq: ${
        GROQ_API_KEY
          ? "configured"
          : "not configured"
      }`
    );

    console.log(
      `OpenRouter: ${
        OPENROUTER_API_KEY
          ? "configured"
          : "not configured"
      }`
    );

    console.log(
      `Authentica: ${
        AUTHENTICA_API_KEY
          ? "configured"
          : "not configured"
      }`
    );

    console.log(
      "Authentica OTP channel: WhatsApp"
    );
  }
);
