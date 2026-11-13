
const $ = id => document.getElementById(id);

const API_URL = "https://carl-ai.pranav-mohan.workers.dev";

const STORAGE_KEY = "carl_conversation_v2";
const SETTINGS_KEY = "carl_settings_v2";

let conversation = [];
let isSending = false;
let speak = false;
let saveHistory = true;

const settings = JSON.parse(
  localStorage.getItem(SETTINGS_KEY) || "{}"
);

speak = settings.speak === true;
saveHistory = settings.saveHistory !== false;

$("speak").checked = speak;
$("saveHistory").checked = saveHistory;

function saveConversation() {
  if (!saveHistory) return;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversation.slice(-20))
    );
  } catch (error) {
    console.warn("Could not save conversation:", error);
  }
}

function updateStatus(text, online = true) {
  $("status").textContent = text;
  $("connectionText").textContent =
    online ? "CARL is online" : "CARL unavailable";
}

function add(role, text = "") {
  $("welcome").classList.add("hidden");
  $("chat").classList.remove("hidden");

  const row = document.createElement("div");
  row.className = "message " + role;

  const avatar = document.createElement("div");
  avatar.className = "badge";
  avatar.textContent = role === "user" ? "Y" : "C";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const who = document.createElement("small");
  who.textContent =
    role === "user" ? "YOU" : "CARL · GLM-5.3-FLASH";

  const body = document.createElement("div");
  body.className = "bubble-content";
  body.textContent = text;

  bubble.append(who, body);
  row.append(avatar, bubble);

  $("chat").append(row);

  $("chat").scrollTop = $("chat").scrollHeight;

  return body;
}

function renderHistory() {
  $("chat").replaceChildren();

  if (!conversation.length) {
    $("chat").classList.add("hidden");
    $("welcome").classList.remove("hidden");
    return;
  }

  conversation.forEach(message => {
    add(message.role, message.content);
  });
}

function reset() {
  if (isSending) return;

  conversation = [];

  localStorage.removeItem(STORAGE_KEY);

  renderHistory();

  updateStatus("READY");
}

function persistSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      speak,
      saveHistory
    })
  );
}

function showError(element, message) {
  element.textContent = message;
  updateStatus("ERROR", false);
}

async function send(q) {
  q = q.trim();

  if (!q || isSending) return;

  isSending = true;

  $("sendButton").disabled = true;
  $("message").disabled = true;

  add("user", q);

  conversation.push({
    role: "user",
    content: q
  });

  conversation = conversation.slice(-20);
  saveConversation();

  $("message").value = "";
  $("message").style.height = "auto";

  const output = add("assistant", "");

  $("typingStatus").textContent = "CARL is thinking...";
  updateStatus("GENERATING");

  let reply = "";

  try {
    const response = await fetch(API_URL + "/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: conversation
      })
    });

    if (!response.ok) {
      const errorText = await response.text();

      let errorMessage = errorText;

      try {
        errorMessage =
          JSON.parse(errorText).error || errorText;
      } catch {}

      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error("Streaming response unavailable.");
    }

    const contentType =
      response.headers.get("Content-Type") || "";

    // Support ordinary JSON responses as a fallback.
    if (contentType.includes("application/json")) {
      const data = await response.json();

      reply = data.message ||
        data.choices?.[0]?.message?.content || "";

      if (!reply) {
        throw new Error("Empty AI response.");
      }

      output.textContent = reply;
    } else {
      // Read the live SSE stream.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let finished = false;

      function processEvent(event) {
        const lines = event.split(/\r?\n/);

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;

          const data = line.slice(5).trim();

          if (!data || data === "[DONE]") {
            if (data === "[DONE]") finished = true;
            continue;
          }

          let chunk;

          try {
            chunk = JSON.parse(data);
          } catch {
            continue;
          }

          if (chunk.error) {
            throw new Error(
              chunk.error.message || "AI streaming error."
            );
          }

          const content =
            chunk.choices?.[0]?.delta?.content;

          if (typeof content === "string" && content) {
            reply += content;

            output.textContent = reply;

            $("chat").scrollTop =
              $("chat").scrollHeight;
          }
        }
      }

      while (!finished) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true
        });

        const events = buffer.split(/\r?\n\r?\n/);

        buffer = events.pop() || "";

        for (const event of events) {
          processEvent(event);

          if (finished) break;
        }
      }

      buffer += decoder.decode();

      if (buffer.trim() && !finished) {
        processEvent(buffer);
      }

      if (!reply) {
        throw new Error("The AI returned an empty response.");
      }
    }

    conversation.push({
      role: "assistant",
      content: reply
    });

    conversation = conversation.slice(-20);
    saveConversation();

    updateStatus("ONLINE");
    $("typingStatus").textContent = "GLM-5.3-Flash";

    if (speak && "speechSynthesis" in window) {
      speechSynthesis.cancel();

      speechSynthesis.speak(
        new SpeechSynthesisUtterance(reply)
      );
    }

  } catch (error) {
    console.error("CARL error:", error);

    showError(
      output,
      reply
        ? reply + "\n\n[Response interrupted. Please try again.]"
        : "CARL couldn't generate a response: " + error.message
    );

    $("typingStatus").textContent = "Connection error";
  } finally {
    isSending = false;

    $("sendButton").disabled = false;
    $("message").disabled = false;
    $("message").focus();
  }
}

// Submit message
$("form").addEventListener("submit", event => {
  event.preventDefault();
  send($("message").value);
});

// Enter sends, Shift + Enter creates a new line
$("message").addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("form").requestSubmit();
  }
});

// Automatically resize the message box
$("message").addEventListener("input", () => {
  $("message").style.height = "auto";

  $("message").style.height =
    Math.min($("message").scrollHeight, 150) + "px";
});

// Suggested prompts
document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => {
    send(button.dataset.prompt);
  });
});

// New conversation
$("newChat").addEventListener("click", reset);

// Clear conversation
$("clear").addEventListener("click", () => {
  reset();
  $("settings").close();
});

// Open and close settings
$("settingsButton").addEventListener("click", () => {
  $("settings").showModal();
});

$("close").addEventListener("click", () => {
  $("settings").close();
});

// Voice output
$("speak").addEventListener("change", event => {
  speak = event.target.checked;
  persistSettings();
});

// Saved conversation preference
$("saveHistory").addEventListener("change", event => {
  saveHistory = event.target.checked;

  if (saveHistory) {
    saveConversation();
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }

  persistSettings();
});

// Voice input
$("voice").addEventListener("click", () => {
  const Recognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!Recognition) {
    alert("Voice recognition is unavailable. Try Chrome.");
    return;
  }

  const recognition = new Recognition();

  recognition.lang = "en-IN";
  recognition.interimResults = true;

  recognition.onresult = event => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join("");

    $("message").value = transcript;
    $("message").dispatchEvent(new Event("input"));
  };

  recognition.onerror = event => {
    console.error("Voice error:", event.error);
  };

  recognition.start();
});

// Mobile sidebar
$("menu").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

// Recent activity
$("historyButton").addEventListener("click", () => {
  $("chat").scrollTop = 0;
  $("sidebar").classList.remove("open");
});

// Backend health check
async function checkBackend() {
  try {
    const response = await fetch(API_URL + "/health");

    if (!response.ok) {
      throw new Error("Backend unavailable");
    }

    const data = await response.json();

    updateStatus(
      data.status === "online" ? "ONLINE" : "OFFLINE",
      data.status === "online"
    );
  } catch (error) {
    updateStatus("OFFLINE", false);
    console.error("Health check:", error);
  }
}

// Restore previous messages
try {
  if (saveHistory) {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        conversation = parsed.filter(message =>
          message &&
          ["user", "assistant"].includes(message.role) &&
          typeof message.content === "string"
        ).slice(-20);
      }
    }
  }
} catch (error) {
  console.warn("Could not restore conversation:", error);
  conversation = [];
}

renderHistory();
checkBackend();
