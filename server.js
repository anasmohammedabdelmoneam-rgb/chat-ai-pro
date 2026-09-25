require("dotenv").config();
const express = require("express");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const GEMINI_MODEL = "gemini-3.8-flash";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const OPENROUTER_MODEL = "openrouter/free";

/*
==================================================
 ANAS AI - SYSTEM INSTRUCTION
==================================================
*/

const SYSTEM_PROMPT = `
أنت Anas AI، مساعد ذكاء اصطناعي ذكي ودقيق.

القواعد المهمة جدًا:

1. افهم سؤال المستخدم كما كتبه بالضبط.
2. لا تستبدل كلمة المستخدم بكلمة أخرى مشابهة.
3. لا تفترض أن المستخدم يقصد كلمة مختلفة عن التي كتبها.
4. إذا كان السؤال باللغة العربية، فأجب باللغة العربية، إلا إذا طلب المستخدم لغة أخرى.
5. إذا سأل المستخدم عن ترجمة كلمة أو جملة، أعطه الترجمة المطلوبة مباشرة.
6. في أسئلة الترجمة، لا تخترع معنى آخر للكلمة.
7. إذا كان السؤال بسيطًا، اجعل الإجابة بسيطة ومباشرة.
8. لا تكتب شرحًا طويلًا إذا كان المستخدم يريد إجابة قصيرة.
9. إذا كان هناك أكثر من ترجمة صحيحة، اذكر الأكثر شيوعًا أولًا.
10. لا تكرر سؤال المستخدم بلا داعٍ.
11. إذا لم تفهم السؤال فعلًا، قل إنك لم تفهمه واطلب منه توضيحًا بدل التخمين.
12. لا تغيّر موضوع السؤال.
13. لا تخلط بين الكلمات العربية المتشابهة.
14. حافظ على سياق المحادثة السابقة.
15. كن طبيعيًا ومفيدًا وكأنك مساعد شخصي.

مثال مهم:

المستخدم:
"كيف أقول كلمة الحب باللغة الإنجليزية؟"

الإجابة الصحيحة:
"الحب = Love ❤️"

وليس:
"عب تعني..."

مثال آخر:

المستخدم:
"ما معنى كلمة car؟"

الإجابة:
"car = سيارة."

مثال آخر:

المستخدم:
"كيف حالك؟"

الإجابة:
"أنا بخير، شكرًا! كيف يمكنني مساعدتك؟"

لا تغيّر معنى سؤال المستخدم ولا تخمّن كلمة أخرى.
`;

/*
==================================================
 تحويل رسائل الواجهة إلى رسائل مفهومة للموديلات
==================================================
*/

function getMessages(messages) {
  return messages
    .filter(function (message) {
      return (
        message &&
        (message.role === "user" ||
          message.role === "assistant")
      );
    })
    .map(function (message) {
      return {
        role:
          message.role === "assistant"
            ? "assistant"
            : "user",

        content: String(
          message.content || ""
        )
      };
    });
}

/*
==================================================
 GEMINI
==================================================
*/

async function callGemini(messages) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }

  const input = messages.map(function (message) {
    return {
      type:
        message.role === "assistant"
          ? "model_output"
          : "user_input",

      content: [
        {
          type: "text",
          text: String(
            message.content || ""
          )
        }
      ]
    };
  });

  const response = await fetch(
    GEMINI_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "x-goog-api-key":
          GEMINI_API_KEY
      },

      body: JSON.stringify({
        model: GEMINI_MODEL,

        system_instruction:
          SYSTEM_PROMPT,

        input: input,

        store: false
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error =
      new Error("GEMINI_FAILED");

    error.status = response.status;
    error.data = data;

    throw error;
  }

  let reply =
    data.output_text || "";

  /*
  محاولة استخراج النص إذا لم يكن
  output_text موجودًا
  */

  if (
    !reply &&
    Array.isArray(data.steps)
  ) {
    for (
      let i = data.steps.length - 1;
      i >= 0;
      i--
    ) {
      const step = data.steps[i];

      if (
        Array.isArray(step.content)
      ) {
        const textParts =
          step.content
            .filter(function (part) {
              return (
                part.type === "text"
              );
            })
            .map(function (part) {
              return part.text || "";
            });

        if (textParts.length) {
          reply =
            textParts.join("");

          break;
        }
      }
    }
  }

  if (!reply) {
    throw new Error(
      "GEMINI_EMPTY_RESPONSE"
    );
  }

  return {
    reply: reply,
    provider: "Gemini"
  };
}

/*
==================================================
 GROQ
==================================================
*/

async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY_MISSING"
    );
  }

  const groqMessages = [
    {
      role: "system",
      content: SYSTEM_PROMPT
    }
  ].concat(getMessages(messages));

  const response = await fetch(
    GROQ_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "Authorization":
          "Bearer " +
          GROQ_API_KEY
      },

      body: JSON.stringify({
        model: GROQ_MODEL,

        messages: groqMessages,

        temperature: 0.2,

        max_completion_tokens: 2048
      })
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    const error =
      new Error("GROQ_FAILED");

    error.status = response.status;
    error.data = data;

    throw error;
  }

  const reply =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;

  if (!reply) {
    throw new Error(
      "GROQ_EMPTY_RESPONSE"
    );
  }

  return {
    reply: reply,
    provider: "Groq"
  };
}

/*
==================================================
 OPENROUTER
==================================================
*/

async function callOpenRouter(messages) {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY_MISSING"
    );
  }

  const openRouterMessages = [
    {
      role: "system",
      content: SYSTEM_PROMPT
    }
  ].concat(getMessages(messages));

  const response = await fetch(
    OPENROUTER_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "Authorization":
          "Bearer " +
          OPENROUTER_API_KEY,

        "HTTP-Referer":
          "https://chat-ai-pro-ymod.onrender.com",

        "X-Title":
          "Anas AI"
      },

      body: JSON.stringify({
        model:
          OPENROUTER_MODEL,

        messages:
          openRouterMessages,

        temperature: 0.2,

        max_tokens: 2048
      })
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    const error =
      new Error(
        "OPENROUTER_FAILED"
      );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  const reply =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;

  if (!reply) {
    throw new Error(
      "OPENROUTER_EMPTY_RESPONSE"
    );
  }

  return {
    reply: reply,
    provider: "OpenRouter"
  };
}

/*
==================================================
 FALLBACK SYSTEM
 Gemini → Groq → OpenRouter
==================================================
*/

async function getAIResponse(messages) {

  /*
  1 - Gemini
  */

  try {
    console.log(
      "Trying Gemini..."
    );

    const result =
      await callGemini(messages);

    console.log(
      "Gemini responded successfully."
    );

    return result;

  } catch (error) {

    console.log(
      "Gemini failed."
    );

    console.log(
      "Gemini status:",
      error.status ||
        "unknown"
    );
  }

  /*
  2 - Groq
  */

  try {
    console.log(
      "Trying Groq..."
    );

    const result =
      await callGroq(messages);

    console.log(
      "Groq responded successfully."
    );

    return result;

  } catch (error) {

    console.log(
      "Groq failed."
    );

    console.log(
      "Groq status:",
      error.status ||
        "unknown"
    );
  }

  /*
  3 - OpenRouter
  */

  try {
    console.log(
      "Trying OpenRouter..."
    );

    const result =
      await callOpenRouter(
        messages
      );

    console.log(
      "OpenRouter responded successfully."
    );

    return result;

  } catch (error) {

    console.log(
      "OpenRouter failed."
    );

    console.log(
      "OpenRouter status:",
      error.status ||
        "unknown"
    );

    throw new Error(
      "ALL_AI_PROVIDERS_FAILED"
    );
  }
}

/*
==================================================
 CHAT API
==================================================
*/

app.post(
  "/api/chat",
  async function (req, res) {

    try {

      const messages =
        Array.isArray(
          req.body.messages
        )
          ? req.body.messages
          : [];

      if (!messages.length) {

        return res
          .status(400)
          .json({
            error:
              "لم يتم إرسال أي رسالة."
          });
      }

      console.log(
        "New chat request received."
      );

      const result =
        await getAIResponse(
          messages
        );

      return res.json({
        reply: result.reply,

        provider:
          result.provider
      });

    } catch (error) {

      console.error(
        "All AI providers failed:",
        error
      );

      return res
        .status(503)
        .json({

          error:
            "تعذر الحصول على إجابة حاليًا. حاول مرة أخرى بعد قليل.",

          allProvidersFailed:
            true
        });
    }
  }
);

/*
==================================================
 HEALTH CHECK
==================================================
*/

app.get(
  "/api/health",
  function (req, res) {

    res.json({

      status: "online",

      service: "Anas AI",

      providers: {

        gemini:
          Boolean(
            GEMINI_API_KEY
          ),

        groq:
          Boolean(
            GROQ_API_KEY
          ),

        openrouter:
          Boolean(
            OPENROUTER_API_KEY
          )
      }
    });
  }
);

/*
==================================================
 START SERVER
==================================================
*/

app.listen(
  PORT,
  function () {

    console.log(
      "================================="
    );

    console.log(
      "Anas AI running on port " +
        PORT
    );

    console.log(
      "Gemini:",
      GEMINI_API_KEY
        ? "configured"
        : "missing"
    );

    console.log(
      "Groq:",
      GROQ_API_KEY
        ? "configured"
        : "missing"
    );

    console.log(
      "OpenRouter:",
      OPENROUTER_API_KEY
        ? "configured"
        : "missing"
    );

    console.log(
      "================================="
    );
  }
);
