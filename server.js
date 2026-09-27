const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const {
  initializeApp,
  cert,
  getApps
} = require("firebase-admin/app");

const {
  getAuth
} = require("firebase-admin/auth");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

/* =========================================================
   CONFIG
========================================================= */

const PORT = process.env.PORT || 10000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AUTHENTICA_API_KEY = process.env.AUTHENTICA_API_KEY;

/* =========================================================
   FIREBASE ADMIN
========================================================= */

let firebaseReady = false;
let firebaseAuth = null;

try {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(
      /\\n/g,
      "\n"
    );

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey
        })
      });
    }

    firebaseAuth = getAuth();
    firebaseReady = true;

    console.log("Firebase Admin: configured");
  } else {
    console.log("Firebase Admin: missing environment variables");
  }
} catch (error) {
  console.error(
    "Firebase Admin initialization failed:",
    error.message
  );
}

/* =========================================================
   BASIC INFO
========================================================= */

console.log("Gemini:", GEMINI_API_KEY ? "configured" : "missing");
console.log("Groq:", GROQ_API_KEY ? "configured" : "missing");
console.log(
  "OpenRouter:",
  OPENROUTER_API_KEY ? "configured" : "missing"
);
console.log(
  "Authentica:",
  AUTHENTICA_API_KEY ? "configured" : "missing"
);
console.log(
  "Firebase:",
  firebaseReady ? "configured" : "missing"
);

/* =========================================================
   HEALTH
========================================================= */

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

    firebase: firebaseReady,

    models: {
      gemini: "gemini-3.8-flash",
      groq: "openai/gpt-oss-20b",
      openrouter: "openrouter/free"
    }
  });
});

/* =========================================================
   FIREBASE AUTH MIDDLEWARE
========================================================= */

async function requireFirebaseAuth(req, res, next) {
  try {
    if (!firebaseAuth) {
      return res.status(500).json({
        success: false,
        message: "Firebase Admin غير مهيأ على الخادم."
      });
    }

    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "لم يتم إرسال رمز تسجيل الدخول."
      });
    }

    const idToken = authorization.substring(7).trim();

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message: "رمز تسجيل الدخول فارغ."
      });
    }

    const decodedToken = await firebaseAuth.verifyIdToken(idToken);

    req.user = decodedToken;

    next();
  } catch (error) {
    console.error(
      "Firebase authentication failed:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message: "جلسة تسجيل الدخول غير صالحة أو منتهية."
    });
  }
}

/* =========================================================
   AUTHENTICA - SEND OTP
========================================================= */

app.post("/api/auth/send-otp", async (req, res) => {
  try {
    if (!AUTHENTICA_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "AUTHENTICA_API_KEY غير موجود."
      });
    }

    const {
      method = "whatsapp",
      phone,
      email,
      template_id,
      fallback_phone,
      fallback_email,
      otp
    } = req.body || {};

    if (method === "email" && !email) {
      return res.status(400).json({
        success: false,
        message: "البريد الإلكتروني مطلوب."
      });
    }

    if (
      (method === "whatsapp" || method === "sms") &&
      !phone
    ) {
      return res.status(400).json({
        success: false,
        message: "رقم الهاتف مطلوب."
      });
    }

    const body = {
      method
    };

    if (phone) body.phone = phone;
    if (email) body.email = email;

    if (template_id !== undefined) {
      body.template_id = template_id;
    }

    if (fallback_phone) {
      body.fallback_phone = fallback_phone;
    }

    if (fallback_email) {
      body.fallback_email = fallback_email;
    }

    if (otp) {
      body.otp = otp;
    }

    console.log(
      "Authentica: sending",
      method,
      "OTP"
    );

    const response = await fetch(
      "https://api.authentica.sa/api/v2/send-otp",
      {
        method: "POST",

        headers: {
          "X-Authorization": AUTHENTICA_API_KEY,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },

        body: JSON.stringify(body)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "Authentica SEND OTP failed:",
        response.status,
        JSON.stringify(data)
      );

      return res.status(response.status).json({
        success: false,
        message:
          data?.message ||
          "فشل إرسال رمز التحقق.",
        details: data
      });
    }

    return res.json({
      success: true,
      message:
        data?.message ||
        "تم إرسال رمز التحقق.",
      data
    });
  } catch (error) {
    console.error(
      "Authentica SEND OTP error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء إرسال رمز التحقق."
    });
  }
});

/* =========================================================
   AUTHENTICA - VERIFY OTP
========================================================= */

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    if (!AUTHENTICA_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "AUTHENTICA_API_KEY غير موجود."
      });
    }

    const {
      phone,
      email,
      otp
    } = req.body || {};

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "رمز التحقق مطلوب."
      });
    }

    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: "رقم الهاتف أو البريد الإلكتروني مطلوب."
      });
    }

    const body = {
      otp: String(otp)
    };

    if (phone) body.phone = phone;
    if (email) body.email = email;

    console.log(
      "Authentica: verifying OTP"
    );

    const response = await fetch(
      "https://api.authentica.sa/api/v2/verify-otp",
      {
        method: "POST",

        headers: {
          "X-Authorization": AUTHENTICA_API_KEY,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },

        body: JSON.stringify(body)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "Authentica VERIFY OTP failed:",
        response.status,
        JSON.stringify(data)
      );

      return res.status(response.status).json({
        success: false,
        message:
          data?.message ||
          "رمز التحقق غير صحيح.",
        details: data
      });
    }

    console.log(
      "Authentica OTP verified successfully."
    );

    /* -----------------------------------------
       Create Firebase Custom Token
    ----------------------------------------- */

    if (!firebaseAuth) {
      return res.status(500).json({
        success: false,
        message:
          "تم التحقق من OTP، لكن Firebase غير مهيأ."
      });
    }

    const identifier =
      phone ||
      email ||
      `user_${Date.now()}`;

    const uid =
      "authentica_" +
      Buffer.from(identifier)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 100);

    const customToken =
      await firebaseAuth.createCustomToken(uid, {
        provider: "authentica"
      });

    console.log(
      "Firebase custom token created."
    );

    return res.json({
      success: true,
      message: "تم التحقق بنجاح.",
      token: customToken,
      user: {
        uid
      }
    });

  } catch (error) {
    console.error(
      "Authentica VERIFY OTP error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "حدث خطأ أثناء التحقق من رمز OTP."
    });
  }
});

/* =========================================================
   GEMINI
========================================================= */

async function askGemini(messages) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing."
    );
  }

  const contents = messages
    .filter(
      message =>
        message &&
        message.content &&
        String(message.content).trim()
    )
    .map(message => ({
      role:
        message.role === "assistant"
          ? "model"
          : "user",

      parts: [
        {
          text: String(message.content)
        }
      ]
    }));

  if (contents.length === 0) {
    throw new Error(
      "No valid messages were provided to Gemini."
    );
  }

  console.log(
    "Gemini: sending request..."
  );

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },

      body: JSON.stringify({
        contents
      })
    }
  );

  const data =
    await response.json().catch(() => ({}));

  /* -----------------------------------------
     Safe diagnostic logs
  ----------------------------------------- */

  console.log(
    "Gemini HTTP status:",
    response.status
  );

  console.log(
    "Gemini response keys:",
    Object.keys(data || {})
  );

  console.log(
    "Gemini candidates:",
    Array.isArray(data?.candidates)
      ? data.candidates.length
      : 0
  );

  if (data?.promptFeedback) {
    console.log(
      "Gemini promptFeedback:",
      JSON.stringify(data.promptFeedback)
    );
  }

  /* -----------------------------------------
     API error
  ----------------------------------------- */

  if (!response.ok) {
    console.error(
      "Gemini API error:",
      JSON.stringify(data)
    );

    throw new Error(
      data?.error?.message ||
      `Gemini HTTP ${response.status}`
    );
  }

  /* -----------------------------------------
     Extract response
  ----------------------------------------- */

  const reply =
    data?.candidates?.[0]?.content?.parts
      ?.map(part => part?.text || "")
      .join("")
      .trim();

  if (!reply) {
    console.error(
      "Gemini returned no text:",
      JSON.stringify({
        candidates: data?.candidates,
        promptFeedback: data?.promptFeedback
      })
    );

    throw new Error(
      "Gemini returned an empty response."
    );
  }

  console.log(
    "Gemini reply received successfully."
  );

  return reply;
}

/* =========================================================
   GROQ
========================================================= */

async function askGroq(messages) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is missing."
    );
  }

  const formattedMessages = messages
    .filter(
      message =>
        message &&
        message.content
    )
    .map(message => ({
      role:
        message.role === "assistant"
          ? "assistant"
          : "user",

      content: String(message.content)
    }));

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization":
          `Bearer ${apiKey}`
      },

      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: formattedMessages,
        temperature: 0.7
      })
    }
  );

  const data =
    await response.json().catch(() => ({}));

  console.log(
    "Groq HTTP status:",
    response.status
  );

  if (!response.ok) {
    console.error(
      "Groq API error:",
      JSON.stringify(data)
    );

    throw new Error(
      data?.error?.message ||
      `Groq HTTP ${response.status}`
    );
  }

  const reply =
    data?.choices?.[0]?.message?.content
      ?.trim();

  if (!reply) {
    throw new Error(
      "Groq returned an empty response."
    );
  }

  console.log(
    "Groq reply received successfully."
  );

  return reply;
}

/* =========================================================
   OPENROUTER
========================================================= */

async function askOpenRouter(messages) {
  const apiKey =
    process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is missing."
    );
  }

  const formattedMessages = messages
    .filter(
      message =>
        message &&
        message.content
    )
    .map(message => ({
      role:
        message.role === "assistant"
          ? "assistant"
          : "user",

      content: String(message.content)
    }));

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization":
          `Bearer ${apiKey}`,
        "HTTP-Referer":
          "https://chat-ai-pro-ymod.onrender.com",
        "X-Title":
          "Chat AI Pro"
      },

      body: JSON.stringify({
        model: "openrouter/free",
        messages: formattedMessages
      })
    }
  );

  const data =
    await response.json().catch(() => ({}));

  console.log(
    "OpenRouter HTTP status:",
    response.status
  );

  if (!response.ok) {
    console.error(
      "OpenRouter API error:",
      JSON.stringify(data)
    );

    throw new Error(
      data?.error?.message ||
      `OpenRouter HTTP ${response.status}`
    );
  }

  const reply =
    data?.choices?.[0]?.message?.content
      ?.trim();

  if (!reply) {
    throw new Error(
      "OpenRouter returned an empty response."
    );
  }

  console.log(
    "OpenRouter reply received successfully."
  );

  return reply;
}

/* =========================================================
   CHAT
========================================================= */

app.post(
  "/api/chat",
  requireFirebaseAuth,
  async (req, res) => {
    const messages =
      Array.isArray(req.body?.messages)
        ? req.body.messages
        : [];

    if (messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "لا توجد رسائل."
      });
    }

    console.log(
      "AI provider: Gemini"
    );

    /* -----------------------------------------
       1. Gemini
    ----------------------------------------- */

    try {
      const reply =
        await askGemini(messages);

      return res.json({
        success: true,
        provider: "gemini",
        reply
      });

    } catch (error) {
      console.error(
        "Gemini failed:",
        error.message
      );
    }

    /* -----------------------------------------
       2. Groq
    ----------------------------------------- */

    console.log(
      "AI provider: Groq fallback"
    );

    try {
      const reply =
        await askGroq(messages);

      return res.json({
        success: true,
        provider: "groq",
        reply
      });

    } catch (error) {
      console.error(
        "Groq failed:",
        error.message
      );
    }

    /* -----------------------------------------
       3. OpenRouter
    ----------------------------------------- */

    console.log(
      "AI provider: OpenRouter fallback"
    );

    try {
      const reply =
        await askOpenRouter(messages);

      return res.json({
        success: true,
        provider: "openrouter",
        reply
      });

    } catch (error) {
      console.error(
        "OpenRouter failed:",
        error.message
      );
    }

    /* -----------------------------------------
       All providers failed
    ----------------------------------------- */

    return res.status(503).json({
      success: false,
      message:
        "تعذر الحصول على رد من خدمات الذكاء الاصطناعي حاليًا."
    });
  }
);

/* =========================================================
   ROOT
========================================================= */

app.get("/", (req, res) => {
  res.json({
    service: "Chat AI Pro",
    status: "online"
  });
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log(
    `Chat AI Pro running on port ${PORT}`
  );
});
