/**
 * Image upload routes — handles separate image uploads for articles
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads/images');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + '-' + Math.random().toString(36).substring(2, 8) + ext);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files accepted'));
    },
    limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * POST /api/images/upload — Upload an image, returns URL path
 */
router.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    try {
        const originalPath = req.file.path;
        const buffer = fs.readFileSync(originalPath);
        const meta = await sharp(buffer).metadata();

        // Always write to a new filename to avoid input===output error
        const outputName = Date.now() + '-opt.jpg';
        const outputPath = path.join(path.dirname(originalPath), outputName);

        let pipeline = sharp(buffer);
        if (meta.width > 2000) pipeline = pipeline.resize(2000);
        await pipeline.jpeg({ quality: 85 }).toFile(outputPath);

        // Remove original
        fs.unlinkSync(originalPath);

        const url = '/uploads/images/' + outputName;

        res.json({
            success: true,
            url: url,
            width: Math.min(meta.width, 2000),
            height: meta.height,
            filename: optimizedName,
        });
    } catch (err) {
        res.status(500).json({ error: 'Image processing failed: ' + err.message });
    }
});

module.exports = router;
