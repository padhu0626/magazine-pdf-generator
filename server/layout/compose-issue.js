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
    const articlesHtml = articles.map((a, idx) => buildArticleSection(a, idx, issue, magazineName, idx === articles.length - 1)).join('\n');
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
    // Pick up to 2 major article titles as prominent teasers for the cover
    const teaserArticles = articles.filter(a =>
        a.title && a.template !== 'gallery' && a.id && !a.id.startsWith('riddle-answers')
    );
    const teasers = teaserArticles.slice(0, 2).map(a => {
        // Shorten long titles with ellipsis
        let t = a.title;
        if (t.length > 25) t = t.substring(0, 23) + '...';
        return `<p class="teaser">${escapeHtml(t)}</p>`;
    }).join('\n');

    return `
<div class="cover-page">
    ${issue.coverImage ? `<img class="cover-bg" src="${escapeHtml(issue.coverImage)}" alt="">` : ''}
    <div class="cover-overlay"></div>
    <div class="cover-teasers">${teasers}</div>
    <div class="cover-content">
        <div class="cover-masthead">
            <div class="magazine-name">${escapeHtml(magazineName)}</div>
            <div class="issue-info">
                <span>${escapeHtml(issue.date || 'ஏப்ரல் 2026')}</span>
                <span class="dot"></span>
                <span>இதழ் ${escapeHtml(issue.id || '01')}</span>
            </div>
            <div class="gold-line"></div>
        </div>
        ${issue.title ? `<div class="cover-theme">
            <h1>${escapeHtml(issue.title)}</h1>
            ${issue.tagline ? `<p class="tagline">${escapeHtml(issue.tagline)}</p>` : ''}
        </div>` : ''}
    </div>
    <div class="cover-bottom-bar">
        <span>${escapeHtml(issue.date || 'ஏப்ரல் 2026')}</span>
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
                <div class="toc-meta">${escapeHtml(a.authorDisplay || a.author || '')} ${a.category ? `<span class="toc-category">${escapeHtml(a.category)}</span>` : ''}</div>
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
    const displayName = article.authorDisplay || article.author;
    if (!displayName) return '';
    if (article.authorPhoto) {
        return `<div class="author-block">
            <img class="author-photo" src="${escapeHtml(article.authorPhoto)}" alt="">
            <div class="author-details">
                <div class="author-name">${escapeHtml(displayName)}</div>
                ${article.authorRole ? `<div class="author-role">${escapeHtml(article.authorRole)}</div>` : ''}
            </div>
        </div>`;
    }
    return `<p class="byline"><span class="author-name">${escapeHtml(displayName)}</span></p>`;
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
                ${p.artist ? `<div class="artist-name">${escapeHtml(p.artist)}${p.info ? ', ' + escapeHtml(p.info) : ''}</div>` : ''}
            </div>
        </div>`).join('\n');
    return `<div class="gallery-grid ${gridClass}">${items}</div>`;
}

function injectRiddleCardIntoBody(bodyHtml, cardHtml) {
    if (!cardHtml) return bodyHtml;
    if (!bodyHtml) return cardHtml;
    // Find positions just after each </p>, then pick a random one in the middle 30-70%
    const closings = [];
    const re = /<\/p>/gi;
    let m;
    while ((m = re.exec(bodyHtml)) !== null) {
        closings.push(m.index + m[0].length);
    }
    if (closings.length < 4) return bodyHtml + cardHtml;
    const minIdx = Math.max(1, Math.floor(closings.length * 0.3));
    const maxIdx = Math.min(closings.length - 2, Math.floor(closings.length * 0.7));
    const range = Math.max(1, maxIdx - minIdx + 1);
    const idx = minIdx + Math.floor(Math.random() * range);
    const insertAt = closings[idx];
    return bodyHtml.slice(0, insertAt) + cardHtml + bodyHtml.slice(insertAt);
}

function buildArticleSection(article, index, issue, magazineName, isLast) {
    const template = article.template || 'feature-opening';
    let bodyHtml = article.bodyHtml || '';
    const pageNum = index + 2;
    const endMark = isLast ? '<span class="end-mark"></span>' : '';

    // Insert pull quote
    if (article.pullQuotes && article.pullQuotes.length > 0 && !bodyHtml.includes('pull-quote')) {
        const pq = `<blockquote class="pull-quote">"${escapeHtml(article.pullQuotes[0])}"</blockquote>`;
        const paras = bodyHtml.split('</p>');
        if (paras.length > 2) { paras.splice(2, 0, pq); bodyHtml = paras.join('</p>'); }
    }

    // Inject riddle card mid-body (text articles only — gallery handles its own)
    if (article._riddleCard && template !== 'gallery') {
        bodyHtml = injectRiddleCardIntoBody(bodyHtml, article._riddleCard);
    }

    const authorLabel = article.authorDisplay || article.author || '';
    const header = buildPageHeader(pageNum, magazineName, article.category || '', authorLabel);
    const footer = buildPageFooter(magazineName, issue.date, '');
    const riddleCard = (template === 'gallery') ? (article._riddleCard || '') : '';

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
        <span class="genre-tag">சிறுகதை</span>
        <h1>${escapeHtml(article.title)}</h1>
        ${authorLabel ? `<p class="byline">${escapeHtml(authorLabel)}</p>` : ''}
    </header>
    <div class="story-body">${bodyHtml} ${endMark}</div>
    ${footer}
</article>`;

        case 'poetry':
            return `
<article class="poetry-page">
    ${header}
    <header class="poetry-header">
        <span class="genre-tag">கவிதை</span>
        <h1>${escapeHtml(article.title)}</h1>
    </header>
    <div class="poem"><div class="poem-body">${bodyHtml}</div>
    ${authorLabel ? `<div class="poet-credit">— ${escapeHtml(authorLabel)}</div>` : ''}</div>
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
    ${buildGalleryGrid(article)}
    ${riddleCard}
    ${footer}
</article>`;

        default: // feature-opening, feature-continuation
            // If this is a riddle-only snippet (no title), just render the card
            if (article._isRiddleOnly) {
                return `<div>${bodyHtml || riddleCard}</div>`;
            }
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
    <div class="article-body">${bodyHtml} ${endMark}</div>
    ${riddleCard}
    ${footer}
</article>`;
    }
}

function buildBackCover(issue, magazineName) {
    if (issue.backCoverImage) {
        return `
<div class="back-cover">
    <img class="cover-bg" src="${escapeHtml(issue.backCoverImage)}" alt="">
    <div class="cover-overlay" style="opacity:0.3"></div>
    <div class="back-bottom" style="position:relative;z-index:2">
        <div class="issue-id">${escapeHtml(issue.id || '')} &middot; ${escapeHtml(issue.date || '')}</div>
        <div class="credits">${escapeHtml(magazineName)}</div>
    </div>
</div>`;
    }
    return `
<div class="back-cover">
    <div class="back-top">
        <div class="back-magazine-name">${escapeHtml(magazineName)}</div>
        <div class="back-gold-line"></div>
        <div class="next-issue">
            <h2>\u0B85\u0B9F\u0BC1\u0BA4\u0BCD\u0BA4 \u0B87\u0BA4\u0BB4\u0BBF\u0BB2\u0BCD</h2>
            <p class="teaser">\u0BAE\u0BC7\u0BB2\u0BC1\u0BAE\u0BCD \u0B9A\u0BBF\u0BB1\u0BA8\u0BCD\u0BA4 \u0B95\u0B9F\u0BCD\u0B9F\u0BC1\u0BB0\u0BC8\u0B95\u0BB3\u0BCD \u0BB5\u0BB0\u0BB5\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BBF\u0BA9\u0BCD\u0BB1\u0BA9</p>
        </div>
    </div>
    <div class="back-bottom">
        <div class="issue-id">${escapeHtml(issue.id || '')} &middot; ${escapeHtml(issue.date || '')}</div>
        <div class="credits">${escapeHtml(magazineName)}</div>
    </div>
</div>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { composeIssue };
