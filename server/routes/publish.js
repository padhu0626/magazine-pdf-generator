/**
 * Publish route — Exports magazine PDF to flip-book viewer format
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { renderToPdf } = require('../pdf/render-with-pagedjs');

const router = express.Router();

/**
 * POST /api/publish — Publish current issue to flip-book viewer folder structure
 * Body: { pdfPath, flipbookDir }
 */
router.post('/', async (req, res) => {
    const { pdfPath, flipbookDir } = req.body;

    if (!pdfPath) {
        return res.status(400).json({ error: 'No PDF path provided' });
    }

    // Default flip-book viewer location (sibling directory)
    const viewerBase = flipbookDir || path.resolve(__dirname, '../../../tamil-magazine');
    const issueJsonPath = path.join(viewerBase, 'issues', 'issues.json');

    try {
        // Load current issue data
        const issueDataPath = path.join(__dirname, '../../issues/current-issue.json');
        if (!fs.existsSync(issueDataPath)) {
            return res.status(400).json({ error: 'No current issue found' });
        }
        const issue = JSON.parse(fs.readFileSync(issueDataPath, 'utf-8'));

        const issueId = issue.id || '2026-01';
        const issueDir = path.join(viewerBase, 'issues', issueId);

        // Create issue directory
        if (!fs.existsSync(issueDir)) {
            fs.mkdirSync(issueDir, { recursive: true });
        }

        // Copy PDF
        const sourcePdf = path.join(__dirname, '../..', pdfPath.replace(/^\//, ''));
        const destPdf = path.join(issueDir, 'magazine.pdf');
        fs.copyFileSync(sourcePdf, destPdf);

        // Generate cover thumbnail from first page (placeholder for now)
        const coverPath = path.join(issueDir, 'cover.jpg');
        await generateCoverThumbnail(sourcePdf, coverPath);

        // Write metadata.json
        const metadata = {
            id: issueId,
            title: issue.title || 'தமிழ் இதழ்',
            published_date: new Date().toISOString().split('T')[0],
            editor: 'ஆசிரியர்',
            articles: issue.articles.map(a => ({
                title: a.title,
                author: a.author || '',
                category: a.category || '',
            })),
            contributors: [...new Set(issue.articles.map(a => a.author).filter(Boolean))],
            theme_color: '#1a1a2e',
        };
        fs.writeFileSync(path.join(issueDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

        // Update issues.json if flip-book viewer exists
        if (fs.existsSync(path.join(viewerBase, 'issues'))) {
            updateIssuesJson(issueJsonPath, issue, issueId);
        }

        res.json({
            success: true,
            message: `Published to ${issueDir}`,
            issueDir,
            files: ['magazine.pdf', 'cover.jpg', 'metadata.json'],
        });
    } catch (err) {
        console.error('Publish error:', err);
        res.status(500).json({ error: 'Failed to publish: ' + err.message });
    }
});

async function generateCoverThumbnail(pdfPath, outputPath) {
    // Simple placeholder cover — in production, use pdf-to-image conversion
    // For now, create a branded placeholder
    const svg = `<svg width="400" height="560" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="560" fill="#1a1a2e"/>
        <text x="200" y="250" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#fff" font-weight="bold">தமிழ் இதழ்</text>
        <text x="200" y="290" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#c9a961">Magazine Cover</text>
    </svg>`;

    await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(outputPath);
}

function updateIssuesJson(jsonPath, issue, issueId) {
    let data = { magazine_name: 'தமிழ் இதழ்', issues: [] };

    if (fs.existsSync(jsonPath)) {
        data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }

    // Remove existing entry for this issue ID
    data.issues = data.issues.filter(i => i.id !== issueId);

    // Add new entry
    data.issues.unshift({
        id: issueId,
        issue_number: data.issues.length + 1,
        title: issue.title || 'தமிழ் இதழ்',
        published_date: new Date().toISOString().split('T')[0],
        cover_image: `issues/${issueId}/cover.jpg`,
        pdf_path: `issues/${issueId}/magazine.pdf`,
        metadata_path: `issues/${issueId}/metadata.json`,
        page_count: (issue.articles || []).length + 3,
        featured: true,
    });

    // Un-feature old issues
    for (let i = 1; i < data.issues.length; i++) {
        data.issues[i].featured = false;
    }

    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
}

module.exports = router;
