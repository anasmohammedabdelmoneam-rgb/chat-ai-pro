/* =========================================================
   Chat AI Pro - script.js
   نسخة متوافقة مع index.html الحالي
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
========================================================= */

const API_BASE = "";

/* =========================================================
   STORAGE
========================================================= */

const STORAGE_KEYS = {
    authenticated: "chat_ai_pro_authenticated",
    phone: "chat_ai_pro_phone",
    conversations: "chat_ai_pro_conversations",
    currentConversation: "chat_ai_pro_current_conversation"
};

/* =========================================================
   STATE
========================================================= */

let conversations = loadConversations();
let currentConversationId =
    localStorage.getItem(STORAGE_KEYS.currentConversation) || null;

let pendingPhone = "";
let isSending = false;

/* =========================================================
   DOM
========================================================= */

function $(id) {
    return document.getElementById(id);
}

function firstElement(...ids) {
    for (const id of ids) {
        const element = $(id);

        if (element) {
            return element;
        }
    }

    return null;
}

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    console.log("[Chat AI Pro] script.js loaded");

    setupAuthentication();
    setupChat();
    setupExtraButtons();

    if (isAuthenticated()) {
        showApp();
        initializeChat();
    } else {
        showAuth();
        showPhoneStep();
    }
});

/* =========================================================
   AUTHENTICATION
========================================================= */

function setupAuthentication() {

    const sendOtpButton = $("sendOtpBtn");
    const verifyOtpButton = $("verifyOtpBtn");
    const resendOtpButton = $("resendOtpBtn");
    const backButton = $("backToPhoneBtn");

    const phoneInput = $("phoneInput");
    const otpInput = $("otpInput");

    /* إرسال OTP */

    if (sendOtpButton) {
        sendOtpButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            console.log("[Auth] Send OTP clicked");

            sendOtp();
        });
    }

    /* تحقق OTP */

    if (verifyOtpButton) {
        verifyOtpButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            console.log("[Auth] Verify OTP clicked");

            verifyOtp();
        });
    }

    /* إعادة الإرسال */

    if (resendOtpButton) {
        resendOtpButton.addEventListener("click", (event) => {
            event.preventDefault();

            console.log("[Auth] Resend OTP clicked");

            sendOtp();
        });
    }

    /* تغيير الرقم */

    if (backButton) {
        backButton.addEventListener("click", (event) => {
            event.preventDefault();

            pendingPhone = "";

            showPhoneStep();
        });
    }

    /* رقم الجوال */

    if (phoneInput) {

        phoneInput.addEventListener("input", () => {

            phoneInput.value =
                phoneInput.value.replace(/\D/g, "");

            clearAuthMessages();
        });

        phoneInput.addEventListener("keydown", (event) => {

            if (event.key === "Enter") {

                event.preventDefault();

                sendOtp();
            }
        });
    }

    /* OTP */

    if (otpInput) {

        otpInput.addEventListener("input", () => {

            otpInput.value =
                otpInput.value.replace(/\D/g, "").slice(0, 6);

            clearAuthMessages();
        });

        otpInput.addEventListener("keydown", (event) => {

            if (event.key === "Enter") {

                event.preventDefault();

                verifyOtp();
            }
        });
    }

    /* تسجيل الخروج */

    const logoutBtn = $("logoutBtn");

    if (logoutBtn) {

        logoutBtn.addEventListener("click", (event) => {

            event.preventDefault();

            logout();
        });
    }
}

/* =========================================================
   PHONE NORMALIZATION
========================================================= */

function normalizeSaudiPhone(value) {

    if (!value) {
        return null;
    }

    let phone = String(value)
        .trim()
        .replace(/[\s\-()]/g, "");

    /* 05XXXXXXXX */

    if (/^05\d{8}$/.test(phone)) {

        return "+966" + phone.substring(1);
    }

    /* 5XXXXXXXX */

    if (/^5\d{8}$/.test(phone)) {

        return "+966" + phone;
    }

    /* 9665XXXXXXXX */

    if (/^9665\d{8}$/.test(phone)) {

        return "+" + phone;
    }

    /* +9665XXXXXXXX */

    if (/^\+9665\d{8}$/.test(phone)) {

        return phone;
    }

    return null;
}

/* =========================================================
   SEND OTP
========================================================= */

async function sendOtp() {

    if (isSending) {
        return;
    }

    const phoneInput = $("phoneInput");
    const sendButton = $("sendOtpBtn");

    if (!phoneInput) {

        showAuthError(
            "لم يتم العثور على خانة رقم الجوال."
        );

        return;
    }

    const phone = normalizeSaudiPhone(
        phoneInput.value
    );

    if (!phone) {

        showAuthError(
            "أدخل رقم جوال سعودي صحيح، مثل 5XXXXXXXX."
        );

        phoneInput.focus();

        return;
    }

    pendingPhone = phone;

    isSending = true;

    clearAuthMessages();

    setButtonLoading(
        sendButton,
        true,
        "جارٍ إرسال الرمز..."
    );

    try {

        const response = await fetch(
            `${API_BASE}/api/auth/send-otp`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },

                body: JSON.stringify({
                    phone: phone
                })
            }
        );

        const data =
            await parseJsonResponse(response);

        if (!response.ok || data.success === false) {

            throw new Error(
                data.message ||
                data.error ||
                "تعذر إرسال رمز التحقق."
            );
        }

        console.log(
            "[Auth] OTP sent successfully"
        );

        const sentPhone = $("sentPhone");

        if (sentPhone) {
            sentPhone.textContent = phone;
        }

        showOtpStep();

        showAuthSuccess(
            "تم إرسال رمز التحقق إلى WhatsApp."
        );

    } catch (error) {

        console.error(
            "[Auth] Send OTP error:",
            error
        );

        showAuthError(
            error.message ||
            "حدث خطأ أثناء إرسال رمز التحقق."
        );

    } finally {

        isSending = false;

        setButtonLoading(
            sendButton,
            false,
            "إرسال رمز التحقق"
        );
    }
}

/* =========================================================
   VERIFY OTP
========================================================= */

async function verifyOtp() {

    if (isSending) {
        return;
    }

    const otpInput = $("otpInput");
    const verifyButton = $("verifyOtpBtn");

    if (!otpInput) {

        showAuthError(
            "لم يتم العثور على خانة رمز التحقق."
        );

        return;
    }

    const otp =
        String(otpInput.value || "")
            .trim();

    if (!/^\d{4,6}$/.test(otp)) {

        showAuthError(
            "أدخل رمز التحقق المكوّن من الأرقام."
        );

        otpInput.focus();

        return;
    }

    if (!pendingPhone) {

        showPhoneStep();

        showAuthError(
            "أدخل رقم الجوال أولًا."
        );

        return;
    }

    isSending = true;

    clearAuthMessages();

    setButtonLoading(
        verifyButton,
        true,
        "جارٍ التحقق..."
    );

    showAuthLoading(true);

    try {

        const response = await fetch(
            `${API_BASE}/api/auth/verify-otp`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },

                body: JSON.stringify({
                    phone: pendingPhone,
                    otp: otp
                })
            }
        );

        const data =
            await parseJsonResponse(response);

        if (!response.ok || data.success === false) {

            throw new Error(
                data.message ||
                data.error ||
                "رمز التحقق غير صحيح."
            );
        }

        console.log(
            "[Auth] OTP verified successfully"
        );

        localStorage.setItem(
            STORAGE_KEYS.authenticated,
            "true"
        );

        localStorage.setItem(
            STORAGE_KEYS.phone,
            pendingPhone
        );

        showApp();

        initializeChat();

    } catch (error) {

        console.error(
            "[Auth] Verify OTP error:",
            error
        );

        showAuthError(
            error.message ||
            "حدث خطأ أثناء التحقق."
        );

    } finally {

        isSending = false;

        showAuthLoading(false);

        setButtonLoading(
            verifyButton,
            false,
            "تحقق ودخول"
        );
    }
}

/* =========================================================
   AUTH UI
========================================================= */

function showAuth() {

    const authScreen = $("authScreen");
    const app = $("app");

    if (authScreen) {

        authScreen.classList.remove("hidden");

        authScreen.style.display = "flex";
    }

    if (app) {

        app.classList.add("hidden");

        app.style.display = "none";
    }
}

function showApp() {

    const authScreen = $("authScreen");
    const app = $("app");

    if (authScreen) {

        authScreen.classList.add("hidden");

        authScreen.style.display = "none";
    }

    if (app) {

        app.classList.remove("hidden");

        app.style.display = "";
    }

    updateUserPhone();
}

function showPhoneStep() {

    const phoneStep = $("phoneStep");
    const otpStep = $("otpStep");

    if (phoneStep) {

        phoneStep.classList.remove("hidden");

        phoneStep.style.display = "";
    }

    if (otpStep) {

        otpStep.classList.add("hidden");

        otpStep.style.display = "none";
    }

    clearAuthMessages();

    const phoneInput = $("phoneInput");

    if (phoneInput) {

        setTimeout(() => {

            phoneInput.focus();

        }, 100);
    }
}

function showOtpStep() {

    const phoneStep = $("phoneStep");
    const otpStep = $("otpStep");
    const otpInput = $("otpInput");

    if (phoneStep) {

        phoneStep.classList.add("hidden");

        phoneStep.style.display = "none";
    }

    if (otpStep) {

        otpStep.classList.remove("hidden");

        otpStep.style.display = "";
    }

    if (otpInput) {

        otpInput.value = "";

        setTimeout(() => {

            otpInput.focus();

        }, 100);
    }
}

function showAuthLoading(show) {

    const loading = $("authLoading");

    if (!loading) {
        return;
    }

    if (show) {

        loading.classList.remove("hidden");

        loading.style.display = "flex";

    } else {

        loading.classList.add("hidden");

        loading.style.display = "none";
    }
}

function showAuthError(message) {

    const phoneError = $("phoneError");
    const otpError = $("otpError");

    const otpStep = $("otpStep");

    if (otpStep && !otpStep.classList.contains("hidden")) {

        if (otpError) {

            otpError.textContent = message;

            otpError.style.display = "";
        }

    } else {

        if (phoneError) {

            phoneError.textContent = message;

            phoneError.style.display = "";
        }
    }
}

function showAuthSuccess(message) {

    const phoneError = $("phoneError");
    const otpError = $("otpError");

    const otpStep = $("otpStep");

    const target =
        otpStep &&
        !otpStep.classList.contains("hidden")
            ? otpError
            : phoneError;

    if (target) {

        target.textContent = message;

        target.style.color = "#55d6a5";

        target.style.display = "";
    }
}

function clearAuthMessages() {

    const errors = [
        $("phoneError"),
        $("otpError")
    ];

    errors.forEach((element) => {

        if (!element) {
            return;
        }

        element.textContent = "";

        element.style.display = "none";

        element.style.color = "";
    });
}

function setButtonLoading(
    button,
    loading,
    loadingText
) {

    if (!button) {
        return;
    }

    if (loading) {

        if (!button.dataset.originalText) {

            button.dataset.originalText =
                button.textContent;
        }

        button.disabled = true;

        button.textContent =
            loadingText;

    } else {

        button.disabled = false;

        button.textContent =
            button.dataset.originalText ||
            button.textContent;
    }
}

/* =========================================================
   AUTH STATE
========================================================= */

function isAuthenticated() {

    return (
        localStorage.getItem(
            STORAGE_KEYS.authenticated
        ) === "true"
    );
}

function logout() {

    localStorage.removeItem(
        STORAGE_KEYS.authenticated
    );

    localStorage.removeItem(
        STORAGE_KEYS.phone
    );

    pendingPhone = "";

    const otpInput = $("otpInput");

    if (otpInput) {
        otpInput.value = "";
    }

    showAuth();

    showPhoneStep();
}

/* =========================================================
   USER PHONE
========================================================= */

function updateUserPhone() {

    const userPhone = $("userPhone");

    if (!userPhone) {
        return;
    }

    const phone =
        localStorage.getItem(
            STORAGE_KEYS.phone
        );

    userPhone.textContent =
        phone || "مستخدم";
}

/* =========================================================
   CHAT SETUP
========================================================= */

function setupChat() {

    const sendBtn = $("sendBtn");
    const messageInput = $("message");

    if (sendBtn) {

        sendBtn.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                sendMessage();
            }
        );
    }

    if (messageInput) {

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

        messageInput.addEventListener(
            "input",
            autoResizeInput
        );
    }

    const newChatBtn = $("newChatBtn");

    if (newChatBtn) {

        newChatBtn.addEventListener(
            "click",
            () => {

                createNewConversation(true);
            }
        );
    }

    const clearBtn = $("clearBtn");

    if (clearBtn) {

        clearBtn.addEventListener(
            "click",
            () => {

                createNewConversation(true);
            }
        );
    }

    setupMobileSidebar();
}

/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

    if (isSending) {
        return;
    }

    const input = $("message");
    const sendBtn = $("sendBtn");

    if (!input) {

        console.error(
            "[Chat] Message input not found"
        );

        return;
    }

    const message =
        String(input.value || "")
            .trim();

    if (!message) {

        input.focus();

        return;
    }

    if (!isAuthenticated()) {

        showAuth();

        return;
    }

    isSending = true;

    input.value = "";

    autoResizeInput({
        target: input
    });

    if (!currentConversationId) {

        createNewConversation(false);
    }

    addMessageToCurrentConversation(
        "user",
        message
    );

    saveConversations();

    renderMessages();

    renderConversationList();

    scrollChatToBottom();

    setButtonLoading(
        sendBtn,
        true,
        "..."
    );

    const typing = addTypingIndicator();

    try {

        const conversation =
            getCurrentConversation();

        /*
         * IMPORTANT:
         * server.js الحالي يستقبل:
         *
         * {
         *   messages: [
         *     { role: "user", content: "..." }
         *   ]
         * }
         */

        const messages =
            conversation.messages
                .filter(
                    (item) =>
                        item.role === "user" ||
                        item.role === "assistant"
                )
                .map(
                    (item) => ({
                        role: item.role,
                        content: String(
                            item.content || ""
                        )
                    })
                )
                .slice(-30);

        const response =
            await fetch(
                `${API_BASE}/api/chat`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({
                        messages: messages
                    })
                }
            );

        const data =
            await parseJsonResponse(
                response
            );

        removeTypingIndicator(
            typing
        );

        if (!response.ok) {

            throw new Error(
                data.error ||
                data.message ||
                "تعذر الحصول على رد من الخادم."
            );
        }

        const answer =
            data.answer ||
            data.response ||
            data.message;

        if (
            typeof answer !== "string" ||
            !answer.trim()
        ) {

            throw new Error(
                "لم يصل رد من الذكاء الاصطناعي."
            );
        }

        addMessageToCurrentConversation(
            "assistant",
            answer
        );

        saveConversations();

        renderMessages();

        renderConversationList();

        scrollChatToBottom();

    } catch (error) {

        removeTypingIndicator(
            typing
        );

        console.error(
            "[Chat] Error:",
            error
        );

        addMessageToCurrentConversation(
            "error",
            error.message ||
            "حدث خطأ أثناء الاتصال بالخادم."
        );

        saveConversations();

        renderMessages();

        scrollChatToBottom();

    } finally {

        isSending = false;

        setButtonLoading(
            sendBtn,
            false,
            "➤"
        );

        input.focus();
    }
}

/* =========================================================
   PARSE JSON
========================================================= */

async function parseJsonResponse(response) {

    const text =
        await response.text();

    if (!text) {
        return {};
    }

    try {

        return JSON.parse(text);

    } catch {

        return {
            success: false,
            error: text,
            message: text
        };
    }
}

/* =========================================================
   CONVERSATIONS
========================================================= */

function loadConversations() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEYS.conversations
            );

        if (!saved) {
            return [];
        }

        const parsed =
            JSON.parse(saved);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.error(
            "[Storage] Load error:",
            error
        );

        return [];
    }
}

function saveConversations() {

    try {

        localStorage.setItem(
            STORAGE_KEYS.conversations,
            JSON.stringify(
                conversations
            )
        );

        if (currentConversationId) {

            localStorage.setItem(
                STORAGE_KEYS.currentConversation,
                currentConversationId
            );
        }

    } catch (error) {

        console.error(
            "[Storage] Save error:",
            error
        );
    }
}

function createNewConversation(
    render = true
) {

    const conversation = {

        id:
            "conversation_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 8),

        title:
            "محادثة جديدة",

        createdAt:
            new Date().toISOString(),

        messages: []
    };

    conversations.unshift(
        conversation
    );

    currentConversationId =
        conversation.id;

    saveConversations();

    if (render) {

        renderMessages();

        renderConversationList();
    }

    closeMobileSidebar();

    return conversation;
}

function getCurrentConversation() {

    return conversations.find(
        (conversation) =>
            conversation.id ===
            currentConversationId
    );
}

function addMessageToCurrentConversation(
    role,
    content
) {

    let conversation =
        getCurrentConversation();

    if (!conversation) {

        conversation =
            createNewConversation(false);
    }

    conversation.messages.push({

        id:
            "message_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 8),

        role: role,

        content: String(
            content || ""
        ),

        timestamp:
            new Date().toISOString()
    });

    if (
        role === "user" &&
        conversation.title ===
            "محادثة جديدة"
    ) {

        conversation.title =
            makeConversationTitle(
                content
            );
    }

    saveConversations();
}

/* =========================================================
   TITLE
========================================================= */

function makeConversationTitle(text) {

    const clean =
        String(text || "")
            .replace(/\s+/g, " ")
            .trim();

    if (!clean) {

        return "محادثة جديدة";
    }

    if (clean.length <= 30) {

        return clean;
    }

    return (
        clean.substring(0, 30) +
        "..."
    );
}

/* =========================================================
   INITIALIZE CHAT
========================================================= */

function initializeChat() {

    conversations =
        loadConversations();

    currentConversationId =
        localStorage.getItem(
            STORAGE_KEYS.currentConversation
        ) || null;

    if (
        !currentConversationId ||
        !getCurrentConversation()
    ) {

        if (conversations.length > 0) {

            currentConversationId =
                conversations[0].id;

        } else {

            createNewConversation(
                false
            );
        }
    }

    saveConversations();

    renderMessages();

    renderConversationList();

    updateUserPhone();
}

/* =========================================================
   RENDER MESSAGES
========================================================= */

function renderMessages() {

    const chat = $("chat");

    if (!chat) {
        return;
    }

    const conversation =
        getCurrentConversation();

    /* امسح الرسائل القديمة مع الحفاظ على welcome */

    const oldMessages =
        chat.querySelectorAll(
            ".message-row, .message, .typing-message"
        );

    oldMessages.forEach(
        (element) =>
            element.remove()
    );

    const welcome =
        $("welcome");

    if (
        !conversation ||
        !conversation.messages ||
        conversation.messages.length === 0
    ) {

        if (welcome) {

            welcome.style.display = "";
        }

        return;
    }

    if (welcome) {

        welcome.style.display = "none";
    }

    for (
        const message of
        conversation.messages
    ) {

        const element =
            createMessageElement(
                message
            );

        chat.appendChild(
            element
        );
    }

    scrollChatToBottom();
}

/* =========================================================
   MESSAGE ELEMENT
========================================================= */

function createMessageElement(
    message
) {

    const row =
        document.createElement("div");

    row.className =
        "message-row " +
        (
            message.role === "user"
                ? "user"
                : "assistant"
        );

    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";

    if (message.role === "user") {

        bubble.textContent =
            message.content;

    } else {

        bubble.innerHTML =
            formatAIText(
                message.content
            );
    }

    row.appendChild(
        bubble
    );

    return row;
}

/* =========================================================
   SAFE MARKDOWN
========================================================= */

function escapeHTML(text) {

    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatAIText(text) {

    let html =
        escapeHTML(text);

    /* code blocks */

    html =
        html.replace(
            /```([\s\S]*?)```/g,
            "<pre><code>$1</code></pre>"
        );

    /* inline code */

    html =
        html.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        );

    /* bold */

    html =
        html.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );

    /* headings */

    html =
        html.replace(
            /^### (.*)$/gm,
            "<strong>$1</strong>"
        );

    html =
        html.replace(
            /^## (.*)$/gm,
            "<strong>$1</strong>"
        );

    /* unordered lists */

    html =
        html.replace(
            /^[-•] (.*)$/gm,
            "• $1"
        );

    /* new lines */

    html =
        html.replace(
            /\n/g,
            "<br>"
        );

    return html;
}

/* =========================================================
   TYPING INDICATOR
========================================================= */

function addTypingIndicator() {

    const chat = $("chat");

    if (!chat) {
        return null;
    }

    const element =
        document.createElement("div");

    element.className =
        "message-row assistant typing-message";

    element.innerHTML = `
        <div class="message-bubble">
            <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;

    chat.appendChild(
        element
    );

    scrollChatToBottom();

    return element;
}

function removeTypingIndicator(
    element
) {

    if (
        element &&
        element.parentNode
    ) {

        element.remove();
    }
}

/* =========================================================
   CONVERSATION LIST
========================================================= */

function renderConversationList() {

    const container =
        $("conversationList");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (conversations.length === 0) {

        container.innerHTML = `
            <div class="empty-history">
                لا توجد محادثات حتى الآن
            </div>
        `;

        return;
    }

    conversations.forEach(
        (conversation) => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "conversation-item";

            if (
                conversation.id ===
                currentConversationId
            ) {

                item.classList.add(
                    "active"
                );
            }

            const main =
                document.createElement(
                    "div"
                );

            main.className =
                "conversation-main";

            const title =
                document.createElement(
                    "div"
                );

            title.className =
                "conversation-title";

            title.textContent =
                conversation.title ||
                "محادثة جديدة";

            const date =
                document.createElement(
                    "div"
                );

            date.className =
                "conversation-date";

            date.textContent =
                formatDate(
                    conversation.createdAt
                );

            main.appendChild(
                title
            );

            main.appendChild(
                date
            );

            item.appendChild(
                main
            );

            /* فتح المحادثة */

            item.addEventListener(
                "click",
                () => {

                    currentConversationId =
                        conversation.id;

                    saveConversations();

                    renderMessages();

                    renderConversationList();

                    closeMobileSidebar();
                }
            );

            container.appendChild(
                item
            );
        }
    );
}

/* =========================================================
   DATE
========================================================= */

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }

    try {

        return new Intl.DateTimeFormat(
            "ar-SA",
            {
                day: "numeric",
                month: "short"
            }
        ).format(
            new Date(dateString)
        );

    } catch {

        return "";
    }
}

/* =========================================================
   SCROLL
========================================================= */

function scrollChatToBottom() {

    const chat = $("chat");

    if (!chat) {
        return;
    }

    setTimeout(() => {

        chat.scrollTop =
            chat.scrollHeight;

    }, 50);
}

/* =========================================================
   TEXTAREA RESIZE
========================================================= */

function autoResizeInput(event) {

    const input =
        event?.target ||
        $("message");

    if (!input) {
        return;
    }

    input.style.height =
        "auto";

    input.style.height =
        Math.min(
            input.scrollHeight,
            180
        ) + "px";
}

/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function setupMobileSidebar() {

    const menuBtn =
        $("menuBtn");

    const overlay =
        $("sidebarOverlay");

    if (menuBtn) {

        menuBtn.addEventListener(
            "click",
            openMobileSidebar
        );
    }

    if (overlay) {

        overlay.addEventListener(
            "click",
            closeMobileSidebar
        );
    }
}

function openMobileSidebar() {

    const sidebar =
        document.querySelector(
            ".sidebar"
        );

    const overlay =
        $("sidebarOverlay");

    if (sidebar) {

        sidebar.classList.add(
            "open"
        );
    }

    if (overlay) {

        overlay.classList.add(
            "open"
        );
    }
}

function closeMobileSidebar() {

    const sidebar =
        document.querySelector(
            ".sidebar"
        );

    const overlay =
        $("sidebarOverlay");

    if (sidebar) {

        sidebar.classList.remove(
            "open"
        );
    }

    if (overlay) {

        overlay.classList.remove(
            "open"
        );
    }
}

/* =========================================================
   EXTRA BUTTONS
========================================================= */

function setupExtraButtons() {

    /* أي زر قد يكون موجودًا في النسخ المستقبلية */

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape"
            ) {

                closeMobileSidebar();
            }
        }
    );
}

/* =========================================================
   DEBUG
========================================================= */

window.ChatAIPro = {

    sendOtp,
    verifyOtp,
    sendMessage,
    logout,

    showAuth,
    showApp,

    getState: () => ({
        authenticated:
            isAuthenticated(),

        phone:
            localStorage.getItem(
                STORAGE_KEYS.phone
            ),

        conversations:
            conversations.length,

        currentConversationId
    })
};

console.log(
    "[Chat AI Pro] Ready."
);
