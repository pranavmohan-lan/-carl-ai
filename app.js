
const $ = id => document.getElementById(id);

const API_URL = "https://carl-ai.pranav-mohan.workers.dev";

let speak = false;

// Stores the current conversation
let conversation = [];

function add(role, text) {
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
}

async function send(q) {
  q = q.trim();
  if (!q) return;

  add("user", q);
  $("message").value = "";

  // Save the user's message
  conversation.push({
    role: "user",
    content: q
  });

  try {
    const response = await fetch(API_URL + "/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: conversation.slice(-20)
      })
    });

    if (!response.ok) {
      throw new Error("Server error: " + response.status);
    }

    const data = await response.json();
    const reply = data.message || "I received your request.";

    // Save CARL's reply for future context
    conversation.push({
      role: "assistant",
      content: reply
    });

    add("assistant", reply);

    if (speak && "speechSynthesis" in window) {
      speechSynthesis.speak(
        new SpeechSynthesisUtterance(reply)
      );
    }

  } catch (error) {
    console.error(error);

    add(
      "assistant",
      "I couldn't connect to my backend. Please check your internet connection and try again."
    );
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
    alert("Voice input is not supported in this browser. Try Chrome.");
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
