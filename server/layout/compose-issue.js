/**
 * Issue Composer — Assembles multiple articles into a single magazine HTML
 * that Paged.js will paginate into a complete magazine PDF.
 */
const fs = require('fs');
const path = require('path');

/**
 * Compose a full magazine issue HTML from articles and metadata
 * @param {object} issue - Issue metadata (title, date, id)
 * @param {Array} articles - Array of parsed article objects with template assignments
 * @returns {string} Complete HTML for the full magazine
 */
function composeIssue(issue, articles) {
    const brandCss = fs.readFileSync(path.resolve(__dirname, '../../brand/brand.css'), 'utf-8');
    const masterCss = fs.readFileSync(path.resolve(__dirname, '../../templates/_master.css'), 'utf-8');

    // Load all needed template CSS
    const templateCssSet = new Set(articles.map(a => a.template || 'feature-opening'));
    templateCssSet.add('cover');
    templateCssSet.add('toc');
    templateCssSet.add('back-cover');

    let allTemplateCss = '';
    for (const tmpl of templateCssSet) {
        const cssPath = path.resolve(__dirname, `../../templates/${tmpl}.css`);
        if (fs.existsSync(cssPath)) {
            allTemplateCss += `/* --- ${tmpl} --- */\n` + fs.readFileSync(cssPath, 'utf-8') + '\n';
        }
    }

    // Build page sections
    const coverHtml = buildCover(issue, articles);
    const tocHtml = buildToc(issue, articles);
    const articlesHtml = articles.map((a, idx) => buildArticleSection(a, idx)).join('\n');
    const backCoverHtml = buildBackCover(issue);

    return `<!DOCTYPE html>
<html lang="ta">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(issue.title || 'தமிழ் இதழ்')} — ${escapeHtml(issue.id || '')}</title>
<style>
${brandCss}
${masterCss}
${allTemplateCss}
</style>
</head>
<body>
${coverHtml}
${tocHtml}
${articlesHtml}
${backCoverHtml}
</body>
</html>`;
}

function buildCover(issue, articles) {
    const teasers = articles.slice(0, 3).map(a =>
        `<p class="teaser">${escapeHtml(a.title)}</p>`
    ).join('\n');

    return `
<div class="cover-page">
    <div class="cover-overlay"></div>
    <div class="cover-content">
        <div class="cover-masthead">
            <div class="logo-text">தமிழ் இதழ்</div>
            <div class="issue-info">${escapeHtml(issue.id || 'Issue 01')} &middot; ${escapeHtml(issue.date || 'April 2026')}</div>
            <div class="gold-line"></div>
        </div>
        <div class="cover-theme">
            <h1>${escapeHtml(issue.title || 'தமிழ் இதழ்')}</h1>
            ${issue.tagline ? `<p class="tagline">${escapeHtml(issue.tagline)}</p>` : ''}
        </div>
        <div class="cover-teasers">${teasers}</div>
    </div>
</div>`;
}

function buildToc(issue, articles) {
    let pageNum = 3; // Cover=1, TOC=2, first article starts at 3
    const items = articles.map((a, idx) => {
        const item = `
        <li class="toc-item">
            <span class="toc-number">${String(idx + 1).padStart(2, '0')}</span>
            <div class="toc-details">
                <div class="toc-title">${escapeHtml(a.title)}</div>
                <div class="toc-meta">${escapeHtml(a.author || '')} ${a.category ? `<span class="toc-category">${escapeHtml(a.category)}</span>` : ''}</div>
            </div>
            <span class="toc-page-num">${pageNum}</span>
        </li>`;
        pageNum += Math.max(1, Math.ceil((a.wordCount || 300) / 500)); // estimate pages
        return item;
    }).join('\n');

    return `
<article class="toc-page">
    <header class="toc-header">
        <div class="logo-small">தமிழ் இதழ்</div>
        <h1>உள்ளடக்கம்</h1>
    </header>
    <ul class="toc-list">${items}</ul>
</article>`;
}

function buildArticleSection(article, index) {
    const template = article.template || 'feature-opening';
    let bodyHtml = article.bodyHtml || '';

    // Insert pull quote
    if (article.pullQuotes && article.pullQuotes.length > 0 && !bodyHtml.includes('pull-quote')) {
        const pq = `<blockquote class="pull-quote">"${escapeHtml(article.pullQuotes[0])}"</blockquote>`;
        const paras = bodyHtml.split('</p>');
        if (paras.length > 2) {
            paras.splice(2, 0, pq);
            bodyHtml = paras.join('</p>');
        }
    }

    switch (template) {
        case 'editors-letter':
            return `
<article class="editors-letter">
    <header class="letter-header"><h1>ஆசிரியர் கடிதம்</h1><div class="accent-bar"></div></header>
    <div class="letter-body">${bodyHtml}</div>
    ${article.author ? `<div class="signature">${escapeHtml(article.author)}<div class="title">ஆசிரியர்</div></div>` : ''}
</article>`;

        case 'interview':
            return `
<article class="interview-page">
    <header class="interview-header">
        <span class="category-tag">INTERVIEW &middot; நேர்காணல்</span>
        <h1>${escapeHtml(article.title)}</h1>
        ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
        ${article.author ? `<p class="byline">நேர்காணல்: ${escapeHtml(article.author)}</p>` : ''}
    </header>
    <div class="interview-body">${bodyHtml}</div>
</article>`;

        case 'short-story':
            return `
<article class="short-story">
    <header class="story-header">
        <span class="genre-tag">Fiction &middot; சிறுகதை</span>
        <h1>${escapeHtml(article.title)}</h1>
        ${article.author ? `<p class="byline">${escapeHtml(article.author)}</p>` : ''}
    </header>
    <div class="story-body">${bodyHtml}<p class="end-mark" style="text-align:center;margin-top:16pt;color:#c9a961;">&#x2766;</p></div>
</article>`;

        case 'poetry':
            return `
<article class="poetry-page">
    <header class="poetry-header">
        <span class="genre-tag">Poetry &middot; கவிதை</span>
        <h1>${escapeHtml(article.title)}</h1>
    </header>
    <div class="poem"><div class="poem-body">${bodyHtml}</div>
    ${article.author ? `<div class="poet-credit">— ${escapeHtml(article.author)}</div>` : ''}</div>
</article>`;

        case 'editorial':
            return `
<article class="editorial-page">
    <header class="editorial-header">
        <span class="opinion-tag">Opinion &middot; கருத்து</span>
        <h1>${escapeHtml(article.title)}</h1>
        ${article.author ? `<div class="byline"><div class="author-info"><div class="name">${escapeHtml(article.author)}</div></div></div>` : ''}
    </header>
    <div class="editorial-body">${bodyHtml}</div>
</article>`;

        default: // feature-opening, feature-continuation
            return `
<article class="${template}">
    <header class="feature-hero">
        ${article.category ? `<span class="category-tag">${escapeHtml(article.category)}</span>` : ''}
        <hr class="accent-line">
        <h1>${escapeHtml(article.title)}</h1>
        ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
        ${article.author ? `<p class="byline"><span class="author-name">${escapeHtml(article.author)}</span></p>` : ''}
    </header>
    <div class="article-body">${bodyHtml}</div>
    <p class="end-mark">&#x2766;</p>
</article>`;
    }
}

function buildBackCover(issue) {
    return `
<div class="back-cover">
    <div class="next-issue">
        <p class="label">Coming Next</p>
        <h2>அடுத்த இதழில்</h2>
        <p class="teaser">மேலும் சிறந்த கட்டுரைகள் வரவிருக்கின்றன</p>
    </div>
    <div class="motif">● ● ●</div>
    <div class="credits">
        <div class="magazine-name">தமிழ் இதழ்</div>
        <div class="info">${escapeHtml(issue.id || 'Issue 01')} &middot; ${escapeHtml(issue.date || 'April 2026')}</div>
    </div>
</div>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { composeIssue };
