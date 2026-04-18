/**
 * Upload routes — handles .docx file uploads and parsing
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseDocx } = require('../parsers/docx-parser');

const router = express.Router();

// Configure multer for .docx uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.originalname.endsWith('.docx')) {
            cb(null, true);
        } else {
            cb(new Error('Only .docx files are accepted'));
        }
    },
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
});

/**
 * POST /api/upload — Upload and parse a .docx file
 */
router.post('/', upload.single('docx'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No .docx file uploaded' });
    }

    try {
        const docxPath = req.file.path;
        const articleId = path.basename(req.file.filename, '.docx');
        const outputDir = path.join(__dirname, '../../uploads', articleId);

        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const article = await parseDocx(docxPath, outputDir);
        article.id = articleId;

        res.json({
            success: true,
            article,
        });
    } catch (err) {
        console.error('Parse error:', err);
        res.status(500).json({ error: 'Failed to parse .docx: ' + err.message });
    }
});

module.exports = router;
