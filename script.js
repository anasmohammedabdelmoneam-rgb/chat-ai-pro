import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  signInWithCustomToken,
  onAuthStateChanged,
  signOut
} from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// ======================================================
// FIREBASE CONFIG
// ======================================================
//
// ضع هنا Firebase Web App config الخاص بمشروعك.
//
// Firebase Console:
// Project settings
// → General
// → Your apps
// → Web app
// → SDK setup and configuration
//
// لا تضع هنا FIREBASE_PRIVATE_KEY.
// لا تضع هنا FIREBASE_CLIENT_EMAIL.
// لا تضع هنا أي مفتاح Admin.
// ======================================================

const firebaseConfig = {
  apiKey: "PUT_YOUR_FIREBASE_WEB_API_KEY_HERE",
  authDomain: "PUT_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PUT_YOUR_PROJECT_ID_HERE",
  storageBucket: "PUT_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PUT_YOUR_SENDER_ID_HERE",
  appId: "PUT_YOUR_APP_ID_HERE"
};


// ======================================================
// FIREBASE INITIALIZATION
// ======================================================

const firebaseApp =
  initializeApp(firebaseConfig);

const auth =
  getAuth(firebaseApp);

const db =
  getFirestore(firebaseApp);


// ======================================================
// ELEMENTS
// ======================================================

const loginScreen =
  document.getElementById("loginScreen");

const appScreen =
  document.getElementById("appScreen");

const phoneStep =
  document.getElementById("phoneStep");

const otpStep =
  document.getElementById("otpStep");

const phoneInput =
  document.getElementById("phoneInput");

const otpInput =
  document.getElementById("otpInput");

const sendOtpButton =
  document.getElementById("sendOtpButton");

const verifyOtpButton =
  document.getElementById("verifyOtpButton");

const backToPhoneButton =
  document.getElementById("backToPhoneButton");

const loginStatus =
  document.getElementById("loginStatus");

const historyList =
  document.getElementById("historyList");

const newChatButton =
  document.getElementById("newChatButton");

const logoutButton =
  document.getElementById("logoutButton");

const accountPhone =
  document.getElementById("accountPhone");

const messagesContainer =
  document.getElementById("messages");

const messageInput =
  document.getElementById("messageInput");

const sendButton =
  document.getElementById("sendButton");

const chatTitle =
  document.getElementById("chatTitle");


// ======================================================
// STATE
// ======================================================

let currentPhone = "";
let currentConversationId = null;

let currentMessages = [];


// ======================================================
// HELPERS
// ======================================================

function setLoginStatus(message, isError = false) {
  loginStatus.textContent = message;
  loginStatus.style.color =
    isError ? "#ff8f9c" : "#8ddcff";
}

function cleanPhone(phone) {
  return String(phone || "")
    .trim()
    .replace(/[^\d+]/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showLogin() {
  loginScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

function showApp() {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
}

function setButtonLoading(button, loading, text) {
  button.disabled = loading;

  if (loading) {
    button.dataset.oldText =
      button.textContent;

    button.textContent = text;
  } else {
    button.textContent =
      button.dataset.oldText || button.textContent;
  }
}


// ======================================================
// SEND OTP
// ======================================================

sendOtpButton.addEventListener(
  "click",
  async () => {

    try {

      currentPhone =
        cleanPhone(phoneInput.value);

      if (!currentPhone) {
        setLoginStatus(
          "اكتب رقم الهاتف أولًا.",
          true
        );

        return;
      }

      setButtonLoading(
        sendOtpButton,
        true,
        "جاري الإرسال..."
      );

      setLoginStatus(
        "جاري إرسال رمز التحقق عبر WhatsApp..."
      );

      const response =
        await fetch("/api/auth/send-otp", {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            phone: currentPhone
          })
        });

      const data =
        await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
          data.message ||
          "تعذر إرسال رمز التحقق"
        );
      }

      phoneStep.classList.add("hidden");
      otpStep.classList.remove("hidden");

      setLoginStatus(
        "تم إرسال رمز التحقق. أدخله هنا."
      );

      otpInput.focus();

    } catch (error) {

      console.error(error);

      setLoginStatus(
        error.message ||
        "حدث خطأ أثناء إرسال الرمز.",
        true
      );

    } finally {

      setButtonLoading(
        sendOtpButton,
        false
      );
    }
  }
);


// ======================================================
// VERIFY OTP
// ======================================================

verifyOtpButton.addEventListener(
  "click",
  async () => {

    try {

      const otp =
        String(otpInput.value || "").trim();

      if (!otp) {
        setLoginStatus(
          "اكتب رمز التحقق.",
          true
        );

        return;
      }

      setButtonLoading(
        verifyOtpButton,
        true,
        "جاري التحقق..."
      );

      setLoginStatus(
        "جاري التحقق من الرمز..."
      );

      const response =
        await fetch("/api/auth/verify-otp", {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            phone: currentPhone,
            otp: otp
          })
        });

      const data =
        await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
          "رمز التحقق غير صحيح."
        );
      }

      if (!data.token) {
        throw new Error(
          "لم يستلم التطبيق Firebase Custom Token."
        );
      }

      // Firebase official custom-token flow
      await signInWithCustomToken(
        auth,
        data.token
      );

      setLoginStatus(
        "تم تسجيل الدخول بنجاح."
      );

    } catch (error) {

      console.error(
        "OTP verification error:",
        error
      );

      setLoginStatus(
        error.message ||
        "حدث خطأ أثناء تسجيل الدخول.",
        true
      );

    } finally {

      setButtonLoading(
        verifyOtpButton,
        false
      );
    }
  }
);


// ======================================================
// BACK TO PHONE
// ======================================================

backToPhoneButton.addEventListener(
  "click",
  () => {

    otpStep.classList.add("hidden");
    phoneStep.classList.remove("hidden");

    otpInput.value = "";

    setLoginStatus("");

  }
);


// ======================================================
// AUTH STATE
// ======================================================

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      showLogin();

      return;
    }

    showApp();

    accountPhone.textContent =
      currentPhone ||
      user.phoneNumber ||
      "حسابك";

    await loadConversations();

    if (!currentConversationId) {
      createNewChat();
    }
  }
);


// ======================================================
// FIRESTORE PATH
// ======================================================

function conversationsCollection() {

  if (!auth.currentUser) {
    throw new Error(
      "User is not authenticated."
    );
  }

  return collection(
    db,
    "users",
    auth.currentUser.uid,
    "conversations"
  );
}


// ======================================================
// LOAD CONVERSATIONS
// ======================================================

async function loadConversations() {

  try {

    if (!auth.currentUser) {
      return;
    }

    historyList.innerHTML = "";

    const conversationsRef =
      conversationsCollection();

    const q =
      query(
        conversationsRef,
        orderBy("updatedAt", "desc")
      );

    const snapshot =
      await getDocs(q);

    if (snapshot.empty) {

      historyList.innerHTML = `
        <div style="
          color:#7f91aa;
          text-align:center;
          padding:20px;
          font-size:13px;
        ">
          لا توجد محادثات بعد
        </div>
      `;

      return;
    }

    snapshot.forEach(
      (conversationDoc) => {

        const data =
          conversationDoc.data();

        const item =
          document.createElement("div");

        item.className =
          "history-item";

        item.dataset.id =
          conversationDoc.id;

        item.innerHTML = `
          <span class="history-title">
            ${escapeHtml(
              data.title ||
              "محادثة جديدة"
            )}
          </span>

          <button
            class="delete-chat"
            title="حذف"
          >
            ×
          </button>
        `;

        item.addEventListener(
          "click",
          async (event) => {

            if (
              event.target.classList.contains(
                "delete-chat"
              )
            ) {
              return;
            }

            await openConversation(
              conversationDoc.id
            );
          }
        );

        item
          .querySelector(".delete-chat")
          .addEventListener(
            "click",
            async (event) => {

              event.stopPropagation();

              await deleteConversation(
                conversationDoc.id
              );
            }
          );

        historyList.appendChild(item);
      }
    );

  } catch (error) {

    console.error(
      "Load conversations error:",
      error
    );

    historyList.innerHTML = `
      <div style="
        color:#ff8f9c;
        padding:15px;
        font-size:13px;
      ">
        تعذر تحميل المحادثات
      </div>
    `;
  }
}


// ======================================================
// CREATE NEW CHAT
// ======================================================

function createNewChat() {

  currentConversationId = null;

  currentMessages = [];

  chatTitle.textContent =
    "محادثة جديدة";

  messagesContainer.innerHTML = `
    <div class="welcome">
      <h2>مرحبًا بك في Chat AI Pro 👋</h2>
      <p>اكتب أي شيء تريد أن تسأل عنه.</p>
    </div>
  `;

  document
    .querySelectorAll(".history-item")
    .forEach(
      (item) =>
        item.classList.remove("active")
    );
}


// ======================================================
// SAVE NEW CONVERSATION
// ======================================================

async function saveConversation() {

  if (!auth.currentUser) {
    throw new Error(
      "يجب تسجيل الدخول أولًا."
    );
  }

  if (currentMessages.length === 0) {
    return;
  }

  const firstUserMessage =
    currentMessages.find(
      (message) =>
        message.role === "user"
    );

  const title =
    firstUserMessage
      ? firstUserMessage.content
          .substring(0, 45)
      : "محادثة جديدة";

  const conversationData = {
    title: title,
    messages: currentMessages,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  };

  if (!currentConversationId) {

    const newDoc =
      await addDoc(
        conversationsCollection(),
        conversationData
      );

    currentConversationId =
      newDoc.id;

  } else {

    await setDoc(
      doc(
        conversationsCollection(),
        currentConversationId
      ),
      {
        title: title,
        messages: currentMessages,
        updatedAt: serverTimestamp()
      },
      {
        merge: true
      }
    );
  }

  chatTitle.textContent =
    title;

  await loadConversations();
}


// ======================================================
// OPEN CONVERSATION
// ======================================================

async function openConversation(
  conversationId
) {

  try {

    const conversationRef =
      doc(
        conversationsCollection(),
        conversationId
      );

    const snapshot =
      await getDocs(
        query(
          conversationsCollection()
        )
      );

    let found = null;

    snapshot.forEach(
      (item) => {

        if (item.id === conversationId) {
          found = item;
        }
      }
    );

    if (!found) {
      throw new Error(
        "المحادثة غير موجودة."
      );
    }

    const data =
      found.data();

    currentConversationId =
      conversationId;

    currentMessages =
      Array.isArray(data.messages)
        ? data.messages
        : [];

    chatTitle.textContent =
      data.title ||
      "محادثة جديدة";

    renderMessages();

    document
      .querySelectorAll(".history-item")
      .forEach(
        (item) => {

          item.classList.toggle(
            "active",
            item.dataset.id ===
              conversationId
          );
        }
      );

  } catch (error) {

    console.error(
      "Open conversation error:",
      error
    );
  }
}


// ======================================================
// DELETE CONVERSATION
// ======================================================

async function deleteConversation(
  conversationId
) {

  try {

    await deleteDoc(
      doc(
        conversationsCollection(),
        conversationId
      )
    );

    if (
      currentConversationId ===
      conversationId
    ) {
      createNewChat();
    }

    await loadConversations();

  } catch (error) {

    console.error(
      "Delete conversation error:",
      error
    );
  }
}


// ======================================================
// RENDER MESSAGES
// ======================================================

function renderMessages() {

  messagesContainer.innerHTML = "";

  if (currentMessages.length === 0) {

    messagesContainer.innerHTML = `
      <div class="welcome">
        <h2>محادثة جديدة</h2>
        <p>اكتب أي شيء تريد أن تسأل عنه.</p>
      </div>
    `;

    return;
  }

  currentMessages.forEach(
    (message) => {

      const wrapper =
        document.createElement("div");

      wrapper.className =
        `message ${
          message.role === "user"
            ? "user"
            : "assistant"
        }`;

      const bubble =
        document.createElement("div");

      bubble.className =
        "bubble";

      bubble.textContent =
        message.content;

      wrapper.appendChild(bubble);

      messagesContainer.appendChild(
        wrapper
      );
    }
  );

  messagesContainer.scrollTop =
    messagesContainer.scrollHeight;
}


// ======================================================
// ADD MESSAGE TO UI
// ======================================================

function addMessageToUI(
  role,
  content
) {

  const welcome =
    messagesContainer.querySelector(
      ".welcome"
    );

  if (welcome) {
    welcome.remove();
  }

  const wrapper =
    document.createElement("div");

  wrapper.className =
    `message ${role}`;

  const bubble =
    document.createElement("div");

  bubble.className =
    "bubble";

  bubble.textContent =
    content;

  wrapper.appendChild(bubble);

  messagesContainer.appendChild(
    wrapper
  );

  messagesContainer.scrollTop =
    messagesContainer.scrollHeight;
}


// ======================================================
// SEND MESSAGE
// ======================================================

async function sendMessage() {

  const text =
    messageInput.value.trim();

  if (!text) {
    return;
  }

  if (!auth.currentUser) {

    alert(
      "يجب تسجيل الدخول أولًا."
    );

    return;
  }

  messageInput.value = "";

  addMessageToUI(
    "user",
    text
  );

  currentMessages.push({
    role: "user",
    content: text
  });

  sendButton.disabled = true;

  const loadingElement =
    document.createElement("div");

  loadingElement.className =
    "message assistant";

  loadingElement.id =
    "aiLoading";

  loadingElement.innerHTML = `
    <div class="bubble">
      جاري التفكير...
    </div>
  `;

  messagesContainer.appendChild(
    loadingElement
  );

  messagesContainer.scrollTop =
    messagesContainer.scrollHeight;

  try {

    // Get fresh Firebase ID token
    const idToken =
      await auth.currentUser.getIdToken(
        true
      );

    const response =
      await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${idToken}`
        },

        body: JSON.stringify({
          messages: currentMessages
        })
      });

    const data =
      await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "تعذر الحصول على رد من الذكاء الاصطناعي."
      );
    }

    const loading =
      document.getElementById(
        "aiLoading"
      );

    if (loading) {
      loading.remove();
    }

    const answer =
      data.answer ||
      "لم يصل رد.";

    addMessageToUI(
      "assistant",
      answer
    );

    currentMessages.push({
      role: "assistant",
      content: answer
    });

    await saveConversation();

  } catch (error) {

    console.error(
      "Chat error:",
      error
    );

    const loading =
      document.getElementById(
        "aiLoading"
      );

    if (loading) {
      loading.remove();
    }

    addMessageToUI(
      "assistant",
      `حدث خطأ: ${error.message}`
    );

  } finally {

    sendButton.disabled = false;

    messageInput.focus();
  }
}


// ======================================================
// EVENTS
// ======================================================

sendButton.addEventListener(
  "click",
  sendMessage
);

newChatButton.addEventListener(
  "click",
  createNewChat
);

logoutButton.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

      currentPhone = "";
      currentConversationId = null;
      currentMessages = [];

      phoneInput.value = "";
      otpInput.value = "";

      otpStep.classList.add("hidden");
      phoneStep.classList.remove("hidden");

      setLoginStatus("");

      showLogin();

    } catch (error) {

      console.error(
        "Logout error:",
        error
      );
    }
  }
);


// ======================================================
// ENTER TO SEND
// ======================================================

messageInput.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendMessage();
    }
  }
);


// ======================================================
// INITIAL STATE
// ======================================================

showLogin();
