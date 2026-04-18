/**
 * Issue Composer — Assembles multiple articles into a single magazine HTML
 * with branded headers (pennant strip + magazine name) and footers on every page.
 */
const fs = require('fs');
const path = require('path');

function composeIssue(issue, articles) {
    const brandCss = fs.readFileSync(path.resolve(__dirname, '../../brand/brand.css'), 'utf-8');
    const masterCss = fs.readFileSync(path.resolve(__dirname, '../../templates/_master.css'), 'utf-8');

    const templateCssSet = new Set(articles.map(a => a.template || 'feature-opening'));
    templateCssSet.add('cover');
    templateCssSet.add('toc');
    templateCssSet.add('back-cover');
    templateCssSet.add('gallery');

    let allTemplateCss = '';
    for (const tmpl of templateCssSet) {
        const cssPath = path.resolve(__dirname, `../../templates/${tmpl}.css`);
        if (fs.existsSync(cssPath)) {
            allTemplateCss += `/* --- ${tmpl} --- */\n` + fs.readFileSync(cssPath, 'utf-8') + '\n';
        }
    }

    const magazineName = issue.magazineName || issue.title || 'Magazine';
    const coverHtml = buildCover(issue, articles, magazineName);
    const tocHtml = buildToc(issue, articles, magazineName);
    const articlesHtml = articles.map((a, idx) => buildArticleSection(a, idx, issue, magazineName)).join('\n');
    const backCoverHtml = buildBackCover(issue, magazineName);

    return `<!DOCTYPE html>
<html lang="ta">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(magazineName)} — ${escapeHtml(issue.id || '')}</title>
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

function buildPageHeader(pageNum, magazineName, sectionLabel, authorName) {
    return `
    <div class="page-header">
        <div class="header-accent-line"></div>
        <div class="header-bar">
            <div class="header-page-num">${pageNum || ''}</div>
            <div class="header-magazine-name">${escapeHtml(magazineName)}</div>
            <div class="header-article-info">
                ${sectionLabel ? `<span class="section-name">${escapeHtml(sectionLabel)}</span>` : ''}
                ${authorName ? `<br>${escapeHtml(authorName)}` : ''}
            </div>
        </div>
    </div>`;
}

function buildPageFooter(magazineName, issueDate, website) {
    return `
    <div class="page-footer">
        <div class="footer-left">${escapeHtml(website || '')}</div>
        <div class="footer-center">
            ${escapeHtml(magazineName)}
            <span class="footer-dot"></span>
            ${escapeHtml(issueDate || '')}
        </div>
        <div class="footer-right">${escapeHtml(website || '')}</div>
    </div>`;
}

function buildCover(issue, articles, magazineName) {
    const teasers = articles.slice(0, 3).map(a =>
        `<p class="teaser">${escapeHtml(a.title)}</p>`
    ).join('\n');

    return `
<div class="cover-page">
    ${issue.coverImage ? `<img class="cover-bg" src="${escapeHtml(issue.coverImage)}" alt="">` : ''}
    <div class="cover-overlay"></div>
    <div class="cover-content">
        <div class="cover-masthead">
            <div class="magazine-name">${escapeHtml(magazineName)}</div>
            <div class="magazine-subtitle">TAMIL MAGAZINE</div>
            <div class="issue-info">
                <span>${escapeHtml(issue.id || 'Issue 01')}</span>
                <span class="dot"></span>
                <span>${escapeHtml(issue.date || 'April 2026')}</span>
            </div>
            <div class="gold-line"></div>
        </div>
        <div class="cover-theme">
            <h1>${escapeHtml(issue.title || magazineName)}</h1>
            ${issue.tagline ? `<p class="tagline">${escapeHtml(issue.tagline)}</p>` : ''}
        </div>
        <div class="cover-teasers">${teasers}</div>
    </div>
    <div class="cover-bottom-bar">
        <span>${escapeHtml(issue.date || 'April 2026')}</span>
        <span>${escapeHtml(magazineName)}</span>
    </div>
</div>`;
}

function buildToc(issue, articles, magazineName) {
    let pageNum = 3;
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
        pageNum += Math.max(1, Math.ceil((a.wordCount || 300) / 500));
        return item;
    }).join('\n');

    return `
<article class="toc-page">
    ${buildPageHeader('2', magazineName, 'உள்ளடக்கம்', '')}
    <header class="toc-header">
        <div class="logo-small">${escapeHtml(magazineName)}</div>
        <h1>உள்ளடக்கம்</h1>
    </header>
    <ul class="toc-list">${items}</ul>
    ${buildPageFooter(magazineName, issue.date, '')}
</article>`;
}

function buildAuthorBlock(article) {
    if (!article.author) return '';
    if (article.authorPhoto) {
        return `<div class="author-block">
            <img class="author-photo" src="${escapeHtml(article.authorPhoto)}" alt="">
            <div class="author-details">
                <div class="author-name">${escapeHtml(article.author)}</div>
                ${article.authorRole ? `<div class="author-role">${escapeHtml(article.authorRole)}</div>` : ''}
            </div>
        </div>`;
    }
    return `<p class="byline"><span class="author-name">${escapeHtml(article.author)}</span></p>`;
}

function buildHeroBanner(article) {
    if (!article.heroImage) return '';
    return `<div class="hero-banner">
        <img src="${escapeHtml(article.heroImage)}" alt="">
        ${article.heroCaption ? `<div class="banner-caption">${escapeHtml(article.heroCaption)}</div>` : ''}
    </div>`;
}

function buildGalleryGrid(article) {
    const photos = article.galleryPhotos || [];
    if (photos.length === 0) return '';
    const gridClass = photos.length >= 4 ? 'grid-4' : photos.length >= 3 ? 'grid-3' : photos.length === 2 ? 'grid-2' : 'grid-1';
    const items = photos.map(p => `
        <div class="gallery-item">
            <img src="${escapeHtml(p.src || '')}" alt="${escapeHtml(p.title || '')}">
            <div class="gallery-caption">
                ${p.title ? `<div class="artwork-title">${escapeHtml(p.title)}</div>` : ''}
                ${p.artist ? `<div class="artist-name">${escapeHtml(p.artist)}</div>` : ''}
                ${p.info ? `<div class="artist-info">${escapeHtml(p.info)}</div>` : ''}
            </div>
        </div>`).join('\n');
    return `<div class="gallery-grid ${gridClass}">${items}</div>`;
}

function buildArticleSection(article, index, issue, magazineName) {
    const template = article.template || 'feature-opening';
    let bodyHtml = article.bodyHtml || '';
    const pageNum = index + 3;

    // Insert pull quote
    if (article.pullQuotes && article.pullQuotes.length > 0 && !bodyHtml.includes('pull-quote')) {
        const pq = `<blockquote class="pull-quote">"${escapeHtml(article.pullQuotes[0])}"</blockquote>`;
        const paras = bodyHtml.split('</p>');
        if (paras.length > 2) { paras.splice(2, 0, pq); bodyHtml = paras.join('</p>'); }
    }

    const header = buildPageHeader(pageNum, magazineName, article.category || '', article.author || '');
    const footer = buildPageFooter(magazineName, issue.date, '');

    switch (template) {
        case 'editors-letter':
            return `
<article class="editors-letter">
    ${header}
    <header class="letter-header"><h1>ஆசிரியர் கடிதம்</h1><div class="accent-bar"></div></header>
    ${article.editorPhoto ? `<div class="editor-photo-wrap"><img class="editor-portrait" src="${escapeHtml(article.editorPhoto)}" alt=""><div class="editor-name-label">${escapeHtml(article.author || '')}</div></div>` : ''}
    <div class="letter-body">${bodyHtml}</div>
    ${article.author ? `<div class="signature">${escapeHtml(article.author)}<div class="title">ஆசிரியர்</div></div>` : ''}
    ${footer}
</article>`;

        case 'interview':
            return `
<article class="interview-page">
    ${header}
    <header class="interview-header">
        <span class="category-tag">INTERVIEW &middot; நேர்காணல்</span>
        <h1>${escapeHtml(article.title)}</h1>
        ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
        ${article.author ? `<p class="byline">நேர்காணல்: ${escapeHtml(article.author)}</p>` : ''}
    </header>
    <div class="interview-body">${bodyHtml}</div>
    ${footer}
</article>`;

        case 'short-story':
            return `
<article class="short-story">
    ${header}
    <header class="story-header">
        <span class="genre-tag">Fiction &middot; சிறுகதை</span>
        <h1>${escapeHtml(article.title)}</h1>
        ${article.author ? `<p class="byline">${escapeHtml(article.author)}</p>` : ''}
    </header>
    <div class="story-body">${bodyHtml} <span class="end-mark"></span></div>
    ${footer}
</article>`;

        case 'poetry':
            return `
<article class="poetry-page">
    ${header}
    <header class="poetry-header">
        <span class="genre-tag">Poetry &middot; கவிதை</span>
        <h1>${escapeHtml(article.title)}</h1>
    </header>
    <div class="poem"><div class="poem-body">${bodyHtml}</div>
    ${article.author ? `<div class="poet-credit">— ${escapeHtml(article.author)}</div>` : ''}</div>
    ${footer}
</article>`;

        case 'editorial':
            return `
<article class="editorial-page">
    ${header}
    <header class="editorial-header">
        <span class="opinion-tag">Opinion &middot; கருத்து</span>
        <h1>${escapeHtml(article.title)}</h1>
        ${article.author ? `<div class="byline"><div class="author-info"><div class="name">${escapeHtml(article.author)}</div></div></div>` : ''}
    </header>
    <div class="editorial-body">${bodyHtml}</div>
    ${footer}
</article>`;

        case 'gallery':
            return `
<article class="gallery-page">
    ${header}
    <header class="gallery-header">
        <h1>${escapeHtml(article.title || 'மாணவர் கலைத்திறன்')}</h1>
        ${article.subtitle ? `<p class="gallery-subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
    </header>
    ${article.bodyHtml ? `<p class="gallery-intro">${escapeHtml(article.bodyHtml.replace(/<[^>]+>/g, '').substring(0, 200))}</p>` : ''}
    ${buildGalleryGrid(article)}
    ${footer}
</article>`;

        default: // feature-opening, feature-continuation
            return `
<article class="${template}">
    ${header}
    ${buildHeroBanner(article)}
    <header class="feature-hero">
        ${article.category ? `<span class="category-tag">${escapeHtml(article.category)}</span>` : ''}
        <hr class="accent-line">
        <h1>${escapeHtml(article.title)}</h1>
        ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
    </header>
    ${buildAuthorBlock(article)}
    <div class="article-body">${bodyHtml} <span class="end-mark"></span></div>
    ${footer}
</article>`;
    }
}

function buildBackCover(issue, magazineName) {
    return `
<div class="back-cover">
    <div class="back-top">
        <div class="back-magazine-name">${escapeHtml(magazineName)}</div>
        <div class="back-tagline">TAMIL MAGAZINE</div>
        <div class="back-gold-line"></div>
        <div class="next-issue">
            <p class="label">Coming Next</p>
            <h2>அடுத்த இதழில்</h2>
            <p class="teaser">மேலும் சிறந்த கட்டுரைகள் வரவிருக்கின்றன</p>
        </div>
    </div>
    <div class="back-bottom">
        <div class="issue-id">${escapeHtml(issue.id || '')} &middot; ${escapeHtml(issue.date || '')}</div>
        <div class="credits">Published by ${escapeHtml(magazineName)}</div>
    </div>
</div>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { composeIssue };
