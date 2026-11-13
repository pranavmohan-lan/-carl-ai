
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

  // Return the text element so we can update it live
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

  // Create an empty CARL response immediately
  const output = add("assistant", "");

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
      const error = await response.text();
      throw new Error("Server error " + response.status + ": " + error);
    }

    if (!response.body) {
      throw new Error("Streaming is not supported by this response.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let reply = "";

    function processLine(line) {
      if (!line.startsWith("data:")) return;

      const data = line.slice(5).trim();

      if (!data || data === "[DONE]") return;

      try {
        const chunk = JSON.parse(data);
        const content = chunk.choices?.[0]?.delta?.content;

        if (typeof content === "string" && content) {
          reply += content;
          output.textContent = reply;
          $("chat").scrollTop = $("chat").scrollHeight;
        }
      } catch (error) {
        console.warn("Could not parse stream chunk:", error);
      }
    }

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

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

    // Save the complete answer to conversation history
    conversation.push({
      role: "assistant",
      content: reply
    });

    if (speak && "speechSynthesis" in window) {
      speechSynthesis.speak(
        new SpeechSynthesisUtterance(reply)
      );
    }

  } catch (error) {
    console.error("CARL streaming error:", error);

    output.textContent = reply
      ? reply + "\n\n[Connection interrupted]"
      : "I couldn't generate a response. Please try again.";
  }
}
