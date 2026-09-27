import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// ======================================================
// FIREBASE WEB CONFIG
// ======================================================
//
// ضع بيانات Web App الخاصة بمشروع Firebase هنا.
// لا تضع FIREBASE_PRIVATE_KEY هنا.
// ======================================================

const firebaseConfig = {

  apiKey:
    "ضع_API_KEY_هنا",

  authDomain:
    "ضع_PROJECT_ID_هنا.firebaseapp.com",

  projectId:
    "ضع_PROJECT_ID_هنا",

  storageBucket:
    "ضع_STORAGE_BUCKET_هنا",

  messagingSenderId:
    "ضع_MESSAGING_SENDER_ID_هنا",

  appId:
    "ضع_APP_ID_هنا"

};


// ======================================================
// INIT
// ======================================================

const firebaseApp =
  initializeApp(firebaseConfig);

const auth =
  getAuth(firebaseApp);

const db =
  getFirestore(firebaseApp);


// ======================================================
// STATE
// ======================================================

let currentUser = null;

let currentConversationId = null;

let currentMessages = [];

let pendingPhone = "";


// ======================================================
// DOM
// ======================================================

const loginPage =
  document.getElementById(
    "loginPage"
  );

const appPage =
  document.getElementById(
    "appPage"
  );

const phoneSection =
  document.getElementById(
    "phoneSection"
  );

const otpSection =
  document.getElementById(
    "otpSection"
  );

const phoneInput =
  document.getElementById(
    "phoneInput"
  );

const otpInput =
  document.getElementById(
    "otpInput"
  );

const sendOtpButton =
  document.getElementById(
    "sendOtpButton"
  );

const verifyOtpButton =
  document.getElementById(
    "verifyOtpButton"
  );

const backToPhoneButton =
  document.getElementById(
    "backToPhoneButton"
  );

const authMessage =
  document.getElementById(
    "authMessage"
  );

const historyElement =
  document.getElementById(
    "history"
  );

const messagesElement =
  document.getElementById(
    "messages"
  );

const emptyChat =
  document.getElementById(
    "emptyChat"
  );

const chatInput =
  document.getElementById(
    "chatInput"
  );

const sendChatButton =
  document.getElementById(
    "sendChatButton"
  );

const chatStatus =
  document.getElementById(
    "chatStatus"
  );

const newChatButton =
  document.getElementById(
    "newChatButton"
  );

const logoutButton =
  document.getElementById(
    "logoutButton"
  );


// ======================================================
// LOGO FALLBACK
// ======================================================

window.handleLogoError =
  function (image) {

    image.style.display =
      "none";

    const fallback =
      document.getElementById(
        "logoFallback"
      );

    if (fallback) {
      fallback.style.display =
        "flex";
    }
  };


// ======================================================
// AUTH MESSAGE
// ======================================================

function showAuthMessage(
  message,
  type = "info"
) {

  authMessage.textContent =
    message;

  authMessage.className =
    "message " + type;
}


function clearAuthMessage() {

  authMessage.textContent =
    "";

  authMessage.className =
    "message";
}


// ======================================================
// PHONE NORMALIZATION
// ======================================================

function normalizeSaudiPhone(
  value
) {

  let phone =
    String(value || "")
      .trim()
      .replace(/[^\d+]/g, "");


  if (
    phone.startsWith("05") &&
    phone.length === 10
  ) {

    phone =
      "+966" +
      phone.substring(1);

  } else if (
    phone.startsWith("5") &&
    phone.length === 9
  ) {

    phone =
      "+966" +
      phone;

  } else if (
    phone.startsWith("9665") &&
    phone.length === 12
  ) {

    phone =
      "+" +
      phone;
  }


  return phone;
}


function isValidSaudiPhone(
  phone
) {

  return /^\+9665\d{8}$/.test(
    phone
  );
}


// ======================================================
// OTP NORMALIZATION
// ======================================================

function normalizeOtp(
  value
) {

  const arabicNumbers = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9"
  };

  return String(value || "")
    .split("")
    .map(
      char =>
        arabicNumbers[char] ||
        char
    )
    .join("")
    .replace(/\D/g, "")
    .trim();
}


// ======================================================
// API
// ======================================================

async function apiRequest(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      {
        ...options,

        headers: {
          "Content-Type":
            "application/json",

          ...(options.headers || {})
        }
      }
    );


  const text =
    await response.text();


  let data = {};


  try {

    data =
      text
        ? JSON.parse(text)
        : {};

  } catch {

    data = {
      raw: text
    };
  }


  if (!response.ok) {

    const error =
      new Error(
        data?.message ||
        data?.error ||
        data?.raw ||
        `HTTP ${response.status}`
      );

    error.status =
      response.status;

    error.data =
      data;

    throw error;
  }


  return data;
}


// ======================================================
// SEND OTP
// ======================================================

async function sendOTP() {

  clearAuthMessage();


  const phone =
    normalizeSaudiPhone(
      phoneInput.value
    );


  if (!isValidSaudiPhone(phone)) {

    showAuthMessage(
      "اكتب رقمًا سعوديًا صحيحًا مثل +9665XXXXXXXX.",
      "error"
    );

    return;
  }


  sendOtpButton.disabled =
    true;

  sendOtpButton.textContent =
    "جارٍ إرسال الرمز...";


  try {

    const result =
      await apiRequest(
        "/api/auth/send-otp",
        {
          method: "POST",

          body:
            JSON.stringify({
              phone
            })
        }
      );


    pendingPhone =
      phone;


    phoneInput.value =
      phone;


    phoneSection.classList.add(
      "hidden"
    );

    otpSection.classList.remove(
      "hidden"
    );


    showAuthMessage(
      result.message ||
      "تم إرسال رمز التحقق إلى WhatsApp.",
      "success"
    );


    otpInput.focus();


  } catch (error) {

    console.error(
      "SEND OTP ERROR:",
      error
    );


    showAuthMessage(
      error.message ||
      "تعذر إرسال رمز WhatsApp.",
      "error"
    );


  } finally {

    sendOtpButton.disabled =
      false;

    sendOtpButton.textContent =
      "إرسال رمز التحقق";
  }
}


// ======================================================
// VERIFY OTP
// ======================================================

async function verifyOTP() {

  clearAuthMessage();


  const otp =
    normalizeOtp(
      otpInput.value
    );


  if (!pendingPhone) {

    showAuthMessage(
      "أرسل رمز التحقق أولًا.",
      "error"
    );

    return;
  }


  if (
    !/^\d{4,8}$/.test(otp)
  ) {

    showAuthMessage(
      "اكتب رمز التحقق كما وصلك في WhatsApp.",
      "error"
    );

    return;
  }


  verifyOtpButton.disabled =
    true;

  verifyOtpButton.textContent =
    "جارٍ التحقق...";


  try {

    const result =
      await apiRequest(
        "/api/auth/verify-otp",
        {
          method: "POST",

          body:
            JSON.stringify({
              phone:
                pendingPhone,

              otp:
                otp
            })
        }
      );


    if (!result.token) {

      throw new Error(
        "تم التحقق من الرمز، لكن الخادم لم يُرجع Firebase Token."
      );
    }


    await signInWithCustomToken(
      auth,
      result.token
    );


    showAuthMessage(
      "تم تسجيل الدخول بنجاح.",
      "success"
    );


  } catch (error) {

    console.error(
      "VERIFY OTP ERROR:",
      error
    );


    showAuthMessage(
      error.message ||
      "تعذر التحقق من الرمز.",
      "error"
    );


  } finally {

    verifyOtpButton.disabled =
      false;

    verifyOtpButton.textContent =
      "تأكيد الرمز";
  }
}


// ======================================================
// BACK TO PHONE
// ======================================================

function backToPhone() {

  otpSection.classList.add(
    "hidden"
  );

  phoneSection.classList.remove(
    "hidden"
  );

  otpInput.value =
    "";

  pendingPhone =
    "";

  clearAuthMessage();
}


// ======================================================
// FIRESTORE COLLECTION
// ======================================================

function conversationsCollection() {

  if (!currentUser) {

    throw new Error(
      "المستخدم غير مسجل الدخول."
    );
  }


  return collection(
    db,
    "users",
    currentUser.uid,
    "conversations"
  );
}


// ======================================================
// LOAD HISTORY
// ======================================================

async function loadHistory() {

  if (!currentUser) {
    return;
  }


  historyElement.innerHTML =
    "";


  try {

    const q =
      query(
        conversationsCollection(),
        orderBy(
          "updatedAt",
          "desc"
        )
      );


    const snapshot =
      await getDocs(q);


    snapshot.forEach(
      item => {

        const data =
          item.data();


        const button =
          document.createElement(
            "button"
          );


        button.className =
          "history-item";


        button.textContent =
          data.title ||
          "محادثة جديدة";


        button.addEventListener(
          "click",
          () =>
            openConversation(
              item.id
            )
        );


        historyElement.appendChild(
          button
        );
      }
    );


  } catch (error) {

    console.error(
      "LOAD HISTORY:",
      error
    );
  }
}


// ======================================================
// OPEN CONVERSATION
// ======================================================

async function openConversation(
  conversationId
) {

  if (!currentUser) {
    return;
  }


  try {

    const conversationRef =
      doc(
        db,
        "users",
        currentUser.uid,
        "conversations",
        conversationId
      );


    const snapshot =
      await getDoc(
        conversationRef
      );


    if (!snapshot.exists()) {

      newConversation();

      return;
    }


    const data =
      snapshot.data();


    currentConversationId =
      conversationId;


    currentMessages =
      Array.isArray(data.messages)
        ? data.messages
        : [];


    renderMessages();


  } catch (error) {

    console.error(
      "OPEN CONVERSATION:",
      error
    );
  }
}


// ======================================================
// NEW CONVERSATION
// ======================================================

function newConversation() {

  currentConversationId =
    null;

  currentMessages =
    [];

  renderMessages();

  chatInput.focus();
}


// ======================================================
// SAVE CONVERSATION
// ======================================================

async function saveConversation() {

  if (!currentUser) {
    return;
  }


  if (
    currentMessages.length === 0
  ) {
    return;
  }


  const firstUserMessage =
    currentMessages.find(
      item =>
        item.role === "user"
    );


  const title =
    firstUserMessage?.content
      ?.slice(0, 45) ||
    "محادثة جديدة";


  try {

    if (!currentConversationId) {

      const ref =
        await addDoc(
          conversationsCollection(),
          {
            title,

            messages:
              currentMessages,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()
          }
        );


      currentConversationId =
        ref.id;


    } else {

      await setDoc(

        doc(
          db,
          "users",
          currentUser.uid,
          "conversations",
          currentConversationId
        ),

        {
          title,

          messages:
            currentMessages,

          updatedAt:
            serverTimestamp()
        },

        {
          merge: true
        }

      );
    }


    await loadHistory();


  } catch (error) {

    console.error(
      "SAVE CONVERSATION:",
      error
    );
  }
}


// ======================================================
// RENDER MESSAGES
// ======================================================

function renderMessages() {

  messagesElement.innerHTML =
    "";


  if (
    currentMessages.length === 0
  ) {

    messagesElement.appendChild(
      emptyChat
    );

    return;
  }


  currentMessages.forEach(
    message => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "message-row " +
        (
          message.role === "user"
            ? "user"
            : "ai"
        );


      const bubble =
        document.createElement(
          "div"
        );


      bubble.className =
        "bubble";


      bubble.textContent =
        message.content ||
        "";


      row.appendChild(
        bubble
      );


      messagesElement.appendChild(
        row
      );
    }
  );


  messagesElement.scrollTop =
    messagesElement.scrollHeight;
}


// ======================================================
// CHAT
// ======================================================

async function sendMessage() {

  const text =
    chatInput.value.trim();


  if (!text) {
    return;
  }


  if (!currentUser) {

    alert(
      "يجب تسجيل الدخول أولًا."
    );

    return;
  }


  chatInput.value =
    "";


  currentMessages.push({
    role: "user",
    content: text
  });


  renderMessages();


  sendChatButton.disabled =
    true;


  chatStatus.textContent =
    "جاري التفكير...";


  try {

    const idToken =
      await currentUser.getIdToken(
        true
      );


    const response =
      await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${idToken}`
          },

          body:
            JSON.stringify({
              messages:
                currentMessages
            })
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.message ||
        data.error ||
        "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي."
      );
    }


    currentMessages.push({

      role:
        "assistant",

      content:
        data.reply ||
        data.message ||
        "لم يصل رد."

    });


    renderMessages();


    await saveConversation();


  } catch (error) {

    console.error(
      "CHAT ERROR:",
      error
    );


    currentMessages.push({

      role:
        "assistant",

      content:
        "حدث خطأ: " +
        error.message

    });


    renderMessages();


  } finally {

    sendChatButton.disabled =
      false;

    chatStatus.textContent =
      "";

    chatInput.focus();
  }
}


// ======================================================
// LOGOUT
// ======================================================

async function logout() {

  try {

    await signOut(auth);

  } catch (error) {

    console.error(
      "LOGOUT:",
      error
    );
  }
}


// ======================================================
// AUTH STATE
// ======================================================

onAuthStateChanged(
  auth,

  async user => {

    currentUser =
      user || null;


    if (user) {

      loginPage.style.display =
        "none";

      appPage.style.display =
        "block";


      await loadHistory();


      newConversation();


    } else {

      loginPage.style.display =
        "flex";

      appPage.style.display =
        "none";


      currentConversationId =
        null;

      currentMessages =
        [];
    }
  }
);


// ======================================================
// EVENTS
// ======================================================

sendOtpButton.addEventListener(
  "click",
  sendOTP
);

verifyOtpButton.addEventListener(
  "click",
  verifyOTP
);

backToPhoneButton.addEventListener(
  "click",
  backToPhone
);

newChatButton.addEventListener(
  "click",
  newConversation
);

logoutButton.addEventListener(
  "click",
  logout
);

sendChatButton.addEventListener(
  "click",
  sendMessage
);


chatInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendMessage();
    }
  }
);


otpInput.addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {

      event.preventDefault();

      verifyOTP();
    }
  }
);


phoneInput.addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {

      event.preventDefault();

      sendOTP();
    }
  }
);
