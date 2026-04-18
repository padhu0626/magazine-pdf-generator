# Tamil Magazine PDF Generator

Print-quality Tamil magazine PDF generator. Takes contributor `.docx` submissions and produces professionally-laid-out magazine PDFs using Paged.js (CSS Paged Media).

## Tech Stack

- **Layout Engine:** Paged.js (W3C CSS Paged Media)
- **PDF Rendering:** Puppeteer (headless Chromium)
- **Document Parsing:** Mammoth.js (.docx to HTML)
- **Image Processing:** Sharp
- **Server:** Node.js + Express

## Quick Start

```bash
npm install
npm run render-test    # Renders a test feature article to PDF
npm start              # Starts the admin server
```

## Project Structure

```
templates/          — Designer-crafted page templates (HTML+CSS)
brand/              — Visual identity (logo, colors, fonts)
server/             — Express server + PDF pipeline
client/             — Admin UI
issues/             — Issue data and outputs
```

## Templates

| # | Template | Purpose |
|---|----------|---------|
| 1 | Cover | Full-page cover with masthead |
| 2 | TOC | Table of contents |
| 3 | Editor's Letter | Editorial column |
| 4 | Feature Opening | Feature article first page (drop cap, pull quotes) |
| 5 | Feature Continuation | Multi-page article continuation |
| 6 | Interview | Q&A format |
| 7 | Short Story | Fiction layout |
| 8 | Poetry | Minimal, white-space focused |
| 9 | Editorial | Opinion column |
| 10 | Photo Essay | Image-dominant |
| 11 | Cartoon | Full-page illustration |
| 12 | Back Cover | Publication credits |
