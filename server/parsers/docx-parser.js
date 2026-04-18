/**
 * .docx Parser — Uses Mammoth.js to convert .docx to semantic HTML,
 * then extracts structured article data.
 */
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

/**
 * Parse a .docx file into structured article JSON
 * @param {string} docxPath - Path to the .docx file
 * @param {string} outputDir - Directory to save extracted images
 * @returns {Promise<object>} Structured article data
 */
async function parseDocx(docxPath, outputDir) {
    // Ensure output dir for images
    const imagesDir = path.join(outputDir, 'images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    let imageIndex = 0;

    // Convert .docx to HTML with Mammoth
    const result = await mammoth.convertToHtml(
        { path: docxPath },
        {
            convertImage: mammoth.images.imgElement(async function (image) {
                imageIndex++;
                const ext = image.contentType === 'image/png' ? 'png' : 'jpg';
                const filename = `image-${imageIndex}.${ext}`;
                const imagePath = path.join(imagesDir, filename);

                // Read image buffer and save
                const buffer = await image.read();

                // Optimize with Sharp
                try {
                    if (ext === 'png') {
                        await sharp(buffer).png({ quality: 90 }).toFile(imagePath);
                    } else {
                        await sharp(buffer).jpeg({ quality: 85 }).toFile(imagePath);
                    }
                } catch (e) {
                    // Fallback: save raw buffer
                    fs.writeFileSync(imagePath, buffer);
                }

                return { src: `images/${filename}` };
            }),
        }
    );

    const html = result.value;
    const messages = result.messages;

    // Parse the HTML into structured data
    const article = extractStructure(html);
    article.sourceFile = path.basename(docxPath);
    article.parseMessages = messages;
    article.imageCount = imageIndex;

    // Save parsed JSON
    const jsonPath = path.join(outputDir, 'parsed.json');
    fs.writeFileSync(jsonPath, JSON.stringify(article, null, 2));

    return article;
}

/**
 * Extract structured data from Mammoth's HTML output
 */
function extractStructure(html) {
    const article = {
        title: '',
        subtitle: '',
        author: '',
        category: '',
        bodyHtml: '',
        pullQuotes: [],
        subheadings: [],
        images: [],
        wordCount: 0,
    };

    // Split HTML into elements by tags
    const lines = html.split(/(<\/?(?:h[1-6]|p|blockquote|img|figure|figcaption)[^>]*>)/);

    let currentTag = '';
    let bodyParts = [];
    let inBody = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Track opening tags
        if (line.match(/^<h1[^>]*>/)) { currentTag = 'h1'; continue; }
        if (line.match(/^<h2[^>]*>/)) { currentTag = 'h2'; continue; }
        if (line.match(/^<h3[^>]*>/)) { currentTag = 'h3'; continue; }
        if (line.match(/^<h4[^>]*>/)) { currentTag = 'h4'; continue; }
        if (line.match(/^<p[^>]*>/)) { currentTag = 'p'; continue; }
        if (line.match(/^<blockquote[^>]*>/)) { currentTag = 'blockquote'; continue; }

        // Skip closing tags
        if (line.match(/^<\//)) { currentTag = ''; continue; }

        // Extract content based on current tag
        const text = stripHtml(line);

        if (currentTag === 'h1' && !article.title) {
            article.title = text;
        } else if (currentTag === 'h2' && !article.subtitle) {
            article.subtitle = text;
        } else if (currentTag === 'h3') {
            if (text.match(/^(Byline:|By\s)/i)) {
                article.author = text.replace(/^(Byline:|By)\s*/i, '').trim();
            } else if (text.match(/^Category:/i)) {
                article.category = text.replace(/^Category:\s*/i, '').trim();
            } else {
                inBody = true;
                bodyParts.push(`<h3>${text}</h3>`);
            }
        } else if (currentTag === 'h4') {
            inBody = true;
            article.subheadings.push(text);
            bodyParts.push(`<h4>${text}</h4>`);
        } else if (currentTag === 'p' || currentTag === 'blockquote') {
            inBody = true;

            // Check for pull quotes (starts with >, is italic blockquote, or contains quote marks in italic)
            const isQuote = text.startsWith('>') || currentTag === 'blockquote' ||
                (line.includes('<em>') && (text.startsWith('>') || text.match(/^[""\u201C]/) || text.includes('>')));
            if (isQuote) {
                const quoteText = text.replace(/^>\s*/, '').replace(/^[""\u201C]|[""\u201D]$/g, '').trim();
                article.pullQuotes.push(quoteText);
                bodyParts.push(`<blockquote class="pull-quote">${quoteText}</blockquote>`);
            } else if (line.includes('<img')) {
                // Image paragraph
                const imgMatch = line.match(/src="([^"]+)"/);
                if (imgMatch) {
                    article.images.push(imgMatch[1]);
                    bodyParts.push(`<figure><img src="${imgMatch[1]}" alt=""><figcaption></figcaption></figure>`);
                }
            } else if (text) {
                bodyParts.push(`<p>${line}</p>`);
            }
        }
    }

    article.bodyHtml = bodyParts.join('\n');
    article.wordCount = stripHtml(article.bodyHtml).split(/\s+/).filter(Boolean).length;

    // Auto-suggest template based on content
    article.suggestedTemplate = suggestTemplate(article);

    return article;
}

/**
 * Suggest a template based on article content
 */
function suggestTemplate(article) {
    const cat = (article.category || '').toLowerCase();
    if (cat.includes('poetry') || cat.includes('கவிதை')) return 'poetry';
    if (cat.includes('interview') || cat.includes('நேர்காணல்')) return 'interview';
    if (cat.includes('fiction') || cat.includes('story') || cat.includes('கதை')) return 'short-story';
    if (cat.includes('editorial') || cat.includes('opinion') || cat.includes('கருத்து')) return 'editorial';
    if (cat.includes('photo')) return 'photo-essay';
    if (article.images.length > 3) return 'photo-essay';
    if (article.wordCount < 100) return 'poetry';
    return 'feature-opening';
}

function stripHtml(html) {
    return html.replace(/<[^>]+>/g, '').trim();
}

module.exports = { parseDocx };
