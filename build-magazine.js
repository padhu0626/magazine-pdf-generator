#!/usr/bin/env node
/**
 * Build Magazine PDF -- Processes content from "Uploads Teachers" and
 * "Uploads Students" folders and generates the full magazine PDF.
 *
 * Layout: interleaved -- article, couple of art, poem, article, art, story...
 * No TOC page. Riddle questions early, answers on last page before back cover.
 *
 * Usage: node build-magazine.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { parseDocx } = require('./server/parsers/docx-parser');
const { composeIssue } = require('./server/layout/compose-issue');
const { renderToPdf } = require('./server/pdf/render-with-pagedjs');

const PROJECT_ROOT = __dirname;
const TEACHERS_DIR = path.join(PROJECT_ROOT, 'Uploads Teachers');
const STUDENTS_DIR = path.join(PROJECT_ROOT, 'Uploads Students');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');
const IMAGES_DIR = path.join(UPLOADS_DIR, 'magazine-images');

[UPLOADS_DIR, OUTPUT_DIR, IMAGES_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// --- Filename parser ---

const KNOWN_TYPES = ['art', 'article', 'essay', 'poem', 'story', 'riddles', 'comic story'];

function parseFilename(filename) {
    const base = path.basename(filename, path.extname(filename));
    const parts = base.split(/\s*-\s*/).map(s => s.trim()).filter(Boolean);
    const result = { type: '', number: '', title: '', name: '', nilai: '', raw: base };
    if (parts.length === 0) return result;

    const nilaiIdx = parts.findIndex(p => /^நிலை/i.test(p) || /^nilai/i.test(p));
    if (nilaiIdx >= 0) { result.nilai = parts[nilaiIdx]; parts.splice(nilaiIdx, 1); }

    const firstLower = parts[0].toLowerCase();
    const hasType = KNOWN_TYPES.some(t => firstLower === t || firstLower.startsWith(t));

    if (hasType) {
        result.type = parts[0];
        const rest = parts.slice(1);
        if (rest.length > 0 && /^(page\s*)?\d+$/i.test(rest[0])) result.number = rest.shift();
        if (rest.length === 0) { /* nothing */ }
        else if (rest.length === 1) { result.name = rest[0]; }
        else { result.name = rest.pop(); result.title = rest.join(' -- '); }
    } else {
        result.type = 'Article';
        if (parts.length === 1) { result.title = parts[0]; }
        else { result.name = parts.pop(); result.title = parts.join(' -- '); }
    }
    return result;
}

// --- Image optimization ---

async function optimizeImage(srcPath, destName) {
    const safeName = destName.replace(/[^a-zA-Z0-9_\u0B80-\u0BFF-]/g, '_').substring(0, 80) + '-opt.jpg';
    const destPath = path.join(IMAGES_DIR, safeName);
    try {
        await sharp(srcPath)
            .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 88 })
            .toFile(destPath);
    } catch (err) {
        console.warn(`  [warn] Sharp failed for ${path.basename(srcPath)}: ${err.message}`);
        fs.copyFileSync(srcPath, destPath.replace('.jpg', path.extname(srcPath)));
    }
    return `/uploads/magazine-images/${safeName}`;
}

// --- Riddle parser ---

function parseRiddlesFromDocx(docxPath) {
    const mammoth = require('mammoth');
    return mammoth.convertToHtml({ path: docxPath }).then(result => {
        const html = result.value;
        const questions = [];
        const answers = [];
        const text = html.replace(/<\/?(p|ol|li|strong|em|a|br)[^>]*>/gi, '\n').replace(/<[^>]+>/g, '');
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let currentQ = '';
        let qNum = 0;
        let waitingForAnswer = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Skip title and trailing author/nilai lines
            if (line === '\u0BB5\u0BBF\u0B9F\u0BC1\u0B95\u0BA4\u0BC8\u0B95\u0BB3\u0BCD') continue;
            if (/^(\u0BB0\u0BBF\u0BA4\u0BBE|\u0BB0\u0BBF\u0BA4\u0BA9|\u0BA8\u0BBF\u0BB2\u0BC8)/.test(line) && qNum > 0) continue;

            // "பதில் :" line — answer may be on same line or next line
            const answerMatch = line.match(/^\u0BAA\u0BA4\u0BBF\u0BB2\u0BCD\s*:?\s*(.*)/);
            if (answerMatch) {
                const answerText = answerMatch[1].trim();
                if (answerText) {
                    // Answer on same line: "பதில் : முட்டை"
                    if (currentQ) {
                        qNum++;
                        questions.push({ num: qNum, question: currentQ.trim() });
                        answers.push({ num: qNum, answer: answerText });
                        currentQ = '';
                    }
                } else {
                    // Answer on next line
                    waitingForAnswer = true;
                }
                continue;
            }

            if (waitingForAnswer) {
                // This line is the answer
                if (currentQ) {
                    qNum++;
                    questions.push({ num: qNum, question: currentQ.trim() });
                    answers.push({ num: qNum, answer: line.trim() });
                    currentQ = '';
                }
                waitingForAnswer = false;
                continue;
            }

            // Otherwise it's part of the question
            if (currentQ) currentQ += ' ';
            currentQ += line;
        }
        return { questions, answers };
    });
}

// --- Collect and categorize files ---

function collectFiles() {
    const files = {
        teacherArticles: [], studentArticles: [], riddles: [],
        artImages: [], comicPages: [], artDocx: [],
    };
    const seenFiles = new Set();

    function scanFolder(dir, isTeacher) {
        if (!fs.existsSync(dir)) return;
        for (const f of fs.readdirSync(dir)) {
            if (f.startsWith('.') || f.startsWith('~')) continue;
            // Skip cover/back page images
            const fLower = f.toLowerCase();
            if (fLower.includes('coverpage') || fLower.includes('lastpage') || fLower.includes('backpage')) continue;
            const fullPath = path.join(dir, f);
            const ext = path.extname(f).toLowerCase();
            const info = parseFilename(f);
            info.path = fullPath;
            info.isTeacher = isTeacher;
            const key = `${info.type}|${info.name}|${info.number}`;
            if (seenFiles.has(key)) continue;
            seenFiles.add(key);
            const typeLower = info.type.toLowerCase();
            if (ext === '.docx') {
                if (typeLower === 'riddles') files.riddles.push(info);
                else if (typeLower === 'art') files.artDocx.push(info);
                else if (isTeacher) files.teacherArticles.push(info);
                else files.studentArticles.push(info);
            } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                if (typeLower.includes('comic')) files.comicPages.push(info);
                else files.artImages.push(info);
            }
        }
    }

    scanFolder(TEACHERS_DIR, true);
    scanFolder(STUDENTS_DIR, false);
    files.comicPages.sort((a, b) => {
        const na = parseInt(a.number.replace(/\D/g, '')) || 0;
        const nb = parseInt(b.number.replace(/\D/g, '')) || 0;
        return na - nb;
    });
    return files;
}

// --- Build article from docx ---

async function buildArticle(fileInfo, index) {
    const articleId = `article-${index}-${Date.now()}`;
    const outputDir = path.join(UPLOADS_DIR, articleId);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const article = await parseDocx(fileInfo.path, outputDir);
    article.id = articleId;

    // Detect inline poems and style them differently
    if (article.bodyHtml) {
        // 1. Padmanaban's poem: starts at "மந்தையிலேயொன்றாய்..." (NOT "எம்மொழி")
        //    "எம்மொழி! செம்மொழி!" is the article ending, poem comes after
        article.bodyHtml = article.bodyHtml.replace(
            /<p>["\u201C]?மந்தையிலே[\s\S]*?நெடுந்தமிழ்[^<]*<\/p>/gi,
            (match) => `<div class="inline-poem">${match}<p style="text-align:right; font-weight:bold;">\u2014 Padhu</p></div>`
        );

        // 2. Thirukural: "சுவை ஒளி..." (2 lines ending with குறள்: 27)
        article.bodyHtml = article.bodyHtml.replace(
            /(<p>சுவை ஒளி[^<]*<\/p>\s*<p>[^<]*குறள்[^<]*<\/p>)/gi,
            (match) => `<div class="inline-poem">${match}</div>`
        );

        // 3. Thirukural: "கண்டு கேட்டு..." (single <p> with <br>, ends with குறள்: 1101)
        article.bodyHtml = article.bodyHtml.replace(
            /(<p>கண்டு கேட்டு[^]*?குறள்[^<]*<\/p>)/gi,
            (match) => `<div class="inline-poem">${match}</div>`
        );

        // 4. General: consecutive short quoted lines
        article.bodyHtml = article.bodyHtml.replace(
            /(<p>"[^<]{5,60}<\/p>\s*){3,}/g,
            (match) => {
                if (match.includes('inline-poem')) return match;
                return `<div class="inline-poem">${match}</div>`;
            }
        );
    }

    if (!article.author || article.author === '') {
        article.author = fileInfo.name || '';
    }
    if (!article.title || article.title === '') {
        if (fileInfo.title) {
            article.title = fileInfo.title;
        } else {
            const boldMatch = (article.bodyHtml || '').match(/<strong>([^<]+)<\/strong>/);
            if (boldMatch) article.title = boldMatch[1].trim();
            else article.title = fileInfo.type || fileInfo.raw || '';
        }
    }

    if (fileInfo.nilai && fileInfo.name) {
        article.authorDisplay = `${fileInfo.name}, ${fileInfo.nilai}`;
    } else {
        article.authorDisplay = fileInfo.name || article.author;
    }

    const typeLower = (fileInfo.type || '').toLowerCase();
    if (typeLower === 'poem') article.template = 'poetry';
    else if (typeLower === 'story') article.template = 'short-story';
    else if (typeLower === 'essay' || typeLower === 'article') article.template = 'feature-opening';
    else article.template = article.suggestedTemplate || 'feature-opening';

    article.authorPhoto = '';
    article.heroImage = '';
    article.heroCaption = '';
    article.galleryPhotos = article.galleryPhotos || [];
    article.isTeacher = fileInfo.isTeacher;
    article.nilai = fileInfo.nilai || '';

    // If article has 0 words but has embedded images, convert to gallery
    if (article.wordCount === 0 && article.imageCount > 0) {
        article.template = 'gallery';
        const photos = [];

        // Try images array first
        for (const imgSrc of (article.images || [])) {
            const absPath = path.join(PROJECT_ROOT, imgSrc.replace(/^\//, ''));
            if (fs.existsSync(absPath)) {
                // Skip very small images (signatures, credits)
                const stat = fs.statSync(absPath);
                if (stat.size < 20000) {
                    console.log(`    Skipping small image (${(stat.size/1024).toFixed(0)}KB)`);
                    continue;
                }
                const src = await optimizeImage(absPath, `embedded-${articleId}-${photos.length}`);
                photos.push({ src, title: article.title || '', artist: fileInfo.name || '', info: fileInfo.nilai || '' });
            }
        }

        // Also check output dir for extracted images (mammoth saves them here)
        if (photos.length === 0) {
            const imgsDir = path.join(outputDir, 'images');
            if (fs.existsSync(imgsDir)) {
                const imgFiles = fs.readdirSync(imgsDir).sort();
                for (const imgFile of imgFiles) {
                    const imgPath = path.join(imgsDir, imgFile);
                    // Skip very small images (likely just signatures/credits)
                    const stat = fs.statSync(imgPath);
                    if (stat.size < 20000) {
                        console.log(`    Skipping small image (${(stat.size/1024).toFixed(0)}KB): ${imgFile}`);
                        continue;
                    }
                    const src = await optimizeImage(imgPath, `embedded-${articleId}-${photos.length}`);
                    photos.push({ src, title: article.title || '', artist: fileInfo.name || '', info: fileInfo.nilai || '' });
                }
            }
        }

        if (photos.length > 0) {
            article.galleryPhotos = photos;
            article.imageCount = photos.length;
            article.bodyHtml = '';
        }
    }

    return article;
}

// --- Helper: build riddle card HTML snippet ---

function buildRiddleCardHtml(card) {
    // Each color theme has a mascot + scatter of decorative emoji.
    const themes = [
        { mascot: '\uD83E\uDD89', scatter: ['\u2728', '\u2B50', '\uD83C\uDF1F'] },
        { mascot: '\uD83D\uDC38', scatter: ['\uD83C\uDF3F', '\uD83C\uDF40', '\u2B50'] },
        { mascot: '\uD83E\uDD8A', scatter: ['\u2601\uFE0F', '\u2728', '\uD83D\uDCAB'] },
        { mascot: '\uD83D\uDC30', scatter: ['\uD83C\uDF88', '\u2B50', '\u2728'] },
        { mascot: '\uD83E\uDDD9', scatter: ['\u2728', '\uD83C\uDF1F', '\uD83D\uDCAB'] },
    ];
    const theme = themes[(card.colorIdx - 1) % themes.length];
    const scatter = theme.scatter;

    let html = `<div class="riddle-card riddle-card-${card.colorIdx}">`;
    html += `<span class="riddle-deco-tl">${scatter[0]}</span>`;
    html += `<span class="riddle-deco-tr">${theme.mascot}</span>`;
    html += `<span class="riddle-deco-bl">${scatter[1]}</span>`;
    html += `<span class="riddle-deco-br">${scatter[2]}</span>`;
    html += `<div class="riddle-card-header">`;
    html += `<span class="riddle-card-title">\u0BB5\u0BBF\u0B9F\u0BC1\u0B95\u0BA4\u0BC8</span>`;
    html += `<span class="riddle-card-author">\u2014 ${card.author}</span>`;
    html += `</div>`;
    html += `<div class="riddle-card-question"><span class="riddle-q-num">${card.q1.num}</span><span class="riddle-q-text">${card.q1.question}</span></div>`;
    if (card.q2) {
        html += `<div class="riddle-card-question"><span class="riddle-q-num">${card.q2.num}</span><span class="riddle-q-text">${card.q2.question}</span></div>`;
    }
    html += `<div class="riddle-card-prompt">\uD83E\uDD14 \u0B9A\u0BBF\u0BA8\u0BCD\u0BA4\u0BBF\u0B95\u0BCD\u0B95\u0BB5\u0BC1\u0BAE\u0BCD!</div>`;
    html += `<div class="riddle-card-footer">\u0BB5\u0BBF\u0B9F\u0BC8\u0B95\u0BB3\u0BCD \u0B95\u0B9F\u0BC8\u0B9A\u0BBF \u0BAA\u0B95\u0BCD\u0B95\u0BAE\u0BCD</div>`;
    html += `</div>`;
    return html;
}

// --- Helper: make a gallery section from art items ---

function makeGallerySection(items, id) {
    return {
        id: id,
        title: '\u0BAE\u0BBE\u0BA3\u0BB5\u0BB0\u0BCD \u0B93\u0BB5\u0BBF\u0BAF\u0B99\u0BCD\u0B95\u0BB3\u0BCD',
        subtitle: '', author: '', authorDisplay: '',
        category: '\u0B93\u0BB5\u0BBF\u0BAF\u0BAE\u0BCD',
        bodyHtml: '', pullQuotes: [], subheadings: [], images: [],
        wordCount: 1, template: 'gallery', sourceFile: '',
        parseMessages: [], imageCount: items.length,
        authorPhoto: '', heroImage: '', heroCaption: '',
        galleryPhotos: items,
    };
}

// --- Main ---

async function main() {
    console.log('\n== Sangamam Magazine PDF Builder ==\n');

    const files = collectFiles();
    console.log('Content found:');
    console.log(`  Teacher articles : ${files.teacherArticles.length}`);
    console.log(`  Student articles : ${files.studentArticles.length}`);
    console.log(`  Riddles          : ${files.riddles.length}`);
    console.log(`  Art images       : ${files.artImages.length}`);
    console.log(`  Art docx         : ${files.artDocx.length}`);
    console.log(`  Comic pages      : ${files.comicPages.length}`);
    console.log('');

    let articleIdx = 0;

    // -- Parse all text content --
    const parsedTeacher = [];
    const parsedStudent = [];
    const parsedRiddles = [];
    let riddlesAnswersArticle = null;
    const artItems = [];
    let comicArticle = null;

    console.log('-- Parsing Teacher Articles --');
    for (const f of files.teacherArticles) {
        try {
            const a = await buildArticle(f, articleIdx++);
            parsedTeacher.push(a);
            console.log(`  OK: "${a.title}"`);
        } catch (err) { console.error(`  FAIL: ${err.message}`); }
    }

    console.log('\n-- Parsing Student Content --');
    for (const f of files.studentArticles) {
        try {
            const a = await buildArticle(f, articleIdx++);
            parsedStudent.push(a);
            console.log(`  OK: "${a.title}" [${a.template}]`);
        } catch (err) { console.error(`  FAIL: ${err.message}`); }
    }

    // Riddle cards: stored as pairs of questions to scatter between articles
    const riddleCards = [];   // [{num1, q1, num2, q2, author, colorIdx}]
    if (files.riddles.length > 0) {
        console.log('\n-- Parsing Riddles --');
        for (const f of files.riddles) {
            try {
                const { questions, answers } = await parseRiddlesFromDocx(f.path);
                const authorLabel = f.name + (f.nilai ? `, ${f.nilai}` : '');
                console.log(`  OK: ${questions.length} riddles by ${f.name}`);

                // Group into pairs of 2
                for (let qi = 0; qi < questions.length; qi += 2) {
                    const card = {
                        q1: questions[qi],
                        q2: questions[qi + 1] || null,
                        author: authorLabel,
                        colorIdx: (riddleCards.length % 5) + 1,
                    };
                    riddleCards.push(card);
                }
                console.log(`  Created ${riddleCards.length} riddle cards`);

                // Answers page at the end
                const aHtml = answers.map(a =>
                    `<span class="answer-item"><strong>${a.num}.</strong> ${a.answer}</span>`
                ).join(' | ');

                riddlesAnswersArticle = {
                    id: `riddle-answers-${Date.now()}`,
                    title: '\u0BB5\u0BBF\u0B9F\u0BC1\u0B95\u0BA4\u0BC8 \u0BB5\u0BBF\u0B9F\u0BC8\u0B95\u0BB3\u0BCD',
                    subtitle: '', author: '', authorDisplay: '', category: '',
                    bodyHtml: `<p class="answers-intro">\u0BB5\u0BBF\u0B9F\u0BC1\u0B95\u0BA4\u0BC8\u0B95\u0BB3\u0BC1\u0B95\u0BCD\u0B95\u0BBE\u0BA9 \u0BB5\u0BBF\u0B9F\u0BC8\u0B95\u0BB3\u0BCD:</p><p class="answers-list">${aHtml}</p>`,
                    pullQuotes: [], subheadings: [], images: [],
                    wordCount: answers.length * 2, template: 'feature-opening',
                    sourceFile: '', parseMessages: [], imageCount: 0,
                    authorPhoto: '', heroImage: '', heroCaption: '', galleryPhotos: [],
                };
            } catch (err) { console.error(`  FAIL: ${err.message}`); }
        }
    }

    // Comic Story
    if (files.comicPages.length > 0) {
        console.log('\n-- Comic Story --');
        const comicPhotos = [];
        const comicAuthor = files.comicPages[0].name || '';
        const comicNilai = files.comicPages[0].nilai || '';
        for (const cp of files.comicPages) {
            const src = await optimizeImage(cp.path, `comic-${cp.number || comicPhotos.length}`);
            comicPhotos.push({
                src,
                title: `\u0BAA\u0B95\u0BCD\u0B95\u0BAE\u0BCD ${cp.number.replace(/\D/g, '') || comicPhotos.length + 1}`,
                artist: cp.name || comicAuthor,
                info: cp.nilai || comicNilai,
            });
            console.log(`  OK: Comic page ${cp.number || comicPhotos.length}`);
        }
        comicArticle = {
            id: `comic-${Date.now()}`,
            title: '\u0B9A\u0BBF\u0BA4\u0BCD\u0BA4\u0BBF\u0BB0\u0B95\u0BCD \u0B95\u0BA4\u0BC8',
            subtitle: '', author: comicAuthor,
            authorDisplay: comicAuthor + (comicNilai ? `, ${comicNilai}` : ''),
            category: '\u0B9A\u0BBF\u0BA4\u0BCD\u0BA4\u0BBF\u0BB0\u0B95\u0BCD \u0B95\u0BA4\u0BC8',
            bodyHtml: '', pullQuotes: [], subheadings: [], images: [],
            wordCount: 5, template: 'gallery', sourceFile: '',
            parseMessages: [], imageCount: comicPhotos.length,
            authorPhoto: '', heroImage: '', heroCaption: '',
            galleryPhotos: comicPhotos, nilai: comicNilai,
        };
    }

    // Art images
    if (files.artImages.length > 0 || files.artDocx.length > 0) {
        console.log('\n-- Processing Artwork --');
        const seenArt = new Set();
        for (const img of files.artImages) {
            const label = img.name || img.title || 'Unknown';
            const key = `${label}|${img.number}`;
            if (seenArt.has(key)) continue;
            seenArt.add(key);
            const src = await optimizeImage(img.path, `art-${label.replace(/\s+/g, '_')}-${img.number || artItems.length}`);
            const isFullPage = (img.title || '').toLowerCase() === 'full';
            artItems.push({ src, title: isFullPage ? '' : (img.title || ''), artist: img.name || '', info: img.nilai || '', fullPage: isFullPage });
            console.log(`  OK: ${img.name}`);
        }
        for (const ad of files.artDocx) {
            try {
                const artId = `art-docx-${articleIdx++}-${Date.now()}`;
                const outputDir = path.join(UPLOADS_DIR, artId);
                if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
                const artArticle = await parseDocx(ad.path, outputDir);
                const sources = artArticle.images && artArticle.images.length > 0
                    ? artArticle.images.map(s => path.join(PROJECT_ROOT, s.replace(/^\//, '')))
                    : (artArticle.imageCount > 0 && fs.existsSync(path.join(outputDir, 'images')))
                        ? fs.readdirSync(path.join(outputDir, 'images')).map(f => path.join(outputDir, 'images', f))
                        : [];
                for (const absPath of sources) {
                    if (fs.existsSync(absPath)) {
                        const src = await optimizeImage(absPath, `art-${ad.name.replace(/\s+/g, '_')}`);
                        artItems.push({ src, title: ad.title || '', artist: ad.name || '', info: ad.nilai || '' });
                        console.log(`  OK: ${ad.name} (from docx)`);
                    }
                }
            } catch (err) { console.error(`  FAIL art docx: ${err.message}`); }
        }
        console.log(`  Total: ${artItems.length} artworks`);
    }

    // ============================================================
    // INTERLEAVE LAYOUT
    // Order: first article -> riddles (page 2-3) -> article + art + article + art ...
    // Riddle answers and comic at the very end before back cover.
    // "தமிழ் தொன்மையும் பன்மையும்" (Sangeetha) goes first.
    // ============================================================
    console.log('\n-- Interleaving magazine layout --');

    // Sort teacher articles: Sangeetha's article first
    parsedTeacher.sort((a, b) => {
        const aIsSangeetha = a.title.includes('\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD') ? 0 : 1;
        const bIsSangeetha = b.title.includes('\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD') ? 0 : 1;
        return aIsSangeetha - bIsSangeetha;
    });

    const articles = [];

    // 1. First teacher article
    if (parsedTeacher.length > 0) {
        articles.push(parsedTeacher[0]);
        console.log(`  ${articles.length}. [article] ${parsedTeacher[0].title}`);
    }

    // 2. All remaining text content — interleaved with art and riddle cards
    const remainingText = [...parsedTeacher.slice(1), ...parsedStudent];

    const fullPageArt = artItems.filter(a => a.fullPage);
    const regularArt = artItems.filter(a => !a.fullPage);

    let regIdx = 0;

    // Spread riddle cards evenly across only text-template articles.
    const textIndices = remainingText
        .map((a, i) => (a.template === 'gallery' ? -1 : i))
        .filter(i => i >= 0);
    const riddleHostIdx = new Set();
    if (riddleCards.length > 0 && textIndices.length > 0) {
        const numCards = Math.min(riddleCards.length, textIndices.length);
        for (let k = 0; k < numCards; k++) {
            const slot = Math.floor((k + 0.5) * textIndices.length / numCards);
            riddleHostIdx.add(textIndices[slot]);
        }
    }

    let hostCount = 0;
    for (let i = 0; i < remainingText.length; i++) {
        // Inject a riddle card mid-article (random paragraph) if this article is a host
        if (riddleHostIdx.has(i) && hostCount < riddleCards.length) {
            const card = riddleCards[hostCount++];
            remainingText[i]._riddleCard = buildRiddleCardHtml(card);
        }

        // Add text article
        articles.push(remainingText[i]);
        console.log(`  ${articles.length}. [${remainingText[i].template}] ${remainingText[i].title}${remainingText[i]._riddleCard ? ' + riddle card' : ''}`);

        // After each text article, insert 2-3 regular art pieces
        const artCount = (i % 2 === 0) ? 2 : 3;
        const batch = regularArt.slice(regIdx, regIdx + artCount);
        if (batch.length > 0) {
            regIdx += batch.length;
            articles.push(makeGallerySection(batch, `art-spread-${i}-${Date.now()}`));
            console.log(`  ${articles.length}. [gallery] ${batch.length} artworks`);
        }
    }
    // Track index of next remaining card
    let riddleIdx = hostCount;

    // Any remaining riddle cards — attach to remaining content
    while (riddleIdx < riddleCards.length) {
        const card = riddleCards[riddleIdx++];
        // Create a mini section just for the riddle card
        articles.push({
            id: `riddle-snippet-${riddleIdx}`,
            title: '', subtitle: '', author: '', authorDisplay: '', category: '',
            bodyHtml: buildRiddleCardHtml(card),
            pullQuotes: [], subheadings: [], images: [],
            wordCount: 10, template: 'feature-opening', sourceFile: '',
            parseMessages: [], imageCount: 0,
            authorPhoto: '', heroImage: '', heroCaption: '', galleryPhotos: [],
            _isRiddleOnly: true,
        });
        console.log(`  ${articles.length}. [riddle card] #${riddleIdx}`);
    }

    // Full-page art
    for (const fp of fullPageArt) {
        articles.push(makeGallerySection([fp], `art-full-${Date.now()}`));
        console.log(`  ${articles.length}. [full-page] ${fp.artist}`);
    }

    // Remaining regular art
    if (regIdx < regularArt.length) {
        const remaining = regularArt.slice(regIdx);
        articles.push(makeGallerySection(remaining, `art-remaining-${Date.now()}`));
        console.log(`  ${articles.length}. [gallery] ${remaining.length} remaining artworks`);
    }

    // Comic story near the end
    if (comicArticle) {
        articles.push(comicArticle);
        console.log(`  ${articles.length}. [comic] Comic Story`);
    }

    // Riddle answers -- very last before back cover
    if (riddlesAnswersArticle) {
        articles.push(riddlesAnswersArticle);
        console.log(`  ${articles.length}. [answers] Riddle Answers`);
    }

    console.log(`\n== Total: ${articles.length} sections ==\n`);

    // -- Build issue JSON --
    const issue = {
        id: '2026-01',
        title: '',
        magazineName: 'சங்கமச் சுவடுகள்',
        coverImage: '',
        date: 'ஏப்ரல் 2026',
        tagline: '',
        articles,
        createdAt: new Date().toISOString(),
    };

    // Check for cover image in project root and upload folders
    const coverCandidates = [
        'cover.jpg', 'cover.png', 'cover.jpeg', 'coverpage.jpg', 'coverpage.png',
        'Uploads Students/coverpage.png', 'Uploads Students/coverpage.jpg',
        'Uploads Teachers/coverpage.png', 'Uploads Teachers/coverpage.jpg',
    ];
    for (const c of coverCandidates) {
        const cp = path.join(PROJECT_ROOT, c);
        if (fs.existsSync(cp)) {
            const src = await optimizeImage(cp, 'cover-image');
            issue.coverImage = src;
            console.log(`Cover image: ${c}`);
            break;
        }
    }
    if (!issue.coverImage) {
        const firstHero = articles.find(a => a.heroImage);
        if (firstHero) issue.coverImage = firstHero.heroImage;
    }

    // Check for back cover / last page image
    const backCandidates = [
        'lastpage.jpg', 'lastpage.png', 'back.jpg', 'back.png',
        'Uploads Students/lastpage.png', 'Uploads Students/lastpage.jpg',
        'Uploads Teachers/lastpage.png', 'Uploads Teachers/lastpage.jpg',
    ];
    for (const c of backCandidates) {
        const cp = path.join(PROJECT_ROOT, c);
        if (fs.existsSync(cp)) {
            const src = await optimizeImage(cp, 'backcover-image');
            issue.backCoverImage = src;
            console.log(`Back cover image: ${c}`);
            break;
        }
    }

    const issueJsonPath = path.join(PROJECT_ROOT, 'issues', 'current-issue.json');
    fs.writeFileSync(issueJsonPath, JSON.stringify(issue, null, 2));
    console.log(`Saved issue JSON`);

    // -- Compose HTML --
    console.log('Composing magazine HTML...');
    const html = composeIssue(issue, articles);
    const tempDir = path.join(OUTPUT_DIR, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tempHtml = path.join(tempDir, `magazine-build-${Date.now()}.html`);
    fs.writeFileSync(tempHtml, html);

    // -- Render PDF --
    console.log('Rendering PDF (this may take a minute)...');
    const pdfName = `sangamam-${issue.id}-${Date.now()}.pdf`;
    const outputPdf = path.join(OUTPUT_DIR, pdfName);

    try {
        await renderToPdf(tempHtml, outputPdf);
        const fileSize = (fs.statSync(outputPdf).size / (1024 * 1024)).toFixed(1);
        console.log(`\nMagazine PDF generated!`);
        console.log(`  ${outputPdf}`);
        console.log(`  ${fileSize} MB | ${articles.length} sections + cover + back cover\n`);
    } catch (err) {
        console.error(`\nPDF rendering failed: ${err.message}`);
        console.log(`  HTML preview at: ${tempHtml}\n`);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
