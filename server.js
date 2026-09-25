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


/* =========================================================
   أدوات مساعدة
========================================================= */

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}


function getMessages(messages) {
  return messages.map(function (message) {
    return {
      role:
        message.role === "assistant"
          ? "assistant"
          : "user",

      content: String(message.content || "")
    };
  });
}


/* =========================================================
   GEMINI
========================================================= */

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
          text: String(message.content || "")
        }
      ]
    };
  });


  const response = await fetch(GEMINI_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },

    body: JSON.stringify({
      model: GEMINI_MODEL,
      input: input,
      store: false
    })
  });


  const data = await response.json();


  if (!response.ok) {
    const error = new Error("GEMINI_FAILED");

    error.status = response.status;
    error.data = data;

    throw error;
  }


  let reply = data.output_text || "";


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
    throw new Error("GEMINI_EMPTY_RESPONSE");
  }


  return {
    reply: reply,
    provider: "Gemini"
  };
}


/* =========================================================
   GROQ
========================================================= */

async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY_MISSING");
  }


  const response = await fetch(GROQ_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "Authorization":
        "Bearer " + GROQ_API_KEY
    },

    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: getMessages(messages),
      temperature: 0.7,
      max_completion_tokens: 2048
    })
  });


  const data = await response.json();


  if (!response.ok) {
    const error = new Error("GROQ_FAILED");

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
    throw new Error("GROQ_EMPTY_RESPONSE");
  }


  return {
    reply: reply,
    provider: "Groq"
  };
}


/* =========================================================
   OPENROUTER
========================================================= */

async function callOpenRouter(messages) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY_MISSING");
  }


  const response = await fetch(OPENROUTER_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",

      "Authorization":
        "Bearer " + OPENROUTER_API_KEY,

      "HTTP-Referer":
        "https://chat-ai-pro-ymod.onrender.com",

      "X-Title":
        "Anas AI"
    },

    body: JSON.stringify({
      model: OPENROUTER_MODEL,

      messages: getMessages(messages),

      temperature: 0.7,

      max_tokens: 2048
    })
  });


  const data = await response.json();


  if (!response.ok) {
    const error =
      new Error("OPENROUTER_FAILED");

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


/* =========================================================
   ROUTER
========================================================= */

async function getAIResponse(messages) {

  /* -----------------------------------------
     المحاولة الأولى: Gemini
  ----------------------------------------- */

  try {
    console.log("Trying Gemini...");

    const result =
      await callGemini(messages);

    console.log(
      "Gemini responded successfully."
    );

    return result;

  } catch (error) {

    console.log(
      "Gemini failed. Moving to Groq..."
    );

    console.log(
      "Gemini status:",
      error.status || "unknown"
    );
  }


  /* -----------------------------------------
     المحاولة الثانية: Groq
  ----------------------------------------- */

  try {
    console.log("Trying Groq...");

    const result =
      await callGroq(messages);

    console.log(
      "Groq responded successfully."
    );

    return result;

  } catch (error) {

    console.log(
      "Groq failed. Moving to OpenRouter..."
    );

    console.log(
      "Groq status:",
      error.status || "unknown"
    );
  }


  /* -----------------------------------------
     المحاولة الثالثة: OpenRouter
  ----------------------------------------- */

  try {
    console.log(
      "Trying OpenRouter..."
    );

    const result =
      await callOpenRouter(messages);

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
      error.status || "unknown"
    );

    throw new Error(
      "ALL_AI_PROVIDERS_FAILED"
    );
  }
}


/* =========================================================
   CHAT API
========================================================= */

app.post("/api/chat", async function (req, res) {

  try {

    const messages =
      Array.isArray(req.body.messages)
        ? req.body.messages
        : [];


    if (!messages.length) {

      return res.status(400).json({
        error:
          "لم يتم إرسال أي رسالة."
      });

    }


    console.log(
      "New chat request received."
    );


    const result =
      await getAIResponse(messages);


    return res.json({

      reply: result.reply,

      provider: result.provider

    });


  } catch (error) {

    console.error(
      "All AI providers failed:",
      error
    );


    return res.status(503).json({

      error:
        "تعذر الحصول على إجابة حاليًا. حاول مرة أخرى بعد قليل.",

      allProvidersFailed: true

    });

  }

});


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", function (req, res) {

  res.json({

    status: "online",

    service: "Anas AI",

    providers: {

      gemini:
        Boolean(GEMINI_API_KEY),

      groq:
        Boolean(GROQ_API_KEY),

      openrouter:
        Boolean(OPENROUTER_API_KEY)

    }

  });

});


/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, function () {

  console.log(
    "Anas AI running on port " + PORT
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

});
