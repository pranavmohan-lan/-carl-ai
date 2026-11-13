
const $ = id => document.getElementById(id);

const API_URL = "https://carl-ai.pranav-mohan.workers.dev";

let speak = false;
let conversation = [];

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
  who.textContent = role === "user" ? "YOU" : "CARL · GLM-5.3-FLASH";

  const body = document.createElement("div");
  body.textContent = text;

  bubble.append(who, body);
  row.append(avatar, bubble);

  $("chat").append(row);
  $("chat").scrollTop = $("chat").scrollHeight;

  return body;
}

async function send(q) {
  q = q.trim();
  if (!q) return;

  add("user", q);
  $("message").value = "";

  conversation.push({
    role: "user",
    content: q
  });

  // Keep the latest 20 messages.
  conversation = conversation.slice(-20);

  const output = add("assistant", "");
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
      let details = {};
      try {
        details = await response.json();
      } catch {}

      throw new Error(
        details.error || "Server error: " + response.status
      );
    }

    if (!response.body) {
      throw new Error("The AI did not return a response stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let finished = false;

    function processLine(line) {
      line = line.trim();

      if (!line.startsWith("data:")) return;

      const data = line.slice(5).trim();

      if (!data || data === "[DONE]") return;

      let parsed;

      try {
        parsed = JSON.parse(data);
      } catch {
        return;
      }

      if (parsed.error) {
        throw new Error(parsed.error.message || parsed.error);
      }

      const content =
        parsed.choices?.[0]?.delta?.content;

      if (typeof content === "string") {
        reply += content;
        output.textContent = reply;
        $("chat").scrollTop = $("chat").scrollHeight;
      }
    }

    while (!finished) {
      const { value, done } = await reader.read();

      if (done) {
        finished = true;
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        processLine(line);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      processLine(buffer);
    }

    if (!reply) {
      throw new Error("The AI returned an empty response.");
    }

    conversation.push({
      role: "assistant",
      content: reply
    });

    conversation = conversation.slice(-20);

    if (speak && "speechSynthesis" in window) {
      speechSynthesis.speak(
        new SpeechSynthesisUtterance(reply)
      );
    }

  } catch (error) {
    console.error("CARL:", error);

    output.textContent = "CARL error: " + error.message;

    // Remove the failed user message from conversation history.
    conversation.pop();
  }
}

$("form").addEventListener("submit", e => {
  e.preventDefault();
  send($("message").value);
});

$("message").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("form").requestSubmit();
  }
});

document.querySelectorAll("[data-prompt]").forEach(button => {
  button.onclick = () => send(button.dataset.prompt);
});

function reset() {
  conversation = [];

  $("chat").replaceChildren();
  $("chat").classList.add("hidden");
  $("welcome").classList.remove("hidden");

  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

$("newChat").onclick = reset;
$("clear").onclick = reset;

$("settingsButton").onclick = () => $("settings").showModal();
$("close").onclick = () => $("settings").close();

$("speak").onchange = e => {
  speak = e.target.checked;
};

$("menu").onclick = () => {
  $("sidebar").classList.toggle("open");
};

$("voice").onclick = () => {
  const Recognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!Recognition) {
    alert("Voice input is not supported. Try Chrome.");
    return;
  }

  const recognition = new Recognition();
  recognition.lang = "en-IN";

  recognition.onresult = e => {
    $("message").value =
      e.results[0][0].transcript;
  };

  recognition.onerror = () => {
    alert("Microphone permission may be needed.");
  };

  recognition.start();
};
