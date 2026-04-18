/**
 * Magazine PDF Generator — Express Server
 */
const express = require('express');
const path = require('path');

const uploadRoutes = require('./routes/upload');
const renderRoutes = require('./routes/render');
const issueRoutes = require('./routes/issues');
const publishRoutes = require('./routes/publish');
const imageRoutes = require('./routes/images');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON/form parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/client', express.static(path.join(__dirname, '../client')));
app.use('/templates', express.static(path.join(__dirname, '../templates')));
app.use('/brand', express.static(path.join(__dirname, '../brand')));
app.use('/output', express.static(path.join(__dirname, '../output')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api/upload', uploadRoutes);
app.use('/api/render', renderRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/publish', publishRoutes);
app.use('/api/images', imageRoutes);

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Issue assembly page
app.get('/issue', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/issue.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

app.listen(PORT, () => {
    console.log(`\n  Magazine PDF Generator running at http://localhost:${PORT}\n`);
});
