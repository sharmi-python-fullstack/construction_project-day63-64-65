// Add a Gemini API key here for local testing. Never publish a browser-exposed key.
const GEMINI_API_KEY = "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const CONTENT_ERROR = "Failed to load content. Please try again later.";

async function callGemini(prompt, history = []) {
  if (!GEMINI_API_KEY.trim()) {
    throw new Error("Gemini API key is not configured.");
  }

  const contents = [...history, { role: "user", parts: [{ text: prompt }] }];
  const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents })
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}.`);
  }

  const data = await response.json();
  const answer = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!answer) {
    throw new Error("Gemini returned an empty response.");
  }

  return answer;
}

function showGeneratedError(element) {
  element.classList.remove("loading-content");
  element.textContent = CONTENT_ERROR;
}

function renderParagraphs(container, text) {
  container.replaceChildren();
  text.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean).forEach((paragraph) => {
    const item = document.createElement("p");
    item.textContent = paragraph;
    container.append(item);
  });
  container.classList.remove("loading-content");
}

function renderServiceBullets(container, text) {
  container.replaceChildren();
  const bullets = text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

  if (bullets.length === 0) {
    throw new Error("Gemini returned no services to display.");
  }

  const list = document.createElement("ul");
  bullets.forEach((bullet) => {
    const item = document.createElement("li");
    item.textContent = bullet;
    list.append(item);
  });
  container.append(list);
  container.classList.remove("loading-content");
}

async function generateAboutContent(container) {
  try {
    const prompt = "Write a professional About Us section for Northstar Construction, a residential and commercial construction company. Use a warm, confident, trustworthy tone. Emphasize integrity, quality craftsmanship, clear communication, thoughtful planning, and building lasting relationships. Write two concise paragraphs and do not use a heading.";
    renderParagraphs(container, await callGemini(prompt));
  } catch (error) {
    console.error("Could not generate the About Us content:", error);
    showGeneratedError(container);
  }
}

async function generateServicesContent(container) {
  try {
    const prompt = "List five core services for Northstar Construction, a residential and commercial construction company. Return only a plain-text bulleted list, with one concise service and description per line. Do not include an introduction or markdown heading.";
    renderServiceBullets(container, await callGemini(prompt));
  } catch (error) {
    console.error("Could not generate the services content:", error);
    showGeneratedError(container);
  }
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
    toggle.setAttribute("aria-label", isOpen ? "Close project assistant" : "Open project assistant");
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

  addMessage("Hello! How can I help you with your construction project?", "ai");
  history.push({
    role: "model",
    parts: [{ text: "Hello! How can I help you with your construction project?" }]
  });

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
      const answer = await callGemini(
        `You are a helpful, professional assistant for Northstar Construction. Answer questions about construction projects clearly and responsibly. If a question needs a site visit, quote, or licensed professional, recommend speaking with the company. User question: ${prompt}`,
        history
      );
      typing.remove();
      addMessage(answer, "ai");
      history.push(
        { role: "user", parts: [{ text: prompt }] },
        { role: "model", parts: [{ text: answer }] }
      );
    } catch (error) {
      console.error("Could not get a chatbot response:", error);
      typing.remove();
      addMessage("I’m sorry, I can’t connect to the assistant right now. Please try again later or contact our team directly.", "ai");
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

  const aboutContent = document.querySelector("#about-us-content");
  const servicesContent = document.querySelector("#services-content");
  if (aboutContent) generateAboutContent(aboutContent);
  if (servicesContent) generateServicesContent(servicesContent);

  document.querySelectorAll(".current-year").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
});
