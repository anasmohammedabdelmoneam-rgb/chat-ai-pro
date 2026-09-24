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

/*
  إعدادات Rate Limit
  Gemini Free Tier عندك يسمح بـ 5 طلبات في الدقيقة.
*/
const MAX_REQUESTS_PER_MINUTE = 5;
const WINDOW_MS = 60 * 1000;

/*
  نخزن أوقات الطلبات الناجحة/المحاولة في الذاكرة.
  هذا يحمي التطبيق من إرسال أكثر من 5 طلبات في الدقيقة
  من نفس الخادم.
*/
let requestTimes = [];

/*
  تنظيف الطلبات القديمة
*/
function cleanRequestTimes() {
  const now = Date.now();

  requestTimes = requestTimes.filter(function (time) {
    return now - time < WINDOW_MS;
  });
}

/*
  حساب الوقت المتبقي قبل السماح بطلب جديد
*/
function getWaitTime() {
  cleanRequestTimes();

  if (requestTimes.length < MAX_REQUESTS_PER_MINUTE) {
    return 0;
  }

  const oldestRequest = requestTimes[0];
  const wait = WINDOW_MS - (Date.now() - oldestRequest);

  return Math.max(wait, 1000);
}

/*
  تسجيل طلب جديد
*/
function registerRequest() {
  cleanRequestTimes();
  requestTimes.push(Date.now());
}

/*
  تحويل milliseconds إلى ثوانٍ
*/
function secondsFromMs(ms) {
  return Math.ceil(ms / 1000);
}

/*
  طلب Gemini
*/
async function callGemini(body) {
  const waitTime = getWaitTime();

  if (waitTime > 0) {
    const error = new Error("RATE_LIMIT_LOCAL");

    error.status = 429;
    error.waitSeconds = secondsFromMs(waitTime);

    throw error;
  }

  /*
    نسجل الطلب قبل إرساله حتى لا يرسل المستخدم
    عدة طلبات متتالية وتتجاوز الحد.
  */
  registerRequest();

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

    /*
      Gemini Rate Limit
    */
    if (response.status === 429) {
      let waitSeconds = 60;

      /*
        إذا أعاد Gemini Retry-After نستخدمه.
      */
      const retryAfter = response.headers.get("retry-after");

      if (retryAfter) {
        const parsed = parseInt(retryAfter, 10);

        if (!isNaN(parsed)) {
          waitSeconds = parsed;
        }
      }

      /*
        نحاول استخراج الرقم من رسالة Gemini
        مثل:
        "Please retry in 50s"
      */
      if (
        data &&
        data.error &&
        typeof data.error.message === "string"
      ) {
        const match = data.error.message.match(
          /retry in\s+([0-9]+(?:\.[0-9]+)?)s/i
        );

        if (match) {
          waitSeconds = Math.ceil(parseFloat(match[1]));
        }
      }

      const error = new Error("RATE_LIMIT_GEMINI");

      error.status = 429;
      error.waitSeconds = waitSeconds;
      error.data = data;

      throw error;
    }

    /*
      أخطاء مؤقتة أخرى
    */
    if (response.status === 408 || response.status >= 500) {
      const error = new Error("TEMPORARY_GEMINI_ERROR");

      error.status = response.status;
      error.data = data;

      throw error;
    }

    /*
      أي خطأ آخر
    */
    if (!response.ok) {
      const error = new Error("GEMINI_ERROR");

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  } catch (error) {
    throw error;
  }
}

/*
  API Chat
*/
app.post("/api/chat", async function (req, res) {
  try {
    /*
      التأكد من وجود المفتاح
    */
    if (!API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY غير مضبوط على الخادم."
      });
    }

    /*
      التأكد من وجود الرسائل
    */
    const messages = Array.isArray(req.body.messages)
      ? req.body.messages
      : [];

    if (!messages.length) {
      return res.status(400).json({
        error: "لا توجد رسالة."
      });
    }

    /*
      تحويل رسائل التطبيق إلى صيغة Gemini
    */
    const input = messages.map(function (message) {
      return {
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
      };
    });

    /*
      إرسال الطلب إلى Gemini
    */
    const data = await callGemini({
      model: MODEL,
      input: input,
      store: false
    });

    /*
      استخراج الإجابة
    */
    let reply = data.output_text || "";

    /*
      احتياطًا إذا لم يوجد output_text
    */
    if (!reply && Array.isArray(data.steps)) {
      for (let i = data.steps.length - 1; i >= 0; i--) {
        const step = data.steps[i];

        if (Array.isArray(step.content)) {
          const textParts = step.content
            .filter(function (part) {
              return part.type === "text";
            })
            .map(function (part) {
              return part.text || "";
            });

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

    /*
      إرسال الإجابة للواجهة
    */
    return res.json({
      reply: reply
    });
  } catch (error) {
    console.error("Gemini Error:", error);

    /*
      الحد المحلي الذي وضعناه نحن
    */
    if (error.message === "RATE_LIMIT_LOCAL") {
      return res.status(429).json({
        error: "وصلت إلى الحد المجاني مؤقتًا.",
        rateLimited: true,
        waitSeconds: error.waitSeconds
      });
    }

    /*
      الحد الذي أرسله Gemini
    */
    if (error.message === "RATE_LIMIT_GEMINI") {
      return res.status(429).json({
        error: "وصلت إلى الحد المجاني لـ Gemini.",
        rateLimited: true,
        waitSeconds: error.waitSeconds
      });
    }

    /*
      أخطاء مؤقتة من Gemini
    */
    if (error.message === "TEMPORARY_GEMINI_ERROR") {
      return res.status(503).json({
        error: "خدمة Gemini مشغولة حاليًا، حاول مرة أخرى بعد قليل.",
        temporary: true
      });
    }

    /*
      الأخطاء العادية
    */
    const message =
      (error &&
        error.data &&
        error.data.error &&
        error.data.error.message) ||
      (error && error.message) ||
      "حدث خطأ غير معروف.";

    return res.status(error.status || 500).json({
      error: message
    });
  }
});

/*
  تشغيل السيرفر
*/
app.listen(PORT, function () {
  console.log(
    "Anas AI running on port " + PORT
  );
});
```
