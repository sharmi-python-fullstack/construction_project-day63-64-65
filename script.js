const CHAT_API_URL = "/api/chat";
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_TEXT_LENGTH = 4000;

async function callGemini(prompt, history = []) {
  const response = await fetch(CHAT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt, history })
  });

  const responseBody = await response.text();
  let data;
  try {
    data = JSON.parse(responseBody);
  } catch {
    const contentType = response.headers.get("content-type") || "unknown content type";
    if (contentType.includes("text/html")) {
      throw new Error(
        `The chat endpoint returned a web page instead of JSON (HTTP ${response.status}). ` +
        "Stop other local servers, run `python server.py` in this project folder, and open http://127.0.0.1:8765."
      );
    }
    throw new Error(
      `The chat endpoint returned an invalid response (HTTP ${response.status}, ${contentType}). ` +
      "Check that the Python server is running for this project."
    );
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`The chat endpoint returned an unexpected response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `The assistant request failed (${response.status}).`);
  }

  if (typeof data.answer !== "string" || !data.answer.trim()) {
    throw new Error("The assistant returned an empty response.");
  }

  return data.answer.trim();
}

function initializeNavigation() {
  const toggle = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".site-nav");
  if (!toggle || !navigation) return;

  const closeMenu = () => {
    navigation.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation menu");
  };

  toggle.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
  });
  navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

function initializeContactForm() {
  const form = document.querySelector("#contact-form");
  const nameInput = document.querySelector("#full-name");
  const emailInput = document.querySelector("#email");
  const successMessage = document.querySelector("#form-success");
  if (!form || !nameInput || !emailInput || !successMessage) return;

  const storageKey = "northstar-contact";
  try {
    const savedDetails = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (savedDetails && typeof savedDetails.name === "string" && typeof savedDetails.email === "string") {
      nameInput.value = savedDetails.name;
      emailInput.value = savedDetails.email;
    }
  } catch (error) {
    console.error("Could not load saved contact details:", error);
  }

  const saveContactDetails = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        name: nameInput.value,
        email: emailInput.value
      }));
    } catch (error) {
      console.error("Could not save contact details:", error);
      successMessage.textContent = "Your browser could not save your details, but your message is ready.";
    }
  };

  nameInput.addEventListener("input", saveContactDetails);
  emailInput.addEventListener("input", saveContactDetails);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    successMessage.textContent = "Thanks for reaching out! Your project inquiry has been recorded.";
  });
}

function initializeChatbot() {
  const panel = document.querySelector("#chatbot-panel");
  const toggle = document.querySelector("#chat-toggle");
  const closeButton = document.querySelector(".chat-close");
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#chat-input");
  const messages = document.querySelector("#chat-messages");
  if (!panel || !toggle || !closeButton || !form || !input || !messages) return;

  const history = [];
  let isSending = false;

  const addMessage = (text, role) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-message ${role === "user" ? "user-message" : "ai-message"}`;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    bubble.append(paragraph);
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  };

  const setOpen = (isOpen) => {
    panel.classList.toggle("is-open", isOpen);
    panel.setAttribute("aria-hidden", String(!isOpen));
    panel.inert = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Close AI assistant" : "Open AI assistant");
    if (isOpen) {
      input.focus();
    } else {
      toggle.focus();
    }
  };

  toggle.addEventListener("click", () => setOpen(!panel.classList.contains("is-open")));
  closeButton.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  addMessage("Hello! Ask me anything. I can help with construction projects and more.", "ai");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const prompt = input.value.trim();
    if (!prompt || isSending) return;

    addMessage(prompt, "user");
    input.value = "";
    isSending = true;
    const sendButton = form.querySelector("button[type='submit']");
    sendButton.disabled = true;
    const typing = document.createElement("div");
    typing.className = "chat-message ai-message typing-indicator";
    typing.setAttribute("aria-label", "Assistant is typing");
    typing.innerHTML = "<span></span><span></span><span></span>";
    messages.append(typing);
    messages.scrollTop = messages.scrollHeight;

    try {
      const answer = await callGemini(prompt, history);
      typing.remove();
      addMessage(answer, "ai");
      history.push(
        { role: "user", parts: [{ text: prompt.slice(0, MAX_HISTORY_TEXT_LENGTH) }] },
        { role: "model", parts: [{ text: answer.slice(0, MAX_HISTORY_TEXT_LENGTH) }] }
      );
      if (history.length > MAX_HISTORY_MESSAGES) {
        history.splice(0, history.length - MAX_HISTORY_MESSAGES);
      }
    } catch (error) {
      console.error("Could not get a chatbot response:", error);
      typing.remove();
      addMessage(error.message || "I’m sorry, I can’t connect to the assistant right now. Please try again later.", "ai");
    } finally {
      isSending = false;
      sendButton.disabled = false;
      input.focus();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initializeNavigation();
  initializeContactForm();
  initializeChatbot();

  document.querySelectorAll(".current-year").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
});
