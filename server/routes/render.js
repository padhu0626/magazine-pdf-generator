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

    // Insert pull quote after 2nd paragraph in body
    let bodyHtml = article.bodyHtml || '';
    if (pullQuoteHtml && !bodyHtml.includes('pull-quote')) {
        const paras = bodyHtml.split('</p>');
        if (paras.length > 2) {
            paras.splice(2, 0, pullQuoteHtml);
            bodyHtml = paras.join('</p>');
        }
    }

    // Build template-specific body content
    let contentHtml = '';

    switch (templateName) {
        case 'cover':
            contentHtml = `
<div class="cover-page">
    <div class="cover-overlay"></div>
    <div class="cover-content">
        <div class="cover-masthead">
            <div class="logo-text">${escapeHtml(article.magazineName || article.title || 'Magazine')}</div>
            <div class="issue-info">Issue 01 &middot; April 2026</div>
            <div class="gold-line"></div>
        </div>
        <div class="cover-theme">
            <h1>${escapeHtml(article.title)}</h1>
            ${article.subtitle ? `<p class="tagline">${escapeHtml(article.subtitle)}</p>` : ''}
        </div>
        <div class="cover-teasers"></div>
    </div>
</div>`;
            break;

        case 'editors-letter':
            contentHtml = `
<article class="editors-letter">
    <header class="letter-header">
        <h1>ஆசிரியர் கடிதம்</h1>
        <div class="accent-bar"></div>
    </header>
    <div class="letter-body">${bodyHtml}</div>
    ${article.author ? `<div class="signature">${escapeHtml(article.author)}<div class="title">ஆசிரியர்</div></div>` : ''}
</article>`;
            break;

        case 'interview':
            contentHtml = `
<article class="interview-page">
    <header class="interview-header">
        <span class="category-tag">INTERVIEW &middot; நேர்காணல்</span>
        <h1>${escapeHtml(article.title)}</h1>
        ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
        ${article.author ? `<p class="byline">நேர்காணல்: ${escapeHtml(article.author)} &middot; ஏப்ரல் 2026</p>` : ''}
    </header>
    <div class="interview-body">${bodyHtml}</div>
</article>`;
            break;

        case 'short-story':
            contentHtml = `
<article class="short-story">
    <header class="story-header">
        <span class="genre-tag">Fiction &middot; சிறுகதை</span>
        <h1>${escapeHtml(article.title)}</h1>
        ${article.author ? `<p class="byline">${escapeHtml(article.author)}</p>` : ''}
    </header>
    <div class="story-body">${bodyHtml}
        <p class="end-mark" style="text-align:center;margin-top:16pt;color:#c9a961;">&#x2766;</p>
    </div>
</article>`;
            break;

        case 'poetry':
            contentHtml = `
<article class="poetry-page">
    <header class="poetry-header">
        <span class="genre-tag">Poetry &middot; கவிதை</span>
        <h1>${escapeHtml(article.title)}</h1>
    </header>
    <div class="poem">
        <div class="poem-body">${bodyHtml}</div>
        ${article.author ? `<div class="poet-credit">— ${escapeHtml(article.author)}</div>` : ''}
    </div>
</article>`;
            break;

        case 'editorial':
            contentHtml = `
<article class="editorial-page">
    <header class="editorial-header">
        <span class="opinion-tag">Opinion &middot; கருத்து</span>
        <h1>${escapeHtml(article.title)}</h1>
        ${article.author ? `<div class="byline"><div class="author-info"><div class="name">${escapeHtml(article.author)}</div>ஏப்ரல் 2026</div></div>` : ''}
    </header>
    <div class="editorial-body">${bodyHtml}</div>
</article>`;
            break;

        case 'photo-essay':
            contentHtml = `
<article class="photo-essay">
    <header class="photo-header">
        <span class="category-tag">Photo Essay &middot; புகைப்படக் கட்டுரை</span>
        <h1>${escapeHtml(article.title)}</h1>
        ${article.author ? `<p class="byline">${escapeHtml(article.author)} &middot; ஏப்ரல் 2026</p>` : ''}
    </header>
    <div>${bodyHtml}</div>
</article>`;
            break;

        case 'cartoon':
            contentHtml = `
<article class="cartoon-page">
    <figure class="cartoon-image"><img src="" alt=""></figure>
    <p class="cartoon-caption">${escapeHtml(article.title)}</p>
    ${article.author ? `<p class="artist-credit">Illustration by ${escapeHtml(article.author)}</p>` : ''}
</article>`;
            break;

        case 'back-cover':
            contentHtml = `
<div class="back-cover">
    <div class="next-issue">
        <p class="label">Coming Next</p>
        <h2>அடுத்த இதழில்</h2>
        ${article.title ? `<p class="teaser">${escapeHtml(article.title)}</p>` : ''}
    </div>
    <div class="motif">● ● ●</div>
    <div class="credits">
        <div class="magazine-name">${escapeHtml(article.magazineName || article.title || 'Magazine')}</div>
        <div class="info">Issue 01 &middot; April 2026</div>
    </div>
</div>`;
            break;

        default: // feature-opening, feature-continuation, toc
            contentHtml = `
<article class="${templateName}">
    <header class="feature-hero">
        ${article.category ? `<span class="category-tag">${escapeHtml(article.category)}</span>` : ''}
        <hr class="accent-line">
        <h1>${escapeHtml(article.title)}</h1>
        ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
        ${article.author ? `<p class="byline"><span class="author-name">${escapeHtml(article.author)}</span> &middot; ஏப்ரல் 2026</p>` : ''}
    </header>
    <div class="article-body">${bodyHtml}</div>
    <p class="end-mark">&#x2766;</p>
</article>`;
    }

    return `<!DOCTYPE html>
<html lang="ta">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(article.title)} — ${escapeHtml(article.magazineName || article.title || 'Magazine')}</title>
<link rel="stylesheet" href="${brandCssPath}">
<link rel="stylesheet" href="${masterCssPath}">
<link rel="stylesheet" href="${templateCssPath}">
<style>
:root {
    --magazine-name: '${escapeHtml(article.magazineName || article.title || 'Magazine')}';
    --article-title: '${escapeHtml(article.title)}';
    --issue-date: 'ஏப்ரல் 2026';
}
</style>
</head>
<body>
${contentHtml}
</body>
</html>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = router;
