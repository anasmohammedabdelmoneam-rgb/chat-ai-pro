require("dotenv").config();
const express = require("express");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

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

    const input = messages.map((message) => ({
      type: message.role === "assistant" ? "model_output" : "user_input",
      content: [
        {
          type: "text",
          text: String(message.content || "")
        }
      ]
    }));

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input,
          store: false
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);

      return res.status(response.status).json({
        error:
          data.error?.message ||
          "فشل الاتصال بـ Gemini API."
      });
    }

    const steps = data.steps || [];
    const lastStep = steps[steps.length - 1];

    let reply = "";

    if (lastStep?.content) {
      reply = lastStep.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("");
    }

    if (!reply && data.output_text) {
      reply = data.output_text;
    }

    res.json({
      reply: reply || "لم تصل إجابة من Gemini."
    });

  } catch (error) {
    console.error("Server Error:", error);

    res.status(500).json({
      error: error.message || "حدث خطأ داخلي في الخادم."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Anas AI running on port ${PORT}`);
});
