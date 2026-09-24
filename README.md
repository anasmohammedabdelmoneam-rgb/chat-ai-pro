# Anas AI

هذا المشروع عبارة عن واجهة HTML/CSS/JavaScript مع Backend بـ Node.js يحافظ على مفتاح OpenAI خارج المتصفح.

## مهم جدًا
GitHub Pages يشغل الملفات الثابتة فقط، لذلك لن يشغل `server.js` ولن يحمي مفتاح API.

## التشغيل محليًا
1. ثبّت Node.js.
2. افتح مجلد المشروع في Terminal.
3. نفّذ:
   npm install
4. انسخ `.env.example` إلى ملف اسمه `.env`.
5. ضع مفتاحك في:
   OPENAI_API_KEY=...
6. نفّذ:
   npm start
7. افتح:
   http://localhost:3000

## النشر
ارفع المشروع إلى GitHub، لكن شغّل الـBackend على خدمة تستضيف Node.js، وليس GitHub Pages وحده.
