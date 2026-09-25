/* =========================================================
   CHAT AI PRO
   Authentication + OTP + Chat + History
========================================================= */


/* =========================================================
   AUTH ELEMENTS
========================================================= */

const authScreen = document.getElementById("authScreen");
const app = document.getElementById("app");

const phoneStep = document.getElementById("phoneStep");
const otpStep = document.getElementById("otpStep");

const phoneInput = document.getElementById("phoneInput");
const otpInput = document.getElementById("otpInput");

const sendOtpBtn = document.getElementById("sendOtpBtn");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const resendOtpBtn = document.getElementById("resendOtpBtn");
const backToPhoneBtn = document.getElementById("backToPhoneBtn");

const phoneError = document.getElementById("phoneError");
const otpError = document.getElementById("otpError");

const sentPhone = document.getElementById("sentPhone");

const authLoading = document.getElementById("authLoading");

const logoutBtn = document.getElementById("logoutBtn");
const userPhone = document.getElementById("userPhone");


/* =========================================================
   CHAT ELEMENTS
========================================================= */

const chat = document.getElementById("chat");
const welcome = document.getElementById("welcome");

const messageInput = document.getElementById("message");
const sendBtn = document.getElementById("sendBtn");

const clearBtn = document.getElementById("clearBtn");
const newChatBtn = document.getElementById("newChatBtn");

const conversationList =
    document.getElementById("conversationList");

const menuBtn =
    document.getElementById("menuBtn");

const sidebar =
    document.querySelector(".sidebar");

const sidebarOverlay =
    document.getElementById("sidebarOverlay");


/* =========================================================
   STORAGE
========================================================= */

const CONVERSATIONS_KEY =
    "chat_ai_pro_conversations";

const AUTH_KEY =
    "chat_ai_pro_auth";


/* =========================================================
   STATE
========================================================= */

let conversations = [];

let currentConversationId = null;

let isSending = false;

let pendingPhone = "";


/* =========================================================
   BASIC HELPERS
========================================================= */

function createId() {

    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 9)
    );

}


function getDate() {

    return new Date().toLocaleString(
        "ar-SA",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );

}


/* =========================================================
   PHONE
========================================================= */

function normalizeSaudiPhone(value) {

    let phone = String(value || "")
        .replace(/\s+/g, "")
        .replace(/-/g, "");

    if (phone.startsWith("+966")) {

        phone = phone.substring(4);

    } else if (phone.startsWith("00966")) {

        phone = phone.substring(5);

    } else if (phone.startsWith("966")) {

        phone = phone.substring(3);

    } else if (phone.startsWith("05")) {

        phone = phone.substring(1);

    }

    return phone;

}


function isValidSaudiPhone(phone) {

    return /^5\d{8}$/.test(phone);

}


function fullSaudiPhone(phone) {

    return "+966" + phone;

}


/* =========================================================
   AUTH UI
========================================================= */

function showLoading(show, text = "جارٍ التحقق...") {

    if (!authLoading) return;

    const span =
        authLoading.querySelector("span");

    if (span) {
        span.textContent = text;
    }

    authLoading.classList.toggle(
        "hidden",
        !show
    );

}


function setAuthButtonsDisabled(disabled) {

    if (sendOtpBtn) {
        sendOtpBtn.disabled = disabled;
    }

    if (verifyOtpBtn) {
        verifyOtpBtn.disabled = disabled;
    }

    if (resendOtpBtn) {
        resendOtpBtn.disabled = disabled;
    }

}


function showPhoneStep() {

    phoneStep.classList.remove("hidden");

    otpStep.classList.add("hidden");

    phoneError.textContent = "";

    otpError.textContent = "";

    showLoading(false);

}


function showOtpStep(phone) {

    phoneStep.classList.add("hidden");

    otpStep.classList.remove("hidden");

    phoneError.textContent = "";

    otpError.textContent = "";

    sentPhone.textContent =
        fullSaudiPhone(phone);

    otpInput.value = "";

    otpInput.focus();

    showLoading(false);

}


/* =========================================================
   AUTH STORAGE
========================================================= */

function saveAuth(phone) {

    localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
            authenticated: true,
            phone: phone,
            loginAt: Date.now()
        })
    );

}


function getAuth() {

    try {

        const data =
            localStorage.getItem(AUTH_KEY);

        if (!data) {
            return null;
        }

        return JSON.parse(data);

    } catch {

        return null;

    }

}


function clearAuth() {

    localStorage.removeItem(AUTH_KEY);

}


/* =========================================================
   SHOW APP
========================================================= */

function enterApp(phone) {

    saveAuth(phone);

    authScreen.classList.add("hidden");

    app.classList.remove("hidden");

    userPhone.textContent =
        fullSaudiPhone(phone);

    loadConversations();

    if (!currentConversationId) {
        createNewConversation();
    }

}


function logout() {

    clearAuth();

    conversations = [];

    currentConversationId = null;

    authScreen.classList.remove("hidden");

    app.classList.add("hidden");

    phoneInput.value = "";

    otpInput.value = "";

    pendingPhone = "";

    showPhoneStep();

}


/* =========================================================
   SEND OTP
========================================================= */

async function sendOtp() {

    phoneError.textContent = "";

    const phone =
        normalizeSaudiPhone(
            phoneInput.value
        );

    if (!isValidSaudiPhone(phone)) {

        phoneError.textContent =
            "أدخل رقم جوال سعودي صحيح مثل 5XXXXXXXX.";

        return;

    }

    pendingPhone = phone;

    setAuthButtonsDisabled(true);

    showLoading(
        true,
        "جارٍ إرسال رمز التحقق..."
    );

    try {

        const response =
            await fetch(
                "/api/auth/send-otp",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        method: "sms",
                        phone: fullSaudiPhone(phone)
                    })
                }
            );

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {

            throw new Error(
                data.error ||
                data.message ||
                "تعذر إرسال رمز التحقق."
            );

        }

        /*
         * Authentica may return different success
         * structures depending on the API response.
         * The HTTP success response is enough here.
         */

        showOtpStep(phone);

    } catch (error) {

        console.error(
            "Send OTP error:",
            error
        );

        phoneError.textContent =
            error.message ||
            "حدث خطأ أثناء إرسال الرمز.";

        showLoading(false);

    } finally {

        setAuthButtonsDisabled(false);

    }

}


/* =========================================================
   VERIFY OTP
========================================================= */

async function verifyOtp() {

    otpError.textContent = "";

    const otp =
        String(
            otpInput.value || ""
        ).replace(/\D/g, "");

    if (!pendingPhone) {

        otpError.textContent =
            "أعد إدخال رقم الجوال.";

        showPhoneStep();

        return;

    }

    if (!/^\d{4,8}$/.test(otp)) {

        otpError.textContent =
            "أدخل رمز التحقق الصحيح.";

        return;

    }

    setAuthButtonsDisabled(true);

    showLoading(
        true,
        "جارٍ التحقق من الرمز..."
    );

    try {

        const response =
            await fetch(
                "/api/auth/verify-otp",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        phone:
                            fullSaudiPhone(
                                pendingPhone
                            ),

                        otp: otp
                    })
                }
            );

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {

            throw new Error(
                data.error ||
                data.message ||
                "رمز التحقق غير صحيح."
            );

        }

        /*
         * Some API responses use different fields
         * for successful verification.
         *
         * If the backend returned HTTP 200,
         * we treat the verification as successful.
         */

        enterApp(pendingPhone);

        showLoading(false);

    } catch (error) {

        console.error(
            "Verify OTP error:",
            error
        );

        otpError.textContent =
            error.message ||
            "تعذر التحقق من الرمز.";

        showLoading(false);

    } finally {

        setAuthButtonsDisabled(false);

    }

}


/* =========================================================
   RESEND OTP
========================================================= */

async function resendOtp() {

    if (!pendingPhone) {

        showPhoneStep();

        return;

    }

    phoneInput.value =
        pendingPhone;

    await sendOtp();

}


/* =========================================================
   CONVERSATIONS
========================================================= */

function saveConversations() {

    try {

        localStorage.setItem(
            CONVERSATIONS_KEY,
            JSON.stringify(conversations)
        );

    } catch (error) {

        console.error(
            "Save conversations error:",
            error
        );

    }

}


function loadConversations() {

    try {

        const data =
            localStorage.getItem(
                CONVERSATIONS_KEY
            );

        conversations =
            data
                ? JSON.parse(data)
                : [];

        if (!Array.isArray(conversations)) {
            conversations = [];
        }

    } catch {

        conversations = [];

    }

    renderConversationList();

}


function createNewConversation() {

    const conversation = {

        id: createId(),

        title: "محادثة جديدة",

        createdAt: Date.now(),

        updatedAt: Date.now(),

        messages: []

    };

    conversations.unshift(
        conversation
    );

    currentConversationId =
        conversation.id;

    saveConversations();

    renderConversationList();

    renderCurrentConversation();

    closeSidebar();

}


function getCurrentConversation() {

    return conversations.find(
        conversation =>
            conversation.id ===
            currentConversationId
    );

}


/* =========================================================
   CONVERSATION TITLE
========================================================= */

function generateTitle(text) {

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

    return clean.substring(0, 30) + "...";

}


/* =========================================================
   RENDER HISTORY
========================================================= */

function renderConversationList() {

    if (!conversationList) return;

    conversationList.innerHTML = "";

    if (conversations.length === 0) {

        conversationList.innerHTML =
            `
            <div class="empty-history">
                لا توجد محادثات حتى الآن.
                <br>
                ابدأ محادثة جديدة.
            </div>
            `;

        return;

    }

    conversations.forEach(
        conversation => {

            const item =
                document.createElement("div");

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
                document.createElement("div");

            main.className =
                "conversation-main";

            const title =
                document.createElement("div");

            title.className =
                "conversation-title";

            title.textContent =
                conversation.title ||
                "محادثة جديدة";

            const date =
                document.createElement("div");

            date.className =
                "conversation-date";

            date.textContent =
                conversation.updatedAt
                    ? new Date(
                        conversation.updatedAt
                    ).toLocaleDateString(
                        "ar-SA"
                    )
                    : "";

            main.appendChild(title);
            main.appendChild(date);


            const actions =
                document.createElement("div");

            actions.className =
                "conversation-actions";


            const rename =
                document.createElement("button");

            rename.type = "button";

            rename.title =
                "إعادة تسمية";

            rename.textContent = "✎";

            rename.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    renameConversation(
                        conversation.id
                    );

                }
            );


            const deleteBtn =
                document.createElement("button");

            deleteBtn.type = "button";

            deleteBtn.title =
                "حذف";

            deleteBtn.textContent = "×";

            deleteBtn.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    deleteConversation(
                        conversation.id
                    );

                }
            );


            actions.appendChild(rename);
            actions.appendChild(deleteBtn);


            item.appendChild(main);
            item.appendChild(actions);


            item.addEventListener(
                "click",
                () => {

                    currentConversationId =
                        conversation.id;

                    saveConversations();

                    renderConversationList();

                    renderCurrentConversation();

                    closeSidebar();

                }
            );


            conversationList.appendChild(item);

        }
    );

}


/* =========================================================
   RENAME
========================================================= */

function renameConversation(id) {

    const conversation =
        conversations.find(
            item =>
                item.id === id
        );

    if (!conversation) return;

    const newTitle =
        window.prompt(
            "اكتب اسم المحادثة:",
            conversation.title
        );

    if (
        newTitle === null ||
        !newTitle.trim()
    ) {
        return;
    }

    conversation.title =
        newTitle.trim();

    conversation.updatedAt =
        Date.now();

    saveConversations();

    renderConversationList();

}


/* =========================================================
   DELETE
========================================================= */

function deleteConversation(id) {

    const conversation =
        conversations.find(
            item =>
                item.id === id
        );

    if (!conversation) return;

    const confirmed =
        window.confirm(
            "هل تريد حذف هذه المحادثة؟"
        );

    if (!confirmed) return;

    conversations =
        conversations.filter(
            item =>
                item.id !== id
        );

    if (
        currentConversationId === id
    ) {

        currentConversationId =
            null;

        if (conversations.length > 0) {

            currentConversationId =
                conversations[0].id;

        } else {

            createNewConversation();

            return;

        }

    }

    saveConversations();

    renderConversationList();

    renderCurrentConversation();

}


/* =========================================================
   MARKDOWN
========================================================= */

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function markdownToHTML(text) {

    text = String(text ?? "");

    /*
     * Fix literal <br> returned by some AI providers.
     */

    text = text
        .replace(
            /<br\s*\/?>/gi,
            "\n"
        )
        .replace(
            /<\/br>/gi,
            "\n"
        );


    const codeBlocks = [];

    text = text.replace(
        /```([\s\S]*?)```/g,
        function(_, code) {

            const index =
                codeBlocks.length;

            codeBlocks.push(
                escapeHTML(
                    code
                        .replace(
                            /^\w+\n/,
                            ""
                        )
                        .trim()
                )
            );

            return `@@CODEBLOCK${index}@@`;

        }
    );


    text =
        escapeHTML(text);


    text =
        text.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        );


    text =
        text.replace(
            /^### (.*)$/gm,
            "<h3>$1</h3>"
        );


    text =
        text.replace(
            /^## (.*)$/gm,
            "<h2>$1</h2>"
        );


    text =
        text.replace(
            /^# (.*)$/gm,
            "<h1>$1</h1>"
        );


    text =
        text.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    text =
        text.replace(
            /__(.*?)__/g,
            "<strong>$1</strong>"
        );


    text =
        text.replace(
            /\*([^*\n]+)\*/g,
            "<em>$1</em>"
        );


    text =
        text.replace(
            /_([^_\n]+)_/g,
            "<em>$1</em>"
        );


    text =
        text.replace(
            /^[-*] (.*)$/gm,
            "<li>$1</li>"
        );


    text =
        text.replace(
            /(<li>.*<\/li>)/gs,
            "<ul>$1</ul>"
        );


    text =
        text.replace(
            /^\d+\. (.*)$/gm,
            "<li>$1</li>"
        );


    text =
        text.replace(
            /(<li>.*<\/li>)/gs,
            function(match) {

                if (
                    match.includes("<ul>")
                ) {
                    return match;
                }

                return `<ol>${match}</ol>`;

            }
        );


    text =
        text.replace(
            /^---$/gm,
            "<hr>"
        );


    text =
        text.replace(
            /\n/g,
            "<br>"
        );


    codeBlocks.forEach(
        (code, index) => {

            text =
                text.replace(
                    `@@CODEBLOCK${index}@@`,
                    `<pre><code>${code}</code></pre>`
                );

        }
    );


    text =
        text.replace(
            /<\/h([1-3])><br>/g,
            "</h$1>"
        );


    text =
        text.replace(
            /<\/pre><br>/g,
            "</pre>"
        );


    text =
        text.replace(
            /<\/ul><br>/g,
            "</ul>"
        );


    text =
        text.replace(
            /<\/ol><br>/g,
            "</ol>"
        );


    return text;

}


/* =========================================================
   ADD MESSAGE
========================================================= */

function addMessage(
    role,
    text,
    save = true
) {

    if (welcome) {

        welcome.style.display =
            "none";

    }


    const row =
        document.createElement("div");

    row.className =
        `message-row ${role}`;


    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";


    if (role === "assistant") {

        bubble.innerHTML =
            markdownToHTML(text);

    } else {

        bubble.textContent =
            text;

    }


    row.appendChild(bubble);

    chat.appendChild(row);


    if (save) {

        const conversation =
            getCurrentConversation();

        if (conversation) {

            conversation.messages.push({

                role: role,

                content: text,

                createdAt: Date.now()

            });

            conversation.updatedAt =
                Date.now();

            saveConversations();

        }

    }


    scrollToBottom();

}


/* =========================================================
   RENDER CURRENT
========================================================= */

function renderCurrentConversation() {

    const conversation =
        getCurrentConversation();

    chat.innerHTML = "";


    if (!conversation) {

        if (welcome) {

            chat.appendChild(
                welcome
            );

            welcome.style.display =
                "";

        }

        return;

    }


    if (
        conversation.messages.length === 0
    ) {

        const welcomeClone =
            document.createElement("section");

        welcomeClone.className =
            "welcome";

        welcomeClone.innerHTML =
            `
            <div class="welcome-icon">
                <img
                    src="icon.png"
                    alt="Chat AI Pro"
                >
            </div>

            <h2>
                مرحبًا بك في Chat AI Pro
            </h2>

            <p>
                اكتب سؤالك وسأحاول مساعدتك.
            </p>
            `;

        chat.appendChild(
            welcomeClone
        );

        return;

    }


    conversation.messages.forEach(
        message => {

            addMessage(
                message.role,
                message.content,
                false
            );

        }
    );

}


/* =========================================================
   LOADING MESSAGE
========================================================= */

function addLoadingMessage() {

    const row =
        document.createElement("div");

    row.className =
        "message-row assistant";

    row.id =
        "aiLoadingMessage";


    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";


    bubble.innerHTML =
        `
        <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
        `;


    row.appendChild(bubble);

    chat.appendChild(row);

    scrollToBottom();

}


function removeLoadingMessage() {

    const loading =
        document.getElementById(
            "aiLoadingMessage"
        );

    if (loading) {
        loading.remove();
    }

}


/* =========================================================
   SCROLL
========================================================= */

function scrollToBottom() {

    requestAnimationFrame(
        () => {

            chat.scrollTo({
                top: chat.scrollHeight,
                behavior: "smooth"
            });

        }
    );

}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

    if (isSending) return;

    const text =
        messageInput.value.trim();

    if (!text) return;


    let conversation =
        getCurrentConversation();


    if (!conversation) {

        createNewConversation();

        conversation =
            getCurrentConversation();

    }


    /*
     * First user message becomes the title.
     */

    if (
        conversation.messages.length === 0
    ) {

        conversation.title =
            generateTitle(text);

    }


    addMessage(
        "user",
        text,
        true
    );


    messageInput.value = "";

    autoResizeTextarea();


    isSending = true;

    sendBtn.disabled = true;


    addLoadingMessage();


    try {

        const response =
            await fetch(
                "/api/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        messages:
                            conversation.messages.map(
                                message => ({
                                    role:
                                        message.role,
                                    content:
                                        message.content
                                })
                            )

                    })

                }
            );


        let data = {};

        try {

            data =
                await response.json();

        } catch {

            data = {};

        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                data.message ||
                "تعذر الحصول على إجابة."
            );

        }


        const answer =
            data.reply ||
            data.response ||
            data.answer ||
            data.message;


        if (!answer) {

            throw new Error(
                "لم يتم استلام إجابة من الخادم."
            );

        }


        removeLoadingMessage();


        addMessage(
            "assistant",
            answer,
            true
        );


        conversation =
            getCurrentConversation();

        if (conversation) {

            conversation.updatedAt =
                Date.now();

            saveConversations();

            renderConversationList();

        }


    } catch (error) {

        console.error(
            "Chat error:",
            error
        );

        removeLoadingMessage();


        addMessage(
            "assistant",
            "حدث خطأ: " +
            (
                error.message ||
                "تعذر الحصول على إجابة حاليًا."
            ),
            false
        );

    } finally {

        isSending = false;

        sendBtn.disabled = false;

        messageInput.focus();

    }

}


/* =========================================================
   NEW CHAT
========================================================= */

function newChat() {

    createNewConversation();

    messageInput.focus();

}


/* =========================================================
   CLEAR CURRENT CHAT
========================================================= */

function clearCurrentChat() {

    const conversation =
        getCurrentConversation();

    if (!conversation) return;


    if (
        conversation.messages.length === 0
    ) {
        return;
    }


    const confirmed =
        window.confirm(
            "هل تريد بدء محادثة جديدة؟"
        );

    if (!confirmed) return;


    createNewConversation();

}


/* =========================================================
   TEXTAREA
========================================================= */

function autoResizeTextarea() {

    messageInput.style.height =
        "auto";

    messageInput.style.height =
        Math.min(
            messageInput.scrollHeight,
            150
        ) + "px";

}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function openSidebar() {

    if (!sidebar) return;

    sidebar.classList.add(
        "open"
    );

    sidebarOverlay.classList.add(
        "show"
    );

}


function closeSidebar() {

    if (!sidebar) return;

    sidebar.classList.remove(
        "open"
    );

    sidebarOverlay.classList.remove(
        "show"
    );

}


/* =========================================================
   EVENTS
========================================================= */


/* Send OTP */

if (sendOtpBtn) {

    sendOtpBtn.addEventListener(
        "click",
        sendOtp
    );

}


/* Verify OTP */

if (verifyOtpBtn) {

    verifyOtpBtn.addEventListener(
        "click",
        verifyOtp
    );

}


/* Resend */

if (resendOtpBtn) {

    resendOtpBtn.addEventListener(
        "click",
        resendOtp
    );

}


/* Back */

if (backToPhoneBtn) {

    backToPhoneBtn.addEventListener(
        "click",
        () => {

            showPhoneStep();

        }
    );

}


/* Enter on phone */

if (phoneInput) {

    phoneInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                sendOtp();

            }

        }
    );

}


/* Enter on OTP */

if (otpInput) {

    otpInput.addEventListener(
        "input",
        () => {

            otpInput.value =
                otpInput.value
                    .replace(/\D/g, "")
                    .slice(0, 8);

        }
    );


    otpInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                verifyOtp();

            }

        }
    );

}


/* Send message */

if (sendBtn) {

    sendBtn.addEventListener(
        "click",
        sendMessage
    );

}


/* Enter in message */

if (messageInput) {

    messageInput.addEventListener(
        "input",
        autoResizeTextarea
    );


    messageInput.addEventListener(
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

}


/* New chat */

if (newChatBtn) {

    newChatBtn.addEventListener(
        "click",
        newChat
    );

}


/* Top new chat */

if (clearBtn) {

    clearBtn.addEventListener(
        "click",
        clearCurrentChat
    );

}


/* Logout */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        logout
    );

}


/* Mobile menu */

if (menuBtn) {

    menuBtn.addEventListener(
        "click",
        openSidebar
    );

}


if (sidebarOverlay) {

    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );

}


/* =========================================================
   INITIALIZATION
========================================================= */

function initialize() {

    const auth =
        getAuth();


    if (
        auth &&
        auth.authenticated &&
        auth.phone
    ) {

        authScreen.classList.add(
            "hidden"
        );

        app.classList.remove(
            "hidden"
        );

        userPhone.textContent =
            fullSaudiPhone(
                normalizeSaudiPhone(
                    auth.phone
                )
            );

        loadConversations();

        if (
            conversations.length === 0
        ) {

            createNewConversation();

        } else {

            currentConversationId =
                conversations[0].id;

            renderConversationList();

            renderCurrentConversation();

        }

    } else {

        authScreen.classList.remove(
            "hidden"
        );

        app.classList.add(
            "hidden"
        );

        showPhoneStep();

    }

}


initialize();
