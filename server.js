const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const crypto = require("crypto");

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ======================================================
// BASIC CONFIG
// ======================================================

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ======================================================
// FIREBASE ADMIN
// ======================================================

let firebaseApp = null;
let firebaseAuth = null;

function cleanPrivateKey(value) {
  if (!value) return "";

  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");
}

function initializeFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    console.log("Firebase Admin: NOT configured");
    return;
  }

  try {
    firebaseApp = initializeApp({
      credential: cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey
      })
    });

    firebaseAuth = getAuth(firebaseApp);

    console.log("Firebase Admin: configured");
  } catch (error) {
    console.error(
      "Firebase Admin initialization failed:",
      error.message
    );
  }
}

initializeFirebase();

// ======================================================
// HELPERS
// ======================================================

function cleanPhone(phone) {
  if (!phone) return "";

  return String(phone)
    .trim()
    .replace(/[^\d+]/g, "");
}

function phoneToUid(phone) {
  const normalized = cleanPhone(phone);

  const hash = crypto
    .createHash("sha256")
    .update(normalized)
    .digest("hex");

  return `phone_${hash}`;
}

function normalizeMessages(messages, message) {
  if (Array.isArray(messages) && messages.length > 0) {
    return messages
      .filter(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof item.content === "string"
      )
      .map((item) => ({
        role:
          item.role === "assistant" ||
          item.role === "system"
            ? item.role
            : "user",
        content: item.content
      }));
  }

  if (message) {
    return [
      {
        role: "user",
        content: String(message)
      }
    ];
  }

  return [];
}

function extractBearerToken(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.substring(7).trim();
}

// ======================================================
// FIREBASE AUTH MIDDLEWARE
// ======================================================

async function requireFirebaseAuth(req, res, next) {
  try {
    if (!firebaseAuth) {
      return res.status(503).json({
        ok: false,
        error: "Firebase Admin is not configured"
      });
    }

    const token = extractBearerToken(req);

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Missing Firebase ID token"
      });
    }

    const decodedToken = await firebaseAuth.verifyIdToken(token);

    req.user = decodedToken;

    next();
  } catch (error) {
    console.error(
      "Firebase token verification failed:",
      error.message
    );

    return res.status(401).json({
      ok: false,
      error: "Invalid or expired Firebase ID token"
    });
  }
}

// ======================================================
// HEALTH
// ======================================================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Chat AI Pro",

    providers: {
      gemini: !!process.env.GEMINI_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      authentica: !!process.env.AUTHENTICA_API_KEY
    },

    firebase: !!firebaseAuth,

    models: {
      gemini: "gemini-3.8-flash",
      groq: "openai/gpt-oss-20b",
      openrouter: "openrouter/free"
    }
  });
});

// ======================================================
// AUTHENTICA - SEND WHATSAPP OTP
// ======================================================

app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const apiKey = process.env.AUTHENTICA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "Authentica API key is missing"
      });
    }

    const phone = cleanPhone(req.body.phone);

    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: "Phone number is required"
      });
    }

    console.log("Authentica: sending whatsapp OTP");

    const response = await fetch(
      "https://api.authentica.sa/api/v2/send-otp",
      {
        method: "POST",

        headers: {
          "X-Authorization": apiKey,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          method: "whatsapp",
          phone: phone,
          template_id: 1
        })
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        raw: text
      };
    }

    if (!response.ok) {
      console.error(
        "Authentica SEND OTP failed:",
        response.status,
        data
      );

      return res.status(response.status).json({
        ok: false,
        error:
          data.message ||
          data.error ||
          "Failed to send OTP",
        details: data
      });
    }

    return res.json({
      ok: true,
      message:
        data.message ||
        "OTP sent successfully",
      data
    });
  } catch (error) {
    console.error(
      "Authentica SEND OTP error:",
      error.message
    );

    return res.status(500).json({
      ok: false,
      error: "Failed to send OTP"
    });
  }
});

// ======================================================
// AUTHENTICA - VERIFY OTP
// ======================================================

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    if (!firebaseAuth) {
      return res.status(503).json({
        ok: false,
        error: "Firebase Admin is not configured"
      });
    }

    const apiKey = process.env.AUTHENTICA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "Authentica API key is missing"
      });
    }

    const phone = cleanPhone(req.body.phone);
    const otp = String(req.body.otp || "").trim();

    if (!phone || !otp) {
      return res.status(400).json({
        ok: false,
        error: "Phone and OTP are required"
      });
    }

    console.log("Authentica: verifying whatsapp OTP");

    const response = await fetch(
      "https://api.authentica.sa/api/v2/verify-otp",
      {
        method: "POST",

        headers: {
          "X-Authorization": apiKey,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          phone: phone,
          otp: otp
        })
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        raw: text
      };
    }

    if (!response.ok || data.success === false) {
      console.error(
        "Authentica VERIFY OTP failed:",
        response.status,
        data
      );

      return res.status(401).json({
        ok: false,
        error:
          data.message ||
          data.error ||
          "Invalid OTP",
        details: data
      });
    }

    // ----------------------------------------------
    // Create deterministic Firebase UID from phone
    // ----------------------------------------------

    const uid = phoneToUid(phone);

    let userRecord;

    try {
      userRecord = await firebaseAuth.getUser(uid);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        userRecord = await firebaseAuth.createUser({
          uid: uid,
          phoneNumber: phone
        });
      } else {
        throw error;
      }
    }

    // ----------------------------------------------
    // Create Firebase Custom Token
    // ----------------------------------------------

    const customToken =
      await firebaseAuth.createCustomToken(
        userRecord.uid
      );

    return res.json({
      ok: true,
      uid: userRecord.uid,
      phone: phone,
      token: customToken
    });
  } catch (error) {
    console.error(
      "Authentica VERIFY OTP error:",
      error.message
    );

    return res.status(500).json({
      ok: false,
      error: "Failed to verify OTP"
    });
  }
});

// ======================================================
// AUTHENTICA - BALANCE
// ======================================================

app.get("/api/auth/balance", async (req, res) => {
  try {
    const apiKey = process.env.AUTHENTICA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "Authentica API key is missing"
      });
    }

    const response = await fetch(
      "https://api.authentica.sa/api/v2/balance",
      {
        method: "GET",

        headers: {
          "X-Authorization": apiKey,
          "Accept": "application/json"
        }
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        raw: text
      };
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error(
      "Authentica balance error:",
      error.message
    );

    return res.status(500).json({
      ok: false,
      error: "Failed to get Authentica balance"
    });
  }
});

// ======================================================
// GEMINI
// ======================================================

async function askGemini(messages) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key is missing");
  }

  const conversation = messages
    .map((item) => {
      const role =
        item.role === "assistant"
          ? "Assistant"
          : "User";

      return `${role}: ${item.content}`;
    })
    .join("\n\n");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },

      body: JSON.stringify({
        model: "gemini-3.8-flash",
        input: conversation
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Gemini ${response.status}: ${
        data.error?.message ||
        JSON.stringify(data)
      }`
    );
  }

  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  // Fallback for structured response
  const textParts = [];

  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      if (
        step.type === "model_output" &&
        Array.isArray(step.content)
      ) {
        for (const content of step.content) {
          if (
            content.type === "text" &&
            typeof content.text === "string"
          ) {
            textParts.push(content.text);
          }
        }
      }
    }
  }

  const finalText = textParts.join("");

  if (!finalText) {
    throw new Error(
      "Gemini returned an empty response"
    );
  }

  return finalText;
}

// ======================================================
// GROQ
// ======================================================

async function askGroq(messages) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("Groq API key is missing");
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },

      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: messages,
        temperature: 0.7,
        max_completion_tokens: 4096
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Groq ${response.status}: ${
        data.error?.message ||
        JSON.stringify(data)
      }`
    );
  }

  const text =
    data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(
      "Groq returned an empty response"
    );
  }

  return text;
}

// ======================================================
// OPENROUTER
// ======================================================

async function askOpenRouter(messages) {
  const apiKey =
    process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenRouter API key is missing"
    );
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer":
          "https://chat-ai-pro-ymod.onrender.com",
        "X-Title": "Chat AI Pro"
      },

      body: JSON.stringify({
        model: "openrouter/free",
        messages: messages
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `OpenRouter ${response.status}: ${
        data.error?.message ||
        JSON.stringify(data)
      }`
    );
  }

  const text =
    data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(
      "OpenRouter returned an empty response"
    );
  }

  return text;
}

// ======================================================
// CHAT
// Gemini → Groq → OpenRouter
// ======================================================

app.post(
  "/api/chat",
  requireFirebaseAuth,
  async (req, res) => {
    try {
      const messages = normalizeMessages(
        req.body.messages,
        req.body.message || req.body.prompt
      );

      if (messages.length === 0) {
        return res.status(400).json({
          ok: false,
          error: "Message is required"
        });
      }

      let lastError = null;

      // ----------------------------------------------
      // 1. Gemini
      // ----------------------------------------------

      if (process.env.GEMINI_API_KEY) {
        try {
          console.log("AI provider: Gemini");

          const answer =
            await askGemini(messages);

          return res.json({
            ok: true,
            provider: "gemini",
            answer: answer
          });
        } catch (error) {
          lastError = error;

          console.error(
            "Gemini failed:",
            error.message
          );
        }
      }

      // ----------------------------------------------
      // 2. Groq
      // ----------------------------------------------

      if (process.env.GROQ_API_KEY) {
        try {
          console.log("AI provider: Groq");

          const answer =
            await askGroq(messages);

          return res.json({
            ok: true,
            provider: "groq",
            answer: answer
          });
        } catch (error) {
          lastError = error;

          console.error(
            "Groq failed:",
            error.message
          );
        }
      }

      // ----------------------------------------------
      // 3. OpenRouter
      // ----------------------------------------------

      if (process.env.OPENROUTER_API_KEY) {
        try {
          console.log(
            "AI provider: OpenRouter"
          );

          const answer =
            await askOpenRouter(messages);

          return res.json({
            ok: true,
            provider: "openrouter",
            answer: answer
          });
        } catch (error) {
          lastError = error;

          console.error(
            "OpenRouter failed:",
            error.message
          );
        }
      }

      return res.status(503).json({
        ok: false,
        error:
          "All AI providers failed",
        details: lastError
          ? lastError.message
          : "No AI provider is configured"
      });
    } catch (error) {
      console.error(
        "Chat error:",
        error.message
      );

      return res.status(500).json({
        ok: false,
        error: "Chat request failed"
      });
    }
  }
);

// ======================================================
// FRONTEND
// ======================================================

app.use(express.static(__dirname));

app.get("/{*splat}", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {
  console.log(
    `Chat AI Pro running on port ${PORT}`
  );

  console.log(
    `Gemini: ${
      process.env.GEMINI_API_KEY
        ? "configured"
        : "missing"
    }`
  );

  console.log(
    `Groq: ${
      process.env.GROQ_API_KEY
        ? "configured"
        : "missing"
    }`
  );

  console.log(
    `OpenRouter: ${
      process.env.OPENROUTER_API_KEY
        ? "configured"
        : "missing"
    }`
  );

  console.log(
    `Authentica: ${
      process.env.AUTHENTICA_API_KEY
        ? "configured"
        : "missing"
    }`
  );

  console.log(
    `Firebase: ${
      firebaseAuth
        ? "configured"
        : "missing"
    }`
  );
});
