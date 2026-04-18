/**
 * Render routes — generates PDF from parsed article data
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { renderToPdf } = require('../pdf/render-with-pagedjs');

const router = express.Router();

/**
 * POST /api/render — Render an article to PDF
 * Body: { article: {...parsed article data...}, template: 'feature-opening' }
 */
router.post('/', async (req, res) => {
    const { article, template } = req.body;

    if (!article) {
        return res.status(400).json({ error: 'No article data provided' });
    }

    const templateName = template || article.suggestedTemplate || 'feature-opening';

    try {
        // Build HTML from template + article data
        const html = buildHtmlFromArticle(article, templateName);

        // Write temp HTML file
        const tempDir = path.join(__dirname, '../../output/temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempHtml = path.join(tempDir, `render-${Date.now()}.html`);
        fs.writeFileSync(tempHtml, html);

        const outputPdf = path.join(__dirname, '../../output', `article-${Date.now()}.pdf`);

        await renderToPdf(tempHtml, outputPdf);

        // Clean up temp HTML
        fs.unlinkSync(tempHtml);

        // Send PDF path back
        const relativePath = path.relative(path.join(__dirname, '../..'), outputPdf);
        res.json({
            success: true,
            pdfPath: '/' + relativePath,
            pdfUrl: '/' + relativePath,
        });
    } catch (err) {
        console.error('Render error:', err);
        res.status(500).json({ error: 'Failed to render PDF: ' + err.message });
    }
});

function buildHtmlFromArticle(article, templateName) {
    const brandCssPath = '../brand/brand.css';
    const masterCssPath = '_master.css';
    const templateCssPath = `${templateName}.css`;

    // Build pull quotes HTML
    const pullQuoteHtml = (article.pullQuotes && article.pullQuotes.length > 0)
        ? `<blockquote class="pull-quote">"${escapeHtml(article.pullQuotes[0])}"</blockquote>`
        : '';

    // Insert pull quote after 2nd paragraph
    let bodyHtml = article.bodyHtml || '';
    if (pullQuoteHtml && !bodyHtml.includes('pull-quote')) {
        const paras = bodyHtml.split('</p>');
        if (paras.length > 2) {
            paras.splice(2, 0, pullQuoteHtml);
            bodyHtml = paras.join('</p>');
        }
    }

    return `<!DOCTYPE html>
<html lang="ta">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(article.title)} — தமிழ் இதழ்</title>
<link rel="stylesheet" href="${brandCssPath}">
<link rel="stylesheet" href="${masterCssPath}">
<link rel="stylesheet" href="${templateCssPath}">
<style>
:root {
    --magazine-name: 'தமிழ் இதழ்';
    --article-title: '${escapeHtml(article.title)}';
    --issue-date: 'ஏப்ரல் 2026';
}
</style>
</head>
<body>
<article class="${templateName}">
    <header class="feature-hero">
        ${article.category ? `<span class="category-tag">${escapeHtml(article.category)}</span>` : ''}
        <hr class="accent-line">
        <h1>${escapeHtml(article.title)}</h1>
        ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
        ${article.author ? `<p class="byline"><span class="author-name">${escapeHtml(article.author)}</span> &middot; ஏப்ரல் 2026</p>` : ''}
    </header>
    <div class="article-body">
        ${bodyHtml}
    </div>
    <p class="end-mark">&#x2766;</p>
</article>
</body>
</html>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = router;
