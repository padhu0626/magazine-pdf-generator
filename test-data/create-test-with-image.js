/**
 * Creates a sample .docx with embedded image for testing
 */
const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = require('docx');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function createTestDocx() {
    // Create a simple test image (colored rectangle with text)
    const svgImage = `<svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="500" fill="#1a1a2e"/>
        <rect x="20" y="20" width="760" height="460" fill="#16213e" rx="10"/>
        <text x="400" y="230" text-anchor="middle" font-family="sans-serif" font-size="40" fill="#c9a961" font-weight="bold">Sample Image</text>
        <text x="400" y="280" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#fff" opacity="0.7">Test photo for magazine layout</text>
        <circle cx="400" cy="380" r="30" fill="#c62828" opacity="0.8"/>
    </svg>`;

    const imageBuffer = await sharp(Buffer.from(svgImage)).png().toBuffer();

    // Create a small "passport" photo
    const passportSvg = `<svg width="200" height="250" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="250" fill="#f5e9da"/>
        <circle cx="100" cy="100" r="50" fill="#c9a961"/>
        <circle cx="85" cy="90" r="5" fill="#1a1a2e"/>
        <circle cx="115" cy="90" r="5" fill="#1a1a2e"/>
        <path d="M 85 115 Q 100 130 115 115" stroke="#1a1a2e" fill="none" stroke-width="2"/>
        <rect x="60" y="160" width="80" height="60" fill="#1a1a2e" rx="5"/>
        <text x="100" y="240" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#666">Author Photo</text>
    </svg>`;

    const passportBuffer = await sharp(Buffer.from(passportSvg)).png().toBuffer();

    // Save images separately too
    fs.writeFileSync(path.join(__dirname, 'sample-banner.png'), imageBuffer);
    fs.writeFileSync(path.join(__dirname, 'sample-portrait.png'), passportBuffer);

    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    children: [new TextRun({ text: 'செயற்கை நுண்ணறிவும் தமிழும்', bold: true })],
                }),
                new Paragraph({
                    heading: HeadingLevel.HEADING_2,
                    children: [new TextRun('AI தொழில்நுட்பம் தமிழ் மொழிக்கு எவ்வாறு உதவுகிறது')],
                }),
                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    children: [new TextRun('Byline: டாக்டர் கணேஷ்')],
                }),
                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    children: [new TextRun('Category: Technology')],
                }),

                // Banner image
                new Paragraph({
                    children: [
                        new ImageRun({
                            data: imageBuffer,
                            transformation: { width: 600, height: 375 },
                            type: 'png',
                        }),
                    ],
                }),
                new Paragraph({
                    children: [new TextRun({ text: 'Caption: செயற்கை நுண்ணறிவு ஆய்வகம் — நவீன தொழில்நுட்ப மையம்', italics: true })],
                }),

                new Paragraph({
                    children: [new TextRun('செயற்கை நுண்ணறிவு இன்று உலகின் மிக முக்கியமான தொழில்நுட்பமாக வளர்ந்துள்ளது. தமிழ் மொழிக்கான AI கருவிகள் கடந்த ஐந்து ஆண்டுகளில் குறிப்பிடத்தக்க முன்னேற்றம் கண்டுள்ளன. குரல் அடையாளம், மொழிபெயர்ப்பு, உரை-தொகுப்பு ஆகிய துறைகளில் தமிழ் மொழி இன்று வலுவான நிலையில் உள்ளது.')],
                }),
                new Paragraph({
                    children: [new TextRun('Google, Microsoft, Meta போன்ற பெரிய நிறுவனங்கள் தமிழ் மொழிக்கான AI மாதிரிகளை உருவாக்கி வருகின்றன. Google Translate இன் தமிழ் மொழிபெயர்ப்புத் தரம் கடந்த இரண்டு ஆண்டுகளில் கணிசமாக மேம்பட்டுள்ளது. இது இயந்திர கற்றல் மற்றும் நரம்பு வலைப்பின்னல் தொழில்நுட்பங்களின் வளர்ச்சியால் சாத்தியமாகியுள்ளது.')],
                }),

                new Paragraph({
                    children: [new TextRun({ text: '> "தமிழ் மொழியின் வளமான இலக்கிய மரபு, AI கருவிகளுக்கு ஒரு பெரிய வாய்ப்பாக உள்ளது — ஆயிரக்கணக்கான ஆண்டுகள் பழைய இலக்கியங்களை டிஜிட்டல் மயமாக்கும் பணி நடைபெற்று வருகிறது."', italics: true })],
                }),

                new Paragraph({
                    children: [new TextRun('தமிழ்நாடு அரசு AI கொள்கையை அறிவித்துள்ளது. இக்கொள்கையின் ஒரு முக்கிய அம்சம் தமிழ் மொழியில் AI கருவிகள் உருவாக்குவதை ஊக்குவிப்பதாகும். IIT மெட்ராஸ், அண்ணா பல்கலைக்கழகம் போன்ற நிறுவனங்கள் தமிழ் NLP ஆராய்ச்சியில் முன்னணியில் உள்ளன.')],
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_4,
                    children: [new TextRun('எதிர்கால திசைகள்')],
                }),

                new Paragraph({
                    children: [new TextRun('தமிழ் மொழிக்கான பேச்சு அங்கீகார தொழில்நுட்பம் வேகமாக வளர்ந்து வருகிறது. Siri, Alexa, Google Assistant ஆகியவை தமிழில் செயல்பட தொடங்கியுள்ளன. இன்னும் சில ஆண்டுகளில் தமிழில் முழுமையாக செயல்படும் AI உதவியாளர்கள் வரும் என்று எதிர்பார்க்கப்படுகிறது.')],
                }),

                new Paragraph({
                    children: [new TextRun('கல்வித் துறையிலும் AI பெரும் தாக்கத்தை ஏற்படுத்தும். தமிழ் வழிக் கல்விக்கான AI கருவிகள், தானியங்கி மதிப்பீடு, தனிப்பயனாக்கப்பட்ட கற்றல் அனுபவங்கள் போன்றவை விரைவில் வரும். இது தமிழ் வழிக் கல்வியின் தரத்தை கணிசமாக உயர்த்தும்.')],
                }),
            ],
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join(__dirname, 'sample-with-image.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Created: ${outputPath}`);
    console.log(`Banner image: ${path.join(__dirname, 'sample-banner.png')}`);
    console.log(`Portrait image: ${path.join(__dirname, 'sample-portrait.png')}`);
}

createTestDocx().catch(console.error);
