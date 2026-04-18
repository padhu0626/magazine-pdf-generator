/**
 * Creates a sample .docx file following the contributor format spec
 */
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const fs = require('fs');
const path = require('path');

async function createTestDocx() {
    const doc = new Document({
        sections: [{
            children: [
                // Title (H1)
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    children: [new TextRun({ text: 'தமிழ் மொழியின் தொன்மையும் எதிர்காலமும்', bold: true })],
                }),

                // Subtitle (H2)
                new Paragraph({
                    heading: HeadingLevel.HEADING_2,
                    children: [new TextRun('உலகின் மிகப் பழமையான மொழிகளில் ஒன்றான தமிழின் வரலாறும் நவீன வளர்ச்சியும்')],
                }),

                // Byline (H3)
                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    children: [new TextRun('Byline: முனைவர் கலைச்செல்வி')],
                }),

                // Category (H3)
                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    children: [new TextRun('Category: Culture')],
                }),

                // Body paragraphs
                new Paragraph({
                    children: [new TextRun('தமிழ் மொழி உலகின் மிகத் தொன்மையான மொழிகளில் ஒன்றாகும். இரண்டாயிரம் ஆண்டுகளுக்கும் மேலான இலக்கிய வரலாற்றைக் கொண்ட இம்மொழி, சங்க காலம் தொடங்கி இன்று வரை தொடர்ச்சியான வளர்ச்சியைக் கண்டுள்ளது. தொல்காப்பியம், சிலப்பதிகாரம், திருக்குறள் போன்ற அழியாத இலக்கியங்கள் தமிழின் பெருமையை உலகுக்கு எடுத்துரைக்கின்றன.')],
                }),

                new Paragraph({
                    children: [new TextRun('இன்றைய நவீன உலகில் தமிழ் மொழி புதிய சவால்களை எதிர்கொண்டாலும், தொழில்நுட்ப வளர்ச்சியோடு இணைந்து முன்னேறி வருகிறது. செயற்கை நுண்ணறிவு, கணினி மொழியியல், இயந்திர மொழிபெயர்ப்பு ஆகிய துறைகளில் தமிழ் மொழிக்கான பணிகள் தீவிரமாக நடைபெற்று வருகின்றன.')],
                }),

                // Pull quote (blockquote style - using italic as signal)
                new Paragraph({
                    children: [new TextRun({
                        text: '> "தமிழ் மொழி என்பது வெறும் தகவல் பரிமாற்றக் கருவி அல்ல — அது ஒரு பண்பாட்டின் உயிர்நாடி, ஒரு நாகரிகத்தின் அடையாளம்."',
                        italics: true,
                    })],
                }),

                new Paragraph({
                    children: [new TextRun('சங்க இலக்கியங்கள் தமிழ் மொழியின் மிகப் பழமையான இலக்கிய வடிவங்களாகும். கி.மு. மூன்றாம் நூற்றாண்டு முதல் கி.பி. மூன்றாம் நூற்றாண்டு வரையிலான காலகட்டத்தில் இயற்றப்பட்ட இப்பாடல்கள், அக்கால மக்களின் வாழ்வியல், பண்பாடு, அரசியல், போர்முறை ஆகியவற்றை அழகான கவிதை வடிவில் பதிவு செய்துள்ளன.')],
                }),

                // Subheading (H4)
                new Paragraph({
                    heading: HeadingLevel.HEADING_4,
                    children: [new TextRun('நவீன கால வளர்ச்சி')],
                }),

                new Paragraph({
                    children: [new TextRun('பத்தொன்பதாம் நூற்றாண்டில் அச்சு இயந்திரத்தின் வருகையோடு தமிழ் மொழி புதிய பரிமாணத்தை எய்தியது. செய்தித்தாள்கள், இதழ்கள், நாவல்கள் ஆகியவை மக்களிடையே படிப்பறிவை வளர்த்தன. பாரதியார், பாரதிதாசன் போன்ற கவிஞர்கள் தமிழ் மொழியை நவீன உலகுக்கு ஏற்ற வகையில் புதுப்பித்தனர்.')],
                }),

                new Paragraph({
                    children: [new TextRun('இருபதாம் நூற்றாண்டில் திரைப்படத் துறையின் வளர்ச்சி தமிழ் மொழியின் பரவலை மேலும் அதிகரித்தது. பேச்சு மொழிக்கும் எழுத்து மொழிக்கும் இடையிலான இடைவெளி குறைந்தது. கல்கி, சுஜாதா, ஜெயகாந்தன் போன்ற எழுத்தாளர்கள் தமிழ் புனைவு இலக்கியத்தை சர்வதேச தரத்துக்கு உயர்த்தினர்.')],
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_4,
                    children: [new TextRun('எதிர்காலம்')],
                }),

                new Paragraph({
                    children: [new TextRun('செயற்கை நுண்ணறிவு யுகத்தில் தமிழ் மொழிக்கான வாய்ப்புகள் மிகப் பெரியவை. இயற்கை மொழி செயலாக்கம், குரல் உதவியாளர்கள், தானியங்கி மொழிபெயர்ப்பு ஆகிய துறைகளில் தமிழ் மொழிக்கான கருவிகள் உருவாக்கப்பட்டு வருகின்றன.')],
                }),
            ],
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join(__dirname, 'sample-article.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Created: ${outputPath}`);
}

createTestDocx().catch(console.error);
