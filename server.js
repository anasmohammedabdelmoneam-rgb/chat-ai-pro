"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

/* =========================================================
   CONFIG
========================================================= */

const PORT = process.env.PORT || 10000;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

const GROQ_API_KEY =
  process.env.GROQ_API_KEY;

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY;

const AUTHENTICA_API_KEY =
  process.env.AUTHENTICA_API_KEY;


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);


/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  express.static(
    path.join(__dirname)
  )
);


/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {

  res.json({
    ok: true,

    service: "Chat AI Pro",

    providers: {
      gemini: Boolean(GEMINI_API_KEY),
      groq: Boolean(GROQ_API_KEY),
      openrouter: Boolean(OPENROUTER_API_KEY),
      authentica: Boolean(AUTHENTICA_API_KEY)
    },

    models: {
      gemini: "gemini-3.8-flash",
      groq: "openai/gpt-oss-20b",
      openrouter: "openrouter/free"
    }
  });

});


/* =========================================================
   AUTHENTICA
   SEND WHATSAPP OTP
========================================================= */

app.post(
  "/api/auth/send-otp",
  async (req, res) => {

    try {

      let { phone } = req.body;


      /* -----------------------------------------
         CHECK PHONE
      ----------------------------------------- */

      if (!phone) {

        return res.status(400).json({
          success: false,
          message:
            "رقم الهاتف مطلوب."
        });

      }


      /* -----------------------------------------
         CLEAN PHONE
      ----------------------------------------- */

      phone = String(phone)
        .trim()
        .replace(/[^\d+]/g, "");


      /* -----------------------------------------
         INTERNATIONAL FORMAT
         Example:
         +966501234567
      ----------------------------------------- */

      if (!phone.startsWith("+")) {

        return res.status(400).json({
          success: false,
          message:
            "رقم الهاتف يجب أن يكون بالصيغة الدولية، مثل +9665XXXXXXXX."
        });

      }


      /* -----------------------------------------
         CHECK API KEY
      ----------------------------------------- */

      if (!AUTHENTICA_API_KEY) {

        console.error(
          "AUTHENTICA_API_KEY is missing."
        );

        return res.status(500).json({
          success: false,
          message:
            "مفتاح Authentica غير موجود في الخادم."
        });

      }


      console.log(
        "Authentica: sending WhatsApp OTP to:",
        phone
      );


      /* -----------------------------------------
         SEND OTP
      ----------------------------------------- */

      const response =
        await fetch(
          "https://api.authentica.sa/api/v2/send-otp",
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

            body: JSON.stringify({
              method: "whatsapp",
              phone: phone
            })
          }
        );


      const text =
        await response.text();


      let data;

      try {

        data = JSON.parse(text);

      } catch {

        data = {
          success: false,
          message: text
        };

      }


      /* -----------------------------------------
         AUTHENTICA ERROR
      ----------------------------------------- */

      if (!response.ok) {

        console.error(
          "Authentica SEND OTP failed:",
          response.status,
          text
        );


        return res.status(
          response.status
        ).json({

          success: false,

          message:
            data.message ||
            "فشل إرسال رمز التحقق.",

          authentica: data

        });

      }


      /* -----------------------------------------
         SUCCESS
      ----------------------------------------- */

      console.log(
        "Authentica SEND OTP success:",
        data
      );


      return res.json({

        success: true,

        message:
          data.message ||
          "تم إرسال رمز التحقق عبر WhatsApp."

      });


    } catch (error) {

      console.error(
        "SEND OTP ERROR:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "حدث خطأ في الخادم أثناء إرسال رمز التحقق."

      });

    }

  }
);


/* =========================================================
   AUTHENTICA
   VERIFY WHATSAPP OTP
========================================================= */

app.post(
  "/api/auth/verify-otp",
  async (req, res) => {

    try {

      let {
        phone,
        otp
      } = req.body;


      /* -----------------------------------------
         CHECK DATA
      ----------------------------------------- */

      if (!phone || !otp) {

        return res.status(400).json({

          success: false,

          message:
            "رقم الهاتف ورمز التحقق مطلوبان."

        });

      }


      /* -----------------------------------------
         CLEAN PHONE
      ----------------------------------------- */

      phone = String(phone)
        .trim()
        .replace(/[^\d+]/g, "");


      /* -----------------------------------------
         CLEAN OTP
      ----------------------------------------- */

      otp = String(otp)
        .trim();


      /* -----------------------------------------
         INTERNATIONAL PHONE CHECK
      ----------------------------------------- */

      if (!phone.startsWith("+")) {

        return res.status(400).json({

          success: false,

          message:
            "رقم الهاتف يجب أن يكون بالصيغة الدولية."

        });

      }


      /* -----------------------------------------
         AUTHENTICA KEY
      ----------------------------------------- */

      if (!AUTHENTICA_API_KEY) {

        console.error(
          "AUTHENTICA_API_KEY is missing."
        );

        return res.status(500).json({

          success: false,

          message:
            "مفتاح Authentica غير موجود في الخادم."

        });

      }


      console.log(
        "Authentica: verifying WhatsApp OTP for:",
        phone
      );


      /* -----------------------------------------
         VERIFY OTP
      ----------------------------------------- */

      const response =
        await fetch(
          "https://api.authentica.sa/api/v2/verify-otp",
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

            body: JSON.stringify({

              phone: phone,

              otp: otp

            })

          }
        );


      const text =
        await response.text();


      let data;

      try {

        data =
          JSON.parse(text);

      } catch {

        data = {

          success: false,

          message: text

        };

      }


      /* -----------------------------------------
         VERIFY ERROR
      ----------------------------------------- */

      if (!response.ok) {

        console.error(
          "Authentica VERIFY OTP failed:",
          response.status,
          text
        );


        return res.status(
          response.status
        ).json({

          success: false,

          message:
            data.message ||
            "رمز التحقق غير صحيح.",

          authentica:
            data

        });

      }


      /* -----------------------------------------
         SUCCESS
      ----------------------------------------- */

      console.log(
        "Authentica VERIFY OTP success:",
        data
      );


      return res.json({

        success: true,

        message:
          data.message ||
          "تم التحقق بنجاح."

      });


    } catch (error) {

      console.error(
        "VERIFY OTP ERROR:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "حدث خطأ في الخادم أثناء التحقق."

      });

    }

  }
);


/* =========================================================
   AUTHENTICA BALANCE
========================================================= */

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


      const response =
        await fetch(
          "https://api.authentica.sa/api/v2/balance",
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


      const text =
        await response.text();


      let data;

      try {

        data =
          JSON.parse(text);

      } catch {

        data = {
          success: false,
          message: text
        };

      }


      if (!response.ok) {

        return res.status(
          response.status
        ).json(data);

      }


      return res.json(data);


    } catch (error) {

      console.error(
        "AUTHENTICA BALANCE ERROR:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "فشل الحصول على رصيد Authentica."

      });

    }

  }
);


/* =========================================================
   GEMINI
========================================================= */

async function askGemini(messages) {

  if (!GEMINI_API_KEY) {

    throw new Error(
      "Gemini API key is not configured."
    );

  }


  /*
    نحول تاريخ المحادثة إلى نص واحد
    حتى تعمل المحادثة الحالية مع Interactions API.
  */

  const input =
    messages
      .map((message) => {

        const role =
          message.role === "assistant"
            ? "Assistant"
            : "User";

        return `${role}: ${message.content}`;

      })
      .join("\n\n");


  const response =
    await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {

        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

          "x-goog-api-key":
            GEMINI_API_KEY

        },

        body: JSON.stringify({

          model:
            "gemini-3.8-flash",

          input:
            input

        })

      }
    );


  const text =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    data = {
      error: text
    };

  }


  if (!response.ok) {

    throw new Error(
      `Gemini ${response.status}: ${
        data.error?.message ||
        data.message ||
        text
      }`
    );

  }


  /*
    Interactions API returns output_text
    in the current API.
  */

  if (data.output_text) {

    return data.output_text;

  }


  /*
    Fallback parser in case the response
    contains output items instead.
  */

  if (Array.isArray(data.outputs)) {

    const textParts =
      data.outputs
        .map((item) => {

          if (
            item &&
            typeof item.text === "string"
          ) {

            return item.text;

          }

          if (
            item &&
            Array.isArray(item.content)
          ) {

            return item.content
              .map((part) =>
                part.text || ""
              )
              .join("");

          }

          return "";

        })
        .filter(Boolean);


    if (textParts.length) {

      return textParts.join("\n");

    }

  }


  throw new Error(
    "Gemini returned no text."
  );

}


/* =========================================================
   GROQ
========================================================= */

async function askGroq(messages) {

  if (!GROQ_API_KEY) {

    throw new Error(
      "Groq API key is not configured."
    );

  }


  const response =
    await fetch(
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

          messages:
            messages.map((message) => ({

              role:
                message.role === "assistant"
                  ? "assistant"
                  : "user",

              content:
                String(
                  message.content || ""
                )

            })),

          temperature:
            0.7,

          max_tokens:
            4096

        })

      }
    );


  const text =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    data = {
      error: text
    };

  }


  if (!response.ok) {

    throw new Error(
      `Groq ${response.status}: ${
        data.error?.message ||
        data.message ||
        text
      }`
    );

  }


  const answer =
    data.choices?.[0]?.message?.content;


  if (!answer) {

    throw new Error(
      "Groq returned no text."
    );

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


  const response =
    await fetch(
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

          model:
            "openrouter/free",

          messages:
            messages.map((message) => ({

              role:
                message.role === "assistant"
                  ? "assistant"
                  : "user",

              content:
                String(
                  message.content || ""
                )

            }))

        })

      }
    );


  const text =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    data = {
      error: text
    };

  }


  if (!response.ok) {

    throw new Error(
      `OpenRouter ${response.status}: ${
        data.error?.message ||
        data.message ||
        text
      }`
    );

  }


  const answer =
    data.choices?.[0]?.message?.content;


  if (!answer) {

    throw new Error(
      "OpenRouter returned no text."
    );

  }


  return answer;

}


/* =========================================================
   NORMALIZE CHAT MESSAGES
========================================================= */

function normalizeMessages(body) {

  let messages = [];


  /*
    New frontend:
    {
      messages: [...]
    }
  */

  if (
    Array.isArray(body.messages)
  ) {

    messages =
      body.messages;

  }


  /*
    Single message:
    {
      message: "Hello"
    }
  */

  else if (
    typeof body.message === "string"
  ) {

    messages = [

      {
        role: "user",

        content:
          body.message

      }

    ];

  }


  /*
    Old frontend:
    {
      prompt: "Hello"
    }
  */

  else if (
    typeof body.prompt === "string"
  ) {

    messages = [

      {
        role: "user",

        content:
          body.prompt

      }

    ];

  }


  /*
    Clean messages.
  */

  messages =
    messages
      .filter(
        (message) =>
          message &&
          typeof message.content === "string"
      )
      .map((message) => ({

        role:
          message.role === "assistant"
            ? "assistant"
            : "user",

        content:
          message.content.trim()

      }))
      .filter(
        (message) =>
          message.content.length > 0
      );


  return messages;

}


/* =========================================================
   CHAT API
   FALLBACK:
   GEMINI → GROQ → OPENROUTER
========================================================= */

app.post(
  "/api/chat",
  async (req, res) => {

    try {

      const messages =
        normalizeMessages(req.body || {});


      if (!messages.length) {

        return res.status(400).json({

          success: false,

          message:
            "اكتب رسالة أولًا."

        });

      }


      /*
        Keep a reasonable conversation size.
        This prevents excessively large requests.
      */

      const limitedMessages =
        messages.slice(-30);


      const providers = [

        {
          name: "Gemini",

          enabled:
            Boolean(GEMINI_API_KEY),

          fn:
            () =>
              askGemini(
                limitedMessages
              )
        },


        {
          name: "Groq",

          enabled:
            Boolean(GROQ_API_KEY),

          fn:
            () =>
              askGroq(
                limitedMessages
              )
        },


        {
          name: "OpenRouter",

          enabled:
            Boolean(OPENROUTER_API_KEY),

          fn:
            () =>
              askOpenRouter(
                limitedMessages
              )
        }

      ];


      const errors = [];


      /* -----------------------------------------
         TRY PROVIDERS IN ORDER
      ----------------------------------------- */

      for (
        const provider of providers
      ) {

        if (!provider.enabled) {

          continue;

        }


        try {

          console.log(
            `Chat AI Pro: trying ${provider.name}`
          );


          const answer =
            await provider.fn();


          console.log(
            `Chat AI Pro: ${provider.name} succeeded`
          );


          return res.json({

            success: true,

            reply: answer,

            provider:
              provider.name

          });


        } catch (error) {

          console.error(
            `${provider.name} failed:`,
            error.message
          );


          errors.push({

            provider:
              provider.name,

            error:
              error.message

          });

        }

      }


      /* -----------------------------------------
         ALL PROVIDERS FAILED
      ----------------------------------------- */

      return res.status(503).json({

        success: false,

        message:
          "تعذر الحصول على رد من خدمات الذكاء الاصطناعي حاليًا.",

        errors:
          errors

      });


    } catch (error) {

      console.error(
        "CHAT ERROR:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "حدث خطأ في الخادم."

      });

    }

  }
);


/* =========================================================
   FRONTEND FALLBACK
   Express 5 syntax
========================================================= */

app.get(
  "/{*splat}",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );

  }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `Chat AI Pro running on port ${PORT}`
    );

    console.log(
      `Gemini: ${
        GEMINI_API_KEY
          ? "configured"
          : "missing"
      }`
    );

    console.log(
      `Groq: ${
        GROQ_API_KEY
          ? "configured"
          : "missing"
      }`
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

  }
);
