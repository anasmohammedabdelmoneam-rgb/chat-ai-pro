require("dotenv").config();
const express = require("express");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;

app.post("/api/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY غير مضبوط على الخادم." });
    }

    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    if (!messages.length) return res.status(400).json({ error: "لا توجد رسالة." });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5.6-mini",
        input: messages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "فشل طلب الذكاء الاصطناعي."
      });
    }

    res.json({ reply: data.output_text || "لم تصل إجابة نصية." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ داخلي في الخادم." });
  }
});

app.listen(PORT, () => console.log(`Anas AI running on port ${PORT}`));
