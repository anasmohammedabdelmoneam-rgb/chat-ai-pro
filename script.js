/* =========================================================
   CHAT AI PRO
   CHAT HISTORY SYSTEM
========================================================= */

const chat =
  document.getElementById("chat");

const messageInput =
  document.getElementById("message");

const sendBtn =
  document.getElementById("sendBtn");

const clearBtn =
  document.getElementById("topNewChat");

const newChatBtn =
  document.getElementById("newChatBtn");

const conversationList =
  document.getElementById(
    "conversationList"
  );

const sidebar =
  document.getElementById("sidebar");

const sidebarToggle =
  document.getElementById(
    "sidebarToggle"
  );

const sidebarOverlay =
  document.getElementById(
    "sidebarOverlay"
  );


/* =========================================================
   STORAGE
========================================================= */

const STORAGE_KEY =
  "chat_ai_pro_conversations_v1";


/* =========================================================
   CURRENT STATE
========================================================= */

let conversations = [];

let currentConversationId = null;

let history = [];

let isSending = false;


/* =========================================================
   LOAD CONVERSATIONS
========================================================= */

function loadConversations() {

  try {

    const saved =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!saved) {

      conversations = [];

      return;
    }

    const parsed =
      JSON.parse(saved);

    if (Array.isArray(parsed)) {

      conversations = parsed;

    } else {

      conversations = [];

    }

  } catch (error) {

    console.error(
      "Could not load conversations:",
      error
    );

    conversations = [];
  }
}


/* =========================================================
   SAVE CONVERSATIONS
========================================================= */

function saveConversations() {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        conversations
      )
    );

  } catch (error) {

    console.error(
      "Could not save conversations:",
      error
    );
  }
}


/* =========================================================
   CREATE ID
========================================================= */

function createId() {

  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substring(2, 9)
  );
}


/* =========================================================
   GET CONVERSATION TITLE
========================================================= */

function createConversationTitle(
  messages
) {

  const firstUserMessage =
    messages.find(
      message =>
        message.role === "user"
    );

  if (
    !firstUserMessage ||
    !firstUserMessage.content
  ) {

    return "محادثة جديدة";
  }

  let title =
    firstUserMessage.content
      .trim()
      .replace(/\s+/g, " ");

  if (title.length > 35) {

    title =
      title.substring(0, 35) +
      "...";
  }

  return title;
}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(timestamp) {

  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";
  }

  return date.toLocaleDateString(
    "ar-SA",
    {
      day: "numeric",
      month: "short",
    }
  );
}


/* =========================================================
   ESCAPE HTML
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


/* =========================================================
   MARKDOWN
========================================================= */

function markdownToHTML(text) {

  if (!text) {

    return "";
  }

  let html =
    escapeHTML(text);


  /* CODE BLOCKS */

  html =
    html.replace(
      /```([\s\S]*?)```/g,
      function (_, code) {

        return (
          '<pre class="code-block"><code>' +
          code.trim() +
          "</code></pre>"
        );
      }
    );


  /* INLINE CODE */

  html =
    html.replace(
      /`([^`\n]+)`/g,
      "<code>$1</code>"
    );


  /* LINKS */

  html =
    html.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );


  /* HEADINGS */

  html =
    html.replace(
      /^### (.+)$/gm,
      "<h4>$1</h4>"
    );

  html =
    html.replace(
      /^## (.+)$/gm,
      "<h3>$1</h3>"
    );

  html =
    html.replace(
      /^# (.+)$/gm,
      "<h2>$1</h2>"
    );


  /* BOLD */

  html =
    html.replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );


  /* ITALIC */

  html =
    html.replace(
      /(^|[^\*])\*([^*\n]+)\*/g,
      "$1<em>$2</em>"
    );


  /* LIST */

  html =
    html.replace(
      /^(?:[-*]) (.+)$/gm,
      "<li>$1</li>"
    );

  html =
    html.replace(
      /(<li>.*<\/li>\n?)+/g,
      function (match) {

        return (
          "<ul>" +
          match +
          "</ul>"
        );
      }
    );


  /* ORDERED LIST */

  html =
    html.replace(
      /^\d+\. (.+)$/gm,
      "<li>$1</li>"
    );


  /* HORIZONTAL LINE */

  html =
    html.replace(
      /^---$/gm,
      "<hr>"
    );


  /* NEWLINES */

  html =
    html.replace(
      /\n/g,
      "<br>"
    );


  /* CLEAN BLOCK BREAKS */

  html =
    html.replace(
      /<\/h2><br>/g,
      "</h2>"
    );

  html =
    html.replace(
      /<\/h3><br>/g,
      "</h3>"
    );

  html =
    html.replace(
      /<\/h4><br>/g,
      "</h4>"
    );

  html =
    html.replace(
      /<\/pre><br>/g,
      "</pre>"
    );

  html =
    html.replace(
      /<\/ul><br>/g,
      "</ul>"
    );

  html =
    html.replace(
      /<hr><br>/g,
      "<hr>"
    );


  return html;
}


/* =========================================================
   SHOW WELCOME
========================================================= */

function showWelcome() {

  chat.innerHTML = `

    <section class="welcome">

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

    </section>

  `;
}


/* =========================================================
   REMOVE WELCOME
========================================================= */

function removeWelcome() {

  const welcome =
    document.querySelector(
      ".welcome"
    );

  if (welcome) {

    welcome.remove();
  }
}


/* =========================================================
   SCROLL
========================================================= */

function scrollToBottom() {

  requestAnimationFrame(() => {

    chat.scrollTop =
      chat.scrollHeight;

  });
}


/* =========================================================
   ADD USER MESSAGE
========================================================= */

function addUserMessage(
  text
) {

  removeWelcome();

  const message =
    document.createElement(
      "div"
    );

  message.className =
    "message user-message";

  const bubble =
    document.createElement(
      "div"
    );

  bubble.className =
    "bubble";

  bubble.textContent =
    text;

  message.appendChild(
    bubble
  );

  chat.appendChild(
    message
  );

  scrollToBottom();
}


/* =========================================================
   ADD AI MESSAGE
========================================================= */

function addAIMessage(
  text
) {

  removeWelcome();

  const message =
    document.createElement(
      "div"
    );

  message.className =
    "message ai-message";

  const bubble =
    document.createElement(
      "div"
    );

  bubble.className =
    "bubble ai-bubble";

  bubble.innerHTML =
    markdownToHTML(text);

  message.appendChild(
    bubble
  );

  chat.appendChild(
    message
  );

  scrollToBottom();

  return message;
}


/* =========================================================
   LOADING
========================================================= */

function addLoadingMessage() {

  removeWelcome();

  const message =
    document.createElement(
      "div"
    );

  message.className =
    "message ai-message loading-message";

  message.innerHTML = `

    <div class="bubble ai-bubble loading-bubble">

      <span class="typing-dot"></span>

      <span class="typing-dot"></span>

      <span class="typing-dot"></span>

    </div>

  `;

  chat.appendChild(
    message
  );

  scrollToBottom();

  return message;
}


/* =========================================================
   REMOVE LOADING
========================================================= */

function removeLoadingMessage(
  message
) {

  if (
    message &&
    message.parentNode
  ) {

    message.remove();
  }
}


/* =========================================================
   CREATE NEW CONVERSATION
========================================================= */

function createNewConversation() {

  currentConversationId =
    createId();

  history = [];

  showWelcome();

  renderConversationList();

  closeMobileSidebar();

  messageInput.value = "";

  autoResizeTextarea();

  messageInput.focus();
}


/* =========================================================
   SAVE CURRENT CONVERSATION
========================================================= */

function saveCurrentConversation() {

  if (
    !currentConversationId
  ) {

    return;
  }

  if (
    !history ||
    history.length === 0
  ) {

    return;
  }


  const existingIndex =
    conversations.findIndex(
      conversation =>
        conversation.id ===
        currentConversationId
    );


  const title =
    createConversationTitle(
      history
    );


  if (
    existingIndex === -1
  ) {

    conversations.unshift({

      id:
        currentConversationId,

      title:
        title,

      messages:
        [...history],

      createdAt:
        Date.now(),

      updatedAt:
        Date.now(),

    });

  } else {

    conversations[
      existingIndex
    ].messages =
      [...history];

    conversations[
      existingIndex
    ].title =
      title;

    conversations[
      existingIndex
    ].updatedAt =
      Date.now();
  }


  /*
     الأحدث أولًا
  */

  conversations.sort(
    (a, b) =>
      b.updatedAt -
      a.updatedAt
  );


  saveConversations();

  renderConversationList();
}


/* =========================================================
   OPEN CONVERSATION
========================================================= */

function openConversation(
  id
) {

  const conversation =
    conversations.find(
      item =>
        item.id === id
    );

  if (!conversation) {

    return;
  }


  currentConversationId =
    conversation.id;

  history =
    Array.isArray(
      conversation.messages
    )
      ? [...conversation.messages]
      : [];


  renderConversation();

  renderConversationList();

  closeMobileSidebar();

  messageInput.focus();
}


/* =========================================================
   RENDER CONVERSATION
========================================================= */

function renderConversation() {

  chat.innerHTML = "";


  if (
    !history ||
    history.length === 0
  ) {

    showWelcome();

    return;
  }


  for (
    const message of history
  ) {

    if (
      message.role === "user"
    ) {

      addUserMessage(
        message.content
      );

    } else if (
      message.role ===
      "assistant"
    ) {

      addAIMessage(
        message.content
      );
    }
  }


  scrollToBottom();
}


/* =========================================================
   DELETE CONVERSATION
========================================================= */

function deleteConversation(
  id
) {

  const conversation =
    conversations.find(
      item =>
        item.id === id
    );

  if (!conversation) {

    return;
  }


  const confirmed =
    window.confirm(
      `هل تريد حذف المحادثة "${conversation.title}"؟`
    );


  if (!confirmed) {

    return;
  }


  conversations =
    conversations.filter(
      item =>
        item.id !== id
    );


  saveConversations();


  if (
    currentConversationId ===
    id
  ) {

    createNewConversation();

  } else {

    renderConversationList();
  }
}


/* =========================================================
   RENAME CONVERSATION
========================================================= */

function renameConversation(
  id
) {

  const conversation =
    conversations.find(
      item =>
        item.id === id
    );

  if (!conversation) {

    return;
  }


  const newTitle =
    window.prompt(
      "اكتب اسم المحادثة الجديد:",
      conversation.title
    );


  if (
    newTitle === null
  ) {

    return;
  }


  const title =
    newTitle.trim();


  if (!title) {

    return;
  }


  conversation.title =
    title;


  conversation.updatedAt =
    Date.now();


  saveConversations();

  renderConversationList();
}


/* =========================================================
   RENDER HISTORY
========================================================= */

function renderConversationList() {

  if (
    !conversationList
  ) {

    return;
  }


  if (
    conversations.length === 0
  ) {

    conversationList.innerHTML = `

      <div class="empty-history">

        لا توجد محادثات سابقة بعد.

        <br>

        ابدأ محادثة جديدة
        وستظهر هنا.

      </div>

    `;

    return;
  }


  conversationList.innerHTML = "";


  for (
    const conversation of
      conversations
  ) {

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


    const name =
      document.createElement(
        "div"
      );

    name.className =
      "conversation-name";

    name.textContent =
      conversation.title;


    const date =
      document.createElement(
        "div"
      );

    date.className =
      "conversation-date";

    date.textContent =
      formatDate(
        conversation.updatedAt
      );


    main.appendChild(
      name
    );

    main.appendChild(
      date
    );


    /*
       الضغط على اسم المحادثة
    */

    main.addEventListener(
      "click",
      () => {

        openConversation(
          conversation.id
        );

      }
    );


    /* ACTIONS */

    const actions =
      document.createElement(
        "div"
      );

    actions.className =
      "conversation-actions";


    /* RENAME */

    const rename =
      document.createElement(
        "button"
      );

    rename.type =
      "button";

    rename.className =
      "conversation-action";

    rename.title =
      "إعادة تسمية";

    rename.textContent =
      "✎";


    rename.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        renameConversation(
          conversation.id
        );
      }
    );


    /* DELETE */

    const deleteBtn =
      document.createElement(
        "button"
      );

    deleteBtn.type =
      "button";

    deleteBtn.className =
      "conversation-action delete";

    deleteBtn.title =
      "حذف";

    deleteBtn.textContent =
      "🗑";


    deleteBtn.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        deleteConversation(
          conversation.id
        );
      }
    );


    actions.appendChild(
      rename
    );

    actions.appendChild(
      deleteBtn
    );


    item.appendChild(
      main
    );

    item.appendChild(
      actions
    );


    conversationList.appendChild(
      item
    );
  }
}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

  const text =
    messageInput.value.trim();


  if (!text) {

    return;
  }


  if (isSending) {

    return;
  }


  /*
     إذا لم توجد محادثة
     ننشئ واحدة
  */

  if (
    !currentConversationId
  ) {

    currentConversationId =
      createId();
  }


  isSending = true;


  /* USER */

  addUserMessage(text);


  history.push({

    role: "user",

    content: text,

  });


  /*
     حفظ الرسالة فورًا
  */

  saveCurrentConversation();


  /* CLEAR INPUT */

  messageInput.value = "";

  autoResizeTextarea();


  /* BUTTON */

  sendBtn.disabled =
    true;


  /* LOADING */

  const loadingMessage =
    addLoadingMessage();


  try {

    const response =
      await fetch(
        "/api/chat",
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              messages:
                history,
            }),

        }
      );


    const data =
      await response
        .json()
        .catch(
          () => ({})
        );


    if (
      !response.ok
    ) {

      throw new Error(
        data?.error ||
        `HTTP ${response.status}`
      );
    }


    /*
       server.js الحالي
       يرجع answer
    */

    const answer =
      typeof data?.answer ===
      "string"

        ? data.answer

        : typeof data?.reply ===
          "string"

        ? data.reply

        : "";


    removeLoadingMessage(
      loadingMessage
    );


    if (
      !answer.trim()
    ) {

      throw new Error(
        "السيرفر أعاد إجابة فارغة."
      );
    }


    /* AI */

    addAIMessage(
      answer
    );


    /* SAVE */

    history.push({

      role:
        "assistant",

      content:
        answer,

    });


    saveCurrentConversation();


  } catch (error) {

    console.error(
      "Chat error:",
      error
    );


    removeLoadingMessage(
      loadingMessage
    );


    const errorText =
      "حدث خطأ: تعذر الحصول على إجابة حاليًا. حاول مرة أخرى بعد قليل.";


    addAIMessage(
      errorText
    );

  } finally {

    isSending = false;

    sendBtn.disabled =
      false;

    messageInput.focus();

    scrollToBottom();
  }
}


/* =========================================================
   CLEAR / NEW CHAT
========================================================= */

function startNewChat() {

  if (
    history.length > 0
  ) {

    saveCurrentConversation();
  }


  currentConversationId =
    createId();

  history = [];


  showWelcome();

  renderConversationList();

  closeMobileSidebar();


  messageInput.value = "";

  autoResizeTextarea();

  messageInput.focus();
}


/* =========================================================
   TEXTAREA RESIZE
========================================================= */

function autoResizeTextarea() {

  messageInput.style.height =
    "auto";


  const maxHeight = 150;


  messageInput.style.height =
    Math.min(
      messageInput.scrollHeight,
      maxHeight
    ) + "px";
}


/* =========================================================
   SIDEBAR
========================================================= */

function openMobileSidebar() {

  sidebar.classList.add(
    "open"
  );

  sidebarOverlay.classList.add(
    "active"
  );
}


function closeMobileSidebar() {

  sidebar.classList.remove(
    "open"
  );

  sidebarOverlay.classList.remove(
    "active"
  );
}


/* =========================================================
   EVENTS
========================================================= */


/* SEND */

sendBtn.addEventListener(
  "click",
  sendMessage
);


/* NEW CHAT SIDEBAR */

newChatBtn.addEventListener(
  "click",
  startNewChat
);


/* NEW CHAT TOP */

clearBtn.addEventListener(
  "click",
  startNewChat
);


/* ENTER */

messageInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
        "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendMessage();
    }
  }
);


/* INPUT */

messageInput.addEventListener(
  "input",
  autoResizeTextarea
);


/* MENU */

sidebarToggle.addEventListener(
  "click",
  () => {

    if (
      sidebar.classList.contains(
        "open"
      )
    ) {

      closeMobileSidebar();

    } else {

      openMobileSidebar();
    }
  }
);


/* OVERLAY */

sidebarOverlay.addEventListener(
  "click",
  closeMobileSidebar
);


/* =========================================================
   INITIALIZE
========================================================= */

loadConversations();

renderConversationList();

currentConversationId =
  createId();

history = [];

showWelcome();

autoResizeTextarea();

messageInput.focus();


console.log(
  "Chat AI Pro loaded successfully."
);

console.log(
  "Conversation history loaded:",
  conversations.length
);
