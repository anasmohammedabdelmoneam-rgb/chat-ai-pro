/* =========================================================
   Chat AI Pro - script.js
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
    localStorage.getItem(
        STORAGE_KEYS.currentConversation
    ) || null;

let pendingPhone = "";
let isSending = false;

/* =========================================================
   DOM HELPERS
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
    setupAuthentication();
    setupChat();

    if (isAuthenticated()) {
        showApp();
        initializeChat();
    } else {
        showAuth();
    }
});

/* =========================================================
   AUTHENTICATION
   ========================================================= */

function setupAuthentication() {
    const phoneForm = firstElement(
        "phoneForm",
        "loginForm"
    );

    const otpForm = firstElement(
        "otpForm"
    );

    const sendOtpButton = firstElement(
  "sendOtpBtn",
  "sendOtpButton",
  "sendOTPButton",
  "continueButton"
);

const verifyOtpButton = firstElement(
  "verifyOtpBtn",
  "verifyOtpButton",
  "verifyOTPButton"
);
    const phoneInput = firstElement(
        "phoneInput",
        "phone"
    );

    const otpInput = firstElement(
        "otpInput",
        "otp"
    );

    if (phoneForm) {
        phoneForm.addEventListener(
            "submit",
            (event) => {
                event.preventDefault();

                sendOtp();
            }
        );
    }

    if (otpForm) {
        otpForm.addEventListener(
            "submit",
            (event) => {
                event.preventDefault();

                verifyOtp();
            }
        );
    }

    if (sendOtpButton) {
        sendOtpButton.addEventListener(
            "click",
            (event) => {
                if (
                    sendOtpButton.tagName !==
                    "BUTTON" ||
                    sendOtpButton.type !==
                    "submit"
                ) {
                    event.preventDefault();

                    sendOtp();
                }
            }
        );
    }

    if (verifyOtpButton) {
        verifyOtpButton.addEventListener(
            "click",
            (event) => {
                if (
                    verifyOtpButton.tagName !==
                    "BUTTON" ||
                    verifyOtpButton.type !==
                    "submit"
                ) {
                    event.preventDefault();

                    verifyOtp();
                }
            }
        );
    }

    if (phoneInput) {
        phoneInput.addEventListener(
            "input",
            () => {
                phoneInput.value =
                    phoneInput.value.replace(
                        /[^\d+]/g,
                        ""
                    );
            }
        );

        phoneInput.addEventListener(
            "keydown",
            (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();

                    sendOtp();
                }
            }
        );
    }

    if (otpInput) {
        otpInput.addEventListener(
            "input",
            () => {
                otpInput.value =
                    otpInput.value.replace(
                        /\D/g,
                        ""
                    );
            }
        );

        otpInput.addEventListener(
            "keydown",
            (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();

                    verifyOtp();
                }
            }
        );
    }

    const logoutButton = firstElement(
        "logoutButton",
        "logoutBtn"
    );

    if (logoutButton) {
        logoutButton.addEventListener(
            "click",
            logout
        );
    }

    const backButton = firstElement(
        "backToPhone",
        "backButton"
    );

    if (backButton) {
        backButton.addEventListener(
            "click",
            showPhoneStep
        );
    }
}

/* =========================================================
   PHONE NORMALIZATION
   ========================================================= */

function normalizeSaudiPhone(phone) {
    if (!phone) {
        return null;
    }

    let value =
        String(phone).trim();

    value =
        value.replace(
            /[\s\-()]/g,
            ""
        );

    if (/^05\d{8}$/.test(value)) {
        return (
            "+966" +
            value.substring(1)
        );
    }

    if (/^5\d{8}$/.test(value)) {
        return (
            "+966" +
            value
        );
    }

    if (/^9665\d{8}$/.test(value)) {
        return (
            "+" +
            value
        );
    }

    if (/^\+9665\d{8}$/.test(value)) {
        return value;
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

    const phoneInput =
        firstElement(
            "phoneInput",
            "phone"
        );

    if (!phoneInput) {
        showAuthError(
            "لم يتم العثور على خانة رقم الجوال."
        );

        return;
    }

    const phone =
        normalizeSaudiPhone(
            phoneInput.value
        );

    if (!phone) {
        showAuthError(
            "أدخل رقم جوال سعودي صحيح."
        );

        return;
    }

    pendingPhone = phone;

    const button =
        firstElement(
            "sendOtpButton",
            "sendOTPButton",
            "continueButton"
        );

    setButtonLoading(
        button,
        true,
        "جارٍ الإرسال..."
    );

    clearAuthError();

    try {
        const response =
            await fetch(
                `${API_BASE}/api/auth/send-otp`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({
                        phone: phone
                    })
                }
            );

        const data =
            await parseJsonResponse(
                response
            );

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.message ||
                "تعذر إرسال رمز التحقق عبر WhatsApp."
            );
        }

        showOtpStep();

        showAuthMessage(
            "تم إرسال رمز التحقق إلى WhatsApp."
        );

    } catch (error) {
        console.error(
            "Send OTP error:",
            error
        );

        showAuthError(
            error.message ||
            "حدث خطأ أثناء إرسال رمز التحقق."
        );

    } finally {
        setButtonLoading(
            button,
            false,
            "إرسال الرمز"
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

    const otpInput =
        firstElement(
            "otpInput",
            "otp"
        );

    if (!otpInput) {
        showAuthError(
            "لم يتم العثور على خانة رمز التحقق."
        );

        return;
    }

    const otp =
        String(
            otpInput.value || ""
        ).trim();

    if (!/^\d{4,8}$/.test(otp)) {
        showAuthError(
            "أدخل رمز التحقق بشكل صحيح."
        );

        return;
    }

    if (!pendingPhone) {
        showPhoneStep();

        showAuthError(
            "أدخل رقم الجوال أولًا."
        );

        return;
    }

    const button =
        firstElement(
            "verifyOtpButton",
            "verifyOTPButton"
        );

    setButtonLoading(
        button,
        true,
        "جارٍ التحقق..."
    );

    clearAuthError();

    try {
        const response =
            await fetch(
                `${API_BASE}/api/auth/verify-otp`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({
                        phone:
                            pendingPhone,
                        otp: otp
                    })
                }
            );

        const data =
            await parseJsonResponse(
                response
            );

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.message ||
                "رمز التحقق غير صحيح."
            );
        }

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
            "Verify OTP error:",
            error
        );

        showAuthError(
            error.message ||
            "حدث خطأ أثناء التحقق."
        );

    } finally {
        setButtonLoading(
            button,
            false,
            "تحقق"
        );
    }
}

/* =========================================================
   AUTH UI
   ========================================================= */

function showAuth() {
    const authScreen =
        firstElement(
            "authScreen",
            "loginScreen",
            "auth"
        );

    const appScreen =
        firstElement(
            "appScreen",
            "chatApp",
            "app"
        );

    if (authScreen) {
        authScreen.style.display =
            "";
    }

    if (appScreen) {
        appScreen.style.display =
            "none";
    }
}

function showApp() {
    const authScreen =
        firstElement(
            "authScreen",
            "loginScreen",
            "auth"
        );

    const appScreen =
        firstElement(
            "appScreen",
            "chatApp",
            "app"
        );

    if (authScreen) {
        authScreen.style.display =
            "none";
    }

    if (appScreen) {
        appScreen.style.display =
            "";
    }
}

function showPhoneStep() {
    const phoneStep =
        firstElement(
            "phoneStep",
            "loginStep"
        );

    const otpStep =
        firstElement(
            "otpStep"
        );

    if (phoneStep) {
        phoneStep.style.display =
            "";
    }

    if (otpStep) {
        otpStep.style.display =
            "none";
    }

    clearAuthError();
}

function showOtpStep() {
    const phoneStep =
        firstElement(
            "phoneStep",
            "loginStep"
        );

    const otpStep =
        firstElement(
            "otpStep"
        );

    if (phoneStep) {
        phoneStep.style.display =
            "none";
    }

    if (otpStep) {
        otpStep.style.display =
            "";
    }

    const otpInput =
        firstElement(
            "otpInput",
            "otp"
        );

    if (otpInput) {
        setTimeout(
            () => otpInput.focus(),
            100
        );
    }
}

function showAuthError(message) {
    const element =
        firstElement(
            "authError",
            "loginError",
            "errorMessage"
        );

    if (!element) {
        alert(message);
        return;
    }

    element.textContent =
        message;

    element.style.display =
        "";
}

function showAuthMessage(message) {
    const element =
        firstElement(
            "authMessage",
            "loginMessage",
            "successMessage"
        );

    if (element) {
        element.textContent =
            message;

        element.style.display =
            "";
    }
}

function clearAuthError() {
    const element =
        firstElement(
            "authError",
            "loginError",
            "errorMessage"
        );

    if (element) {
        element.textContent = "";

        element.style.display =
            "none";
    }
}

/* =========================================================
   LOGOUT
   ========================================================= */

function logout() {
    localStorage.removeItem(
        STORAGE_KEYS.authenticated
    );

    localStorage.removeItem(
        STORAGE_KEYS.phone
    );

    pendingPhone = "";

    showAuth();
    showPhoneStep();
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

/* =========================================================
   CHAT SETUP
   ========================================================= */

function setupChat() {
    const sendButton =
        firstElement(
            "sendButton",
            "sendBtn",
            "submitButton"
        );

    const messageInput =
        firstElement(
            "messageInput",
            "message",
            "chatInput",
            "userInput"
        );

    if (sendButton) {
        sendButton.addEventListener(
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

    const newChatButton =
        firstElement(
            "newChatButton",
            "newChat",
            "newConversation"
        );

    if (newChatButton) {
        newChatButton.addEventListener(
            "click",
            createNewConversation
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

    const input =
        firstElement(
            "messageInput",
            "message",
            "chatInput",
            "userInput"
        );

    if (!input) {
        console.error(
            "Chat input not found."
        );

        return;
    }

    const message =
        String(
            input.value || ""
        ).trim();

    if (!message) {
        return;
    }

    if (!isAuthenticated()) {
        showAuth();

        return;
    }

    isSending = true;

    const sendButton =
        firstElement(
            "sendButton",
            "sendBtn",
            "submitButton"
        );

    input.value = "";

    autoResizeInput({
        target: input
    });

    // Create conversation if necessary
    if (!currentConversationId) {
        createNewConversation(
            false
        );
    }

    // User message
    addMessageToCurrentConversation(
        "user",
        message
    );

    renderMessages();

    scrollChatToBottom();

    setButtonLoading(
        sendButton,
        true,
        "..."
    );

    const typingElement =
        addTypingIndicator();

    try {
        /*
         * IMPORTANT:
         *
         * The server expects:
         *
         * {
         *     "message": "..."
         * }
         *
         * This fixes the previous
         * "اكتب رسالة أولاً" problem.
         */

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
                        message:
                            message
                    })
                }
            );

        const data =
            await parseJsonResponse(
                response
            );

        removeTypingIndicator(
            typingElement
        );

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.message ||
                "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي."
            );
        }

        const answer =
            data.answer ||
            data.response ||
            data.message;

        if (!answer) {
            throw new Error(
                "لم يصل رد من الذكاء الاصطناعي."
            );
        }

        addMessageToCurrentConversation(
            "assistant",
            answer,
            data.provider
        );

        saveConversations();

        renderMessages();

        renderConversationList();

        scrollChatToBottom();

    } catch (error) {
        removeTypingIndicator(
            typingElement
        );

        console.error(
            "Chat error:",
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
            sendButton,
            false,
            ""
        );

        input.focus();
    }
}

/* =========================================================
   PARSE JSON
   ========================================================= */

async function parseJsonResponse(
    response
) {
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
            "Could not load conversations:",
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
            "Could not save conversations:",
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
                .substring(2, 8),

        title: "محادثة جديدة",

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
    content,
    provider = null
) {
    let conversation =
        getCurrentConversation();

    if (!conversation) {
        conversation =
            createNewConversation(
                false
            );
    }

    conversation.messages.push({
        id:
            "message_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 8),

        role: role,

        content: content,

        provider: provider,

        timestamp:
            new Date().toISOString()
    });

    // Automatically create title
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
   CONVERSATION TITLE
   ========================================================= */

function makeConversationTitle(
    text
) {
    const clean =
        String(text)
            .replace(/\s+/g, " ")
            .trim();

    if (!clean) {
        return "محادثة جديدة";
    }

    if (clean.length <= 28) {
        return clean;
    }

    return (
        clean.substring(0, 28) +
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
        if (conversations.length) {
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
}

/* =========================================================
   RENDER MESSAGES
   ========================================================= */

function renderMessages() {
    const container =
        firstElement(
            "messages",
            "chatMessages",
            "messagesContainer"
        );

    if (!container) {
        console.warn(
            "Messages container not found."
        );

        return;
    }

    container.innerHTML = "";

    const conversation =
        getCurrentConversation();

    if (
        !conversation ||
        conversation.messages.length ===
            0
    ) {
        return;
    }

    for (
        const message of
        conversation.messages
    ) {
        const element =
            createMessageElement(
                message
            );

        container.appendChild(
            element
        );
    }

    scrollChatToBottom();
}

/* =========================================================
   CREATE MESSAGE ELEMENT
   ========================================================= */

function createMessageElement(
    message
) {
    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "message " +
        (
            message.role ===
            "user"
                ? "user-message"
                : message.role ===
                  "error"
                ? "error-message"
                : "assistant-message"
        );

    const bubble =
        document.createElement(
            "div"
        );

    bubble.className =
        "message-bubble";

    if (
        message.role ===
        "assistant"
    ) {
        bubble.innerHTML =
            formatAIText(
                message.content
            );
    } else {
        bubble.textContent =
            message.content;
    }

    wrapper.appendChild(
        bubble
    );

    return wrapper;
}

/* =========================================================
   SIMPLE MARKDOWN FORMATTER
   ========================================================= */

function escapeHTML(text) {
    return String(text)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

function formatAIText(text) {
    let html =
        escapeHTML(
            text || ""
        );

    // Code blocks
    html =
        html.replace(
            /```([\s\S]*?)```/g,
            "<pre><code>$1</code></pre>"
        );

    // Bold
    html =
        html.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );

    // Inline code
    html =
        html.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        );

    // New lines
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
    const container =
        firstElement(
            "messages",
            "chatMessages",
            "messagesContainer"
        );

    if (!container) {
        return null;
    }

    const element =
        document.createElement(
            "div"
        );

    element.className =
        "message assistant-message typing-message";

    element.innerHTML = `
        <div class="message-bubble">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>
    `;

    container.appendChild(
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
        element.parentNode.removeChild(
            element
        );
    }
}

/* =========================================================
   CONVERSATION LIST
   ========================================================= */

function renderConversationList() {
    const container =
        firstElement(
            "conversationList",
            "historyList",
            "chatHistory"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    for (
        const conversation of
        conversations
    ) {
        const item =
            document.createElement(
                "button"
            );

        item.type = "button";

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

        item.appendChild(
            title
        );

        item.appendChild(
            date
        );

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
}

/* =========================================================
   DATE
   ========================================================= */

function formatDate(
    value
) {
    try {
        return new Intl.DateTimeFormat(
            "ar-SA",
            {
                year: "numeric",
                month: "numeric",
                day: "numeric"
            }
        ).format(
            new Date(value)
        );
    } catch {
        return "";
    }
}

/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

function setupMobileSidebar() {
    const openButton =
        firstElement(
            "menuButton",
            "sidebarToggle",
            "openSidebar"
        );

    const closeButton =
        firstElement(
            "closeSidebar",
            "closeMenu"
        );

    if (openButton) {
        openButton.addEventListener(
            "click",
            openMobileSidebar
        );
    }

    if (closeButton) {
        closeButton.addEventListener(
            "click",
            closeMobileSidebar
        );
    }
}

function openMobileSidebar() {
    const sidebar =
        firstElement(
            "sidebar",
            "sideBar"
        );

    if (sidebar) {
        sidebar.classList.add(
            "open"
        );
    }

    document.body.classList.add(
        "sidebar-open"
    );
}

function closeMobileSidebar() {
    const sidebar =
        firstElement(
            "sidebar",
            "sideBar"
        );

    if (sidebar) {
        sidebar.classList.remove(
            "open"
        );
    }

    document.body.classList.remove(
        "sidebar-open"
    );
}

/* =========================================================
   SCROLL
   ========================================================= */

function scrollChatToBottom() {
    const container =
        firstElement(
            "messages",
            "chatMessages",
            "messagesContainer"
        );

    if (!container) {
        return;
    }

    requestAnimationFrame(
        () => {
            container.scrollTop =
                container.scrollHeight;
        }
    );
}

/* =========================================================
   INPUT RESIZE
   ========================================================= */

function autoResizeInput(
    event
) {
    const input =
        event &&
        event.target
            ? event.target
            : firstElement(
                  "messageInput",
                  "message",
                  "chatInput",
                  "userInput"
              );

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
   BUTTON LOADING
   ========================================================= */

function setButtonLoading(
    button,
    loading,
    text
) {
    if (!button) {
        return;
    }

    if (
        loading
    ) {
        if (
            !button.dataset.originalText
        ) {
            button.dataset.originalText =
                button.textContent;
        }

        button.disabled =
            true;

        if (text) {
            button.textContent =
                text;
        }

    } else {
        button.disabled =
            false;

        if (
            button.dataset.originalText
        ) {
            button.textContent =
                button.dataset.originalText;

            delete button.dataset
                .originalText;
        }
    }
}

/* =========================================================
   DEBUG
   ========================================================= */

window.ChatAIPro = {
    sendMessage,
    sendOtp,
    verifyOtp,
    logout,

    getConversations() {
        return conversations;
    },

    getCurrentConversation() {
        return getCurrentConversation();
    }
};

console.log(
    "Chat AI Pro frontend loaded successfully."
);
