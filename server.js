```js
require("dotenv").config();
const express = require("express");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

const MODEL = "gemini-3.8-flash";

const MAX_RETRIES = 4;
const INITIAL_DELAY = 1000;

// انتظار مع Exponential Backoff + Jitter
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(body) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      // الطلب نجح
      if (response.ok) {
        return data;
      }

      lastError = {
        status: response.status,
        data
      };

      // أخطاء مؤقتة يمكن إعادة المحاولة عليها
      const shouldRetry =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;

      if (!shouldRetry || attempt === MAX_RETRIES) {
        break;
      }

      // 1s → 2s → 4s → 8s + jitter
      const backoff = INITIAL_DELAY * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 500);

      console.log(
        `Gemini temporary error ${response.status}. ` +
        `Retry ${attempt + 1}/${MAX_RETRIES} in ${backoff + jitter}ms`
      );

      await sleep(backoff + jitter);

    } catch (error) {
      lastError = {
        status: 500,
        data: {
          error: {
            message: error.message
          }
        }
      };

      if (attempt === MAX_RETRIES) {
        break;
      }

      const backoff = INITIAL_DELAY * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 500);

      console.log(
        `Network error. Retry ${attempt + 1}/${MAX_RETRIES} ` +
        `in ${backoff + jitter}ms`
      );

      await sleep(backoff + jitter);
    }
  }

  throw lastError;
}

app.post("/api/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY غير مضبوط على الخادم."
      });
    }

    const messages = Array.isArray(req.body.messages)
      ? req.body.messages
      : [];

    if (!messages.length) {
      return res.status(400).json({
        error: "لا توجد رسالة."
      });
    }

    // تحويل سجل المحادثة إلى صيغة Gemini
    const input = messages.map((message) => ({
      type:
        message.role === "assistant"
          ? "model_output"
          : "user_input",
      content: [
        {
          type: "text",
          text: String(message.content || "")
        }
      ]
    }));

    const data = await callGemini({
      model: MODEL,
      input,
      store: false
    });

    // Interactions API يعيد output_text عند توفر النص
    let reply = data.output_text || "";

    // احتياط إذا لم يوجد output_text
    if (!reply && Array.isArray(data.steps)) {
      for (let i = data.steps.length - 1; i >= 0; i--) {
        const step = data.steps[i];

        if (Array.isArray(step.content)) {
          const textParts = step.content
            .filter((part) => part.type === "text")
            .map((part) => part.text || "");

          if (textParts.length) {
            reply = textParts.join("");
            break;
          }
        }
      }
    }

    if (!reply) {
      reply = "لم تصل إجابة من Gemini.";
    }

    res.json({
      reply
    });

  } catch (error) {
    console.error("Gemini Error:", error);

    const message =
      error?.data?.error?.message ||
      error?.message ||
      "حدث خطأ غير معروف.";

    const status = error?.status || 500;

    res.status(status).json({
      error: message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Anas AI running on port ${PORT}`);
});
```
