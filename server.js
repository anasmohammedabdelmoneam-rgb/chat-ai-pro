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

    const contents = messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message.content || "") }]
    }));

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify({
          contents
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data.error?.message ||
          "فشل الاتصال بـ Gemini API."
      });
    }

    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("") || "لم تصل إجابة.";

    res.json({ reply });

  } catch (error) {
    console.error("Gemini Error:", error);

    res.status(500).json({
      error: "حدث خطأ داخلي في الخادم."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Anas AI running on port ${PORT}`);
});
