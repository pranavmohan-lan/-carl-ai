# CARL — Personal AI Website

Responsive JARVIS-inspired interface for GitHub Pages.

## Included
- Dark blue/cyan dashboard
- Chat interface with local demo responses
- Suggested prompts
- Browser voice input (Chrome support required)
- Optional spoken demo replies
- Settings dialog

## Important
This starter is **demo-only**. It does not call a real AI model. GitHub Pages is static hosting: never put API keys in `app.js`, `index.html`, or a public repository. A real AI connection needs a separate backend that keeps credentials server-side. Check the provider's current age rules, acceptable-use terms, privacy and pricing with a parent or guardian before connecting it. Do not use another person's API key or bypass age restrictions.

## Publish using GitHub Pages
1. Sign in to GitHub and create a repository named `carl-ai`.
2. For free GitHub Pages hosting, make it Public. Do not upload private information or secrets.
3. Upload `index.html`, `styles.css`, `app.js`, and `README.md` to the repository's main/root folder.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, select **Deploy from a branch**.
6. Choose branch **main** and folder **/(root)**, then save.
7. Wait for GitHub to publish. The website address appears on the Pages settings screen.

## Run locally
Open `index.html` in a modern browser. Microphone support generally requires HTTPS (GitHub Pages provides HTTPS).

## Files
- `index.html`: structure
- `styles.css`: design and responsive layout
- `app.js`: demo chat and browser voice features
