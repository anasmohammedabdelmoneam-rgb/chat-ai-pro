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

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   FIREBASE ADMIN
   ========================================================= */

let firebaseReady = false;
let firebaseAuth = null;

function initializeFirebase() {
    try {
        if (
            !process.env.FIREBASE_PROJECT_ID ||
            !process.env.FIREBASE_CLIENT_EMAIL ||
            !process.env.FIREBASE_PRIVATE_KEY
        ) {
            console.log("Firebase Admin: NOT configured");
            return;
        }

        const privateKey = process.env.FIREBASE_PRIVATE_KEY
            .replace(/\\n/g, "\n");

        const firebaseApp = initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey
            })
        });

        firebaseAuth = getAuth(firebaseApp);
        firebaseReady = true;

        console.log("Firebase Admin: configured");
    } catch (error) {
        console.error("Firebase Admin initialization failed:", error.message);
        firebaseReady = false;
    }
}

initializeFirebase();

/* =========================================================
   ENVIRONMENT VARIABLES
   ========================================================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AUTHENTICA_API_KEY = process.env.AUTHENTICA_API_KEY;

/* =========================================================
   BASIC HELPERS
   ========================================================= */

function cleanPhone(phone) {
    if (!phone) return "";

    let value = String(phone).trim();

    value = value.replace(/[^\d+]/g, "");

    if (!value.startsWith("+")) {
        value = "+" + value;
    }

    return value;
}

function phoneToUid(phone) {
    const normalized = cleanPhone(phone);

    const hash = crypto
        .createHash("sha256")
        .update(normalized)
        .digest("hex");

    return `phone_${hash}`;
}

function normalizeMessages(body) {
    let messages = [];

    if (Array.isArray(body.messages)) {
        messages = body.messages;
    } else if (body.message) {
        messages = [
            {
                role: "user",
                content: String(body.message)
            }
        ];
    } else if (body.prompt) {
        messages = [
            {
                role: "user",
                content: String(body.prompt)
            }
        ];
    }

    return messages
        .filter(Boolean)
        .map((message) => {
            const role =
                message.role === "assistant"
                    ? "assistant"
                    : "user";

            return {
                role,
                content: String(message.content || "").trim()
            };
        })
        .filter((message) => message.content)
        .slice(-30);
}

function getLastUserMessage(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
            return messages[i].content;
        }
    }

    return "";
}

/* =========================================================
   FIREBASE AUTH MIDDLEWARE
   ========================================================= */

async function requireFirebaseUser(req, res, next) {
    try {
        if (!firebaseReady || !firebaseAuth) {
            return res.status(503).json({
                ok: false,
                error: "Firebase authentication is not configured."
            });
        }

        const authorization = req.headers.authorization || "";

        if (!authorization.startsWith("Bearer ")) {
            return res.status(401).json({
                ok: false,
                error: "Authentication required."
            });
        }

        const idToken = authorization.substring(7).trim();

        if (!idToken) {
            return res.status(401).json({
                ok: false,
                error: "Missing authentication token."
            });
        }

        const decodedToken = await firebaseAuth.verifyIdToken(idToken);

        req.firebaseUser = decodedToken;

        next();
    } catch (error) {
        console.error("Firebase auth verification failed:", error.message);

        return res.status(401).json({
            ok: false,
            error: "Invalid or expired authentication."
        });
    }
}

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
            authentica: !!AUTHENTICA_API_KEY,
            firebase: firebaseReady
        },
        models: {
            gemini: "gemini-3.8-flash",
            groq: "openai/gpt-oss-20b",
            openrouter: "openrouter/free"
        }
    });
});

/* =========================================================
   AUTHENTICA - SEND WHATSAPP OTP
   ========================================================= */

app.post("/api/auth/send-otp", async (req, res) => {
    try {
        if (!AUTHENTICA_API_KEY) {
            return res.status(500).json({
                success: false,
                message: "AUTHENTICA_API_KEY is not configured."
            });
        }

        const phone = cleanPhone(req.body.phone);

        if (!phone || phone.length < 8) {
            return res.status(400).json({
                success: false,
                message: "رقم الهاتف غير صحيح."
            });
        }

        console.log("Authentica: sending WhatsApp OTP");

        const response = await fetch(
            "https://api.authentica.sa/api/v2/send-otp",
            {
                method: "POST",
                headers: {
                    "X-Authorization": AUTHENTICA_API_KEY,
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    method: "whatsapp",
                    phone: phone
                })
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
                    data.message ||
                    "تعذر إرسال رمز التحقق.",
                details: data
            });
        }

        return res.json({
            success: true,
            message: "تم إرسال رمز التحقق عبر واتساب."
        });
    } catch (error) {
        console.error("SEND OTP error:", error);

        return res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء إرسال رمز التحقق."
        });
    }
});

/* =========================================================
   AUTHENTICA - VERIFY OTP
   THEN CREATE FIREBASE CUSTOM TOKEN
   ========================================================= */

app.post("/api/auth/verify-otp", async (req, res) => {
    try {
        if (!AUTHENTICA_API_KEY) {
            return res.status(500).json({
                success: false,
                message: "AUTHENTICA_API_KEY is not configured."
            });
        }

        if (!firebaseReady || !firebaseAuth) {
            return res.status(503).json({
                success: false,
                message: "Firebase is not configured on the server."
            });
        }

        const phone = cleanPhone(req.body.phone);
        const otp = String(req.body.otp || "").trim();

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "رقم الهاتف مطلوب."
            });
        }

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: "رمز التحقق مطلوب."
            });
        }

        console.log("Authentica: verifying WhatsApp OTP");

        const response = await fetch(
            "https://api.authentica.sa/api/v2/verify-otp",
            {
                method: "POST",
                headers: {
                    "X-Authorization": AUTHENTICA_API_KEY,
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    phone,
                    otp
                })
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
            console.error(
                "Authentica VERIFY OTP failed:",
                response.status,
                JSON.stringify(data)
            );

            return res.status(response.status || 400).json({
                success: false,
                message:
                    data.message ||
                    "رمز التحقق غير صحيح.",
                details: data
            });
        }

        /*
         * مهم:
         * الرقم نفسه ينتج نفس UID دائمًا.
         * لذلك نفس الرقم = نفس حساب Firebase.
         * رقم مختلف = UID مختلف = حساب مختلف.
         */

        const uid = phoneToUid(phone);

        try {
            await firebaseAuth.getUser(uid);
        } catch (error) {
            if (error.code === "auth/user-not-found") {
                await firebaseAuth.createUser({
                    uid: uid
                });
            } else {
                throw error;
            }
        }

        const customToken =
            await firebaseAuth.createCustomToken(uid);

        return res.json({
            success: true,
            authenticated: true,
            customToken,
            uid
        });
    } catch (error) {
        console.error("VERIFY OTP error:", error);

        return res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء التحقق."
        });
    }
});

/* =========================================================
   AUTHENTICA - BALANCE
   ========================================================= */

app.get("/api/auth/balance", async (req, res) => {
    try {
        if (!AUTHENTICA_API_KEY) {
            return res.status(500).json({
                success: false,
                message: "AUTHENTICA_API_KEY is not configured."
            });
        }

        const response = await fetch(
            "https://api.authentica.sa/api/v2/balance",
            {
                method: "GET",
                headers: {
                    "X-Authorization": AUTHENTICA_API_KEY,
                    "Accept": "application/json"
                }
            }
        );

        const data = await response.json().catch(() => ({}));

        return res.status(response.status).json(data);
    } catch (error) {
        console.error("Balance error:", error);

        return res.status(500).json({
            success: false,
            message: "تعذر جلب الرصيد."
        });
    }
});

/* =========================================================
   GEMINI
   ========================================================= */

async function askGemini(messages) {
    if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key is not configured.");
    }

    const input = messages
        .map((message) => {
            const speaker =
                message.role === "assistant"
                    ? "Assistant"
                    : "User";

            return `${speaker}: ${message.content}`;
        })
        .join("\n");

    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
            method: "POST",
            headers: {
                "x-goog-api-key": GEMINI_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gemini-3.8-flash",
                input
            })
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            `Gemini ${response.status}: ${
                data?.error?.message ||
                data?.message ||
                "Unknown error"
            }`
        );
    }

    let answer = "";

    if (Array.isArray(data?.outputs)) {
        answer = data.outputs
            .map((item) => item?.text || "")
            .filter(Boolean)
            .join("\n");
    }

    answer =
        answer ||
        data?.text ||
        data?.output_text ||
        "";

    if (!answer) {
        throw new Error("Gemini returned an empty response.");
    }

    return answer;
}

/* =========================================================
   GROQ
   ========================================================= */

async function askGroq(messages) {
    if (!GROQ_API_KEY) {
        throw new Error("Groq API key is not configured.");
    }

    const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-20b",
                messages,
                temperature: 0.7
            })
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            `Groq ${response.status}: ${
                data?.error?.message ||
                "Unknown error"
            }`
        );
    }

    const answer =
        data?.choices?.[0]?.message?.content || "";

    if (!answer) {
        throw new Error("Groq returned an empty response.");
    }

    return answer;
}

/* =========================================================
   OPENROUTER
   ========================================================= */

async function askOpenRouter(messages) {
    if (!OPENROUTER_API_KEY) {
        throw new Error(
            "OpenRouter API key is not configured."
        );
    }

    const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer":
                    "https://chat-ai-pro-ymod.onrender.com",
                "X-Title": "Chat AI Pro"
            },
            body: JSON.stringify({
                model: "openrouter/free",
                messages,
                temperature: 0.7
            })
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            `OpenRouter ${response.status}: ${
                data?.error?.message ||
                "Unknown error"
            }`
        );
    }

    const answer =
        data?.choices?.[0]?.message?.content || "";

    if (!answer) {
        throw new Error(
            "OpenRouter returned an empty response."
        );
    }

    return answer;
}

/* =========================================================
   CHAT
   ========================================================= */

app.post("/api/chat", requireFirebaseUser, async (req, res) => {
    const messages = normalizeMessages(req.body);

    if (!messages.length) {
        return res.status(400).json({
            ok: false,
            error: "No message supplied."
        });
    }

    const userMessage = getLastUserMessage(messages);

    console.log(
        `Chat request from Firebase UID: ${req.firebaseUser.uid}`
    );

    const providers = [
        {
            name: "Gemini",
            fn: () => askGemini(messages)
        },
        {
            name: "Groq",
            fn: () => askGroq(messages)
        },
        {
            name: "OpenRouter",
            fn: () => askOpenRouter(messages)
        }
    ];

    const errors = [];

    for (const provider of providers) {
        try {
            console.log(
                `Trying ${provider.name}...`
            );

            const answer = await provider.fn();

            console.log(
                `${provider.name}: success`
            );

            return res.json({
                ok: true,
                provider: provider.name,
                answer,
                message: answer,
                userMessage
            });
        } catch (error) {
            console.error(
                `${provider.name} failed:`,
                error.message
            );

            errors.push({
                provider: provider.name,
                error: error.message
            });
        }
    }

    return res.status(503).json({
        ok: false,
        error: "All AI providers failed.",
        details: errors
    });
});

/* =========================================================
   FRONTEND
   ========================================================= */

app.use(express.static(__dirname));

app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================================================
   START
   ========================================================= */

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

    console.log(
        `Firebase: ${
            firebaseReady
                ? "configured"
                : "missing"
        }`
    );
});
