# Northstar Construction Website

A responsive three-page construction company website built with HTML, CSS, vanilla JavaScript, and a small Python standard-library server. It includes a services overview, a contact form with browser-local autofill, and a Gemini-powered general-purpose chatbot.

## Pages and features

- `index.html` — hero, company introduction, services, and AI assistant.
- `services.html` — responsive two-column service cards and project note.
- `contact.html` — contact form with saved name/email and a local success message.
- Shared responsive navigation, accessible labels, SEO metadata, and footer on all pages.
- `style.css` — shared responsive styles, mobile menu, form, cards, and chatbot UI.
- `script.js` — shared navigation, form, and chatbot behavior.
- `server.py` — serves the website and securely proxies Gemini requests without exposing the API key to the browser.
- `.env.example` — example server configuration; copy it to `.env` and add your API key.

## Run locally with Gemini

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. In PowerShell, run `Copy-Item .env.example .env`, then open `.env` and replace the example value with your key. Keep `.env` private; it is excluded by `.gitignore`.
3. From this folder, run `python server.py`.
4. Open `http://127.0.0.1:8765` in your browser.

If a different app is already using port 8765, run `python server.py` with a custom port instead: `set PORT=9000` then `python server.py`, and open `http://127.0.0.1:9000`.

The website and `/api/chat` endpoint must be accessed through this server; opening `index.html` directly will not connect to Gemini. The server uses the `gemini-flash-lite-latest` model by default. Change `GEMINI_MODEL` in `.env` to another model available to your API key if needed. No Python packages need to be installed.

The chatbot can answer general questions and use the conversation history for follow-ups. Its prompt also guides it to give project-specific construction inquiries to the Northstar team when a quote, site visit, or licensed professional is needed. Homepage text and service details are static, so they do not consume Gemini quota; Gemini is called only when a visitor sends a chat message.

If the key is missing or Gemini cannot be reached, the chatbot displays a useful error and the rest of the site remains available. Do not commit `.env` or put the key in browser code. For a public deployment, run the Python server as a backend and configure `GEMINI_API_KEY` as a private environment variable in your hosting provider; do not expose the development server directly to the internet.

## Before publishing

- Replace the `https://example.com/` canonical URLs with the site's real domain.
- Replace placeholder email, phone, and construction company details.
- Configure a secure server-side Gemini proxy if enabling AI features.
