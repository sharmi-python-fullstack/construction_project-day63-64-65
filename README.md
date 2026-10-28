# Northstar Construction Website

A responsive three-page construction company website built with HTML, CSS, and vanilla JavaScript. It includes a services overview, a contact form with browser-local autofill, and an optional Gemini-powered chatbot and homepage content generator.

## Pages and features

- `index.html` — hero, company introduction, generated services, and project assistant.
- `services.html` — responsive two-column service cards and project note.
- `contact.html` — contact form with saved name/email and a local success message.
- Shared responsive navigation, accessible labels, SEO metadata, and footer on all pages.
- `style.css` — shared responsive styles, mobile menu, form, cards, and chatbot UI.
- `script.js` — shared navigation, form, Gemini API, and chatbot behavior.

## Run locally

Open `index.html` in a browser, or serve this folder with a local static web server and navigate to the page. The navigation links work between the three HTML pages.

## Gemini setup

The Gemini integration is disabled until an API key is configured. For a quick local experiment, set `GEMINI_API_KEY` near the top of `script.js`. A key placed in browser JavaScript is visible to visitors and must not be used on a public or production website. For deployment, route Gemini requests through a server-side endpoint that stores the key securely.

Without a configured key, generated homepage sections and chatbot responses show a friendly fallback. The main page content and services remain available.

## Before publishing

- Replace the `https://example.com/` canonical URLs with the site's real domain.
- Replace placeholder email, phone, and construction company details.
- Configure a secure server-side Gemini proxy if enabling AI features.
