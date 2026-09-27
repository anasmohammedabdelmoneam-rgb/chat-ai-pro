"use strict";

/*
  Chat AI Pro
  International phone numbers + WhatsApp OTP + AI chat
*/

const API_BASE = window.location.origin;

let selectedCountry = "SA";
let currentPhone = "";
let conversation = [];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  initializeCountries();
  initializeAuth();
  initializeChat();

  window.ChatAIPro = {
    API_BASE,
    get selectedCountry() {
      return selectedCountry;
    },
    get currentPhone() {
      return currentPhone;
    }
  };
});


/* =========================================================
   COUNTRIES
========================================================= */

function initializeCountries() {

  const select = $("countrySelect");

  if (!select) return;

  /*
    libphonenumber-js exposes all supported country codes.
  */
  if (
    typeof libphonenumber === "undefined" ||
    typeof libphonenumber.getCountries !== "function"
  ) {
    console.error("libphonenumber-js لم يتم تحميلها.");
    return;
  }

  const countries = libphonenumber.getCountries();

  const displayNames = new Intl.DisplayNames(
    ["ar"],
    {
      type: "region"
    }
  );

  const countryList = countries
    .map((countryCode) => {

      let name;

      try {
        name = displayNames.of(countryCode);
      } catch {
        name = countryCode;
      }

      if (!name || name === countryCode) {
        name = countryCode;
      }

      let callingCode = "";

      try {
        callingCode =
          libphonenumber.getCountryCallingCode(countryCode);
      } catch {
        return null;
      }

      return {
        code: countryCode,
        name,
        callingCode,
        flag: countryFlag(countryCode)
      };

    })
    .filter(Boolean)
    .sort((a, b) => {

      /*
        السعودية في البداية.
      */
      if (a.code === "SA") return -1;
      if (b.code === "SA") return 1;

      return a.name.localeCompare(
        b.name,
        "ar"
      );

    });


  select.innerHTML = "";

  for (const country of countryList) {

    const option = document.createElement("option");

    option.value = country.code;

    option.textContent =
      `${country.flag} ${country.name} (+${country.callingCode})`;

    select.appendChild(option);
  }

  select.value = "SA";

  selectedCountry = "SA";


  select.addEventListener("change", () => {

    selectedCountry = select.value;

    updatePhonePlaceholder();

    /*
      عند تغيير الدولة، نمسح الرقم القديم
      حتى لا يختلط رمز دولة مع رقم دولة أخرى.
    */
    const input = $("phoneInput");

    if (input) {
      input.value = "";
      input.focus();
    }

  });

  updatePhonePlaceholder();
}


/* =========================================================
   FLAG
========================================================= */

function countryFlag(countryCode) {

  if (!countryCode || countryCode.length !== 2) {
    return "🌍";
  }

  return countryCode
    .toUpperCase()
    .split("")
    .map(
      char =>
        String.fromCodePoint(
          127397 + char.charCodeAt(0)
        )
    )
    .join("");
}


/* =========================================================
   PHONE PLACEHOLDER
========================================================= */

function updatePhonePlaceholder() {

  const input = $("phoneInput");

  if (!input) return;

  if (selectedCountry === "SA") {
    input.placeholder = "5XXXXXXXX";
    return;
  }

  input.placeholder = "رقم الهاتف";
}


/* =========================================================
   AUTH
========================================================= */

function initializeAuth() {

  const sendOtpBtn = $("sendOtpBtn");
  const verifyOtpBtn = $("verifyOtpBtn");
  const resendOtpBtn = $("resendOtpBtn");

  if (sendOtpBtn) {
    sendOtpBtn.addEventListener(
      "click",
      sendOTP
    );
  }

  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener(
      "click",
      verifyOTP
    );
  }

  if (resendOtpBtn) {
    resendOtpBtn.addEventListener(
      "click",
      sendOTP
    );
  }


  const savedPhone =
    localStorage.getItem("chat_ai_phone");

  const loggedIn =
    localStorage.getItem("chat_ai_logged_in");


  if (
    savedPhone &&
    loggedIn === "true"
  ) {

    currentPhone = savedPhone;

    showChat();

  } else {

    showAuth();

  }
}


/* =========================================================
   CONVERT PHONE TO E.164
========================================================= */

function getInternationalPhone() {

  const input = $("phoneInput");

  if (!input) {
    throw new Error("حقل رقم الهاتف غير موجود.");
  }

  let raw = input.value.trim();

  if (!raw) {
    throw new Error("اكتب رقم الهاتف أولًا.");
  }


  /*
    إذا المستخدم كتب الرقم كاملًا مع +
    نسمح للمكتبة بتحليله مباشرة.
  */
  let phoneNumber;

  try {

    if (raw.startsWith("+")) {

      phoneNumber =
        libphonenumber.parsePhoneNumber(
          raw
        );

    } else {

      phoneNumber =
        libphonenumber.parsePhoneNumber(
          raw,
          selectedCountry
        );

    }

  } catch (error) {

    console.error(error);

    throw new Error(
      "رقم الهاتف غير صحيح."
    );
  }


  if (!phoneNumber) {

    throw new Error(
      "تعذر قراءة رقم الهاتف."
    );
  }


  /*
    isPossible يعتمد على قواعد طول الرقم.
  */
  if (!phoneNumber.isPossible()) {

    throw new Error(
      "طول رقم الهاتف غير صحيح."
    );
  }


  /*
    نستخدم E.164:
    مثال:
    +9665XXXXXXXX
  */
  return phoneNumber.number;
}


/* =========================================================
   SEND OTP
========================================================= */

async function sendOTP() {

  const status = $("authStatus");
  const sendButton = $("sendOtpBtn");
  const resendButton = $("resendOtpBtn");

  try {

    const phone =
      getInternationalPhone();

    currentPhone = phone;


    if (sendButton) {
      sendButton.disabled = true;
      sendButton.textContent = "جاري الإرسال...";
    }

    if (resendButton) {
      resendButton.disabled = true;
      resendButton.textContent = "جاري الإرسال...";
    }


    setStatus(
      "جاري إرسال رمز التحقق عبر WhatsApp..."
    );


    const response =
      await fetch(
        `${API_BASE}/api/auth/send-otp`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            phone
          })
        }
      );


    const data =
      await response.json()
        .catch(() => ({}));


    if (!response.ok) {

      throw new Error(
        data.message ||
        "فشل إرسال رمز التحقق."
      );

    }


    setStatus(
      data.message ||
      "تم إرسال رمز التحقق."
    );


    const phoneStep = $("phoneStep");
    const otpStep = $("otpStep");

    if (phoneStep) {
      phoneStep.classList.add("hidden");
    }

    if (otpStep) {
      otpStep.classList.remove("hidden");
    }


    const otpInput = $("otpInput");

    if (otpInput) {
      otpInput.focus();
    }

  } catch (error) {

    console.error(
      "SEND OTP ERROR:",
      error
    );

    setStatus(
      error.message ||
      "حدث خطأ أثناء إرسال الرمز."
    );

  } finally {

    if (sendButton) {
      sendButton.disabled = false;
      sendButton.textContent =
        "إرسال رمز التحقق";
    }

    if (resendButton) {
      resendButton.disabled = false;
      resendButton.textContent =
        "إرسال الرمز مرة أخرى";
    }

  }
}


/* =========================================================
   VERIFY OTP
========================================================= */

async function verifyOTP() {

  const otpInput = $("otpInput");
  const verifyButton = $("verifyOtpBtn");

  if (!otpInput) return;

  const otp =
    otpInput.value.trim();


  if (!otp) {

    setStatus(
      "اكتب رمز التحقق أولًا."
    );

    return;
  }


  try {

    if (verifyButton) {
      verifyButton.disabled = true;
      verifyButton.textContent =
        "جاري التحقق...";
    }


    setStatus(
      "جاري التحقق من الرمز..."
    );


    const response =
      await fetch(
        `${API_BASE}/api/auth/verify-otp`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            phone: currentPhone,
            otp
          })
        }
      );


    const data =
      await response.json()
        .catch(() => ({}));


    if (!response.ok) {

      throw new Error(
        data.message ||
        "رمز التحقق غير صحيح."
      );

    }


    /*
      حفظ تسجيل الدخول.
    */
    localStorage.setItem(
      "chat_ai_logged_in",
      "true"
    );

    localStorage.setItem(
      "chat_ai_phone",
      currentPhone
    );


    setStatus(
      "تم تسجيل الدخول بنجاح."
    );


    showChat();

  } catch (error) {

    console.error(
      "VERIFY OTP ERROR:",
      error
    );

    setStatus(
      error.message ||
      "فشل التحقق."
    );

  } finally {

    if (verifyButton) {
      verifyButton.disabled = false;
      verifyButton.textContent =
        "تأكيد الرمز";
    }

  }
}


/* =========================================================
   STATUS
========================================================= */

function setStatus(message) {

  const status =
    $("authStatus");

  if (status) {
    status.textContent = message;
  }
}


/* =========================================================
   SHOW AUTH
========================================================= */

function showAuth() {

  const authScreen =
    $("authScreen");

  const chatScreen =
    $("chatScreen");

  if (authScreen) {
    authScreen.classList.remove("hidden");
  }

  if (chatScreen) {
    chatScreen.classList.add("hidden");
  }
}


/* =========================================================
   SHOW CHAT
========================================================= */

function showChat() {

  const authScreen =
    $("authScreen");

  const chatScreen =
    $("chatScreen");

  if (authScreen) {
    authScreen.classList.add("hidden");
  }

  if (chatScreen) {
    chatScreen.classList.remove("hidden");
  }


  const messageInput =
    $("messageInput");

  if (messageInput) {
    setTimeout(
      () => messageInput.focus(),
      100
    );
  }
}


/* =========================================================
   CHAT
========================================================= */

function initializeChat() {

  const form =
    $("chatForm");

  if (form) {

    form.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        await sendMessage();

      }
    );

  }


  const logoutBtn =
    $("logoutBtn");

  if (logoutBtn) {

    logoutBtn.addEventListener(
      "click",
      logout
    );

  }
}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

  const input =
    $("messageInput");

  const sendButton =
    $("sendMessageBtn");

  if (!input) return;


  const message =
    input.value.trim();


  if (!message) {

    return;

  }


  addMessage(
    message,
    "user"
  );


  input.value = "";

  input.focus();


  conversation.push({
    role: "user",
    content: message
  });


  if (sendButton) {
    sendButton.disabled = true;
    sendButton.textContent = "...";
  }


  const loading =
    addMessage(
      "جاري التفكير...",
      "ai"
    );


  try {

    const response =
      await fetch(
        `${API_BASE}/api/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            messages: conversation
          })
        }
      );


    const data =
      await response.json()
        .catch(() => ({}));


    if (!response.ok) {

      throw new Error(
        data.message ||
        data.error ||
        "فشل الاتصال بخدمة الذكاء الاصطناعي."
      );

    }


    const answer =
      data.reply ||
      data.message ||
      data.response ||
      data.text ||
      "لم تصل إجابة من الخادم.";


    if (loading) {
      loading.textContent = answer;
    }


    conversation.push({
      role: "assistant",
      content: answer
    });


  } catch (error) {

    console.error(
      "CHAT ERROR:",
      error
    );


    if (loading) {

      loading.textContent =
        `حدث خطأ: ${error.message}`;

    }

  } finally {

    if (sendButton) {
      sendButton.disabled = false;
      sendButton.textContent = "إرسال";
    }

  }
}


/* =========================================================
   ADD MESSAGE
========================================================= */

function addMessage(
  text,
  type
) {

  const container =
    $("messages");

  if (!container) {
    return null;
  }


  const element =
    document.createElement("div");

  element.className =
    `message ${type}`;

  element.textContent =
    text;


  container.appendChild(
    element
  );


  container.scrollTop =
    container.scrollHeight;


  return element;
}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

  localStorage.removeItem(
    "chat_ai_logged_in"
  );

  localStorage.removeItem(
    "chat_ai_phone"
  );


  currentPhone = "";

  conversation = [];


  const messages =
    $("messages");

  if (messages) {
    messages.innerHTML = "";
  }


  const otpInput =
    $("otpInput");

  if (otpInput) {
    otpInput.value = "";
  }


  const phoneInput =
    $("phoneInput");

  if (phoneInput) {
    phoneInput.value = "";
  }


  const phoneStep =
    $("phoneStep");

  const otpStep =
    $("otpStep");

  if (phoneStep) {
    phoneStep.classList.remove("hidden");
  }

  if (otpStep) {
    otpStep.classList.add("hidden");
  }


  setStatus("");

  showAuth();
}
