"""
Fix PDF color transform issue caused by Puppeteer/Chrome.

Chrome embeds JPEG images in PDFs with /ColorTransform 0, which tells
decoders the JPEG uses raw RGB instead of standard YCbCr encoding.
Many viewers (including PDF.js) ignore this flag, causing pinkish tint.

This script re-encodes affected images to use standard YCbCr JPEG encoding
and removes the /ColorTransform 0 flag.
"""
import sys
import pymupdf

def fix_pdf_colors(input_path, output_path=None):
    if output_path is None:
        output_path = input_path

    doc = pymupdf.open(input_path)
    fixed = 0

    for page_num in range(len(doc)):
        page = doc[page_num]
        images = page.get_images(full=True)

        for img_info in images:
            xref = img_info[0]
            obj_str = doc.xref_object(xref)

            # Check if this image has /ColorTransform 0
            if '/ColorTransform 0' not in obj_str:
                continue

            # Extract the image
            img_data = doc.extract_image(xref)
            if img_data['colorspace'] != 3:  # Only fix RGB images
                continue

            # Render the page region to get correct colors, then re-embed
            # Simpler approach: extract as pixmap and re-encode as proper JPEG
            pix = pymupdf.Pixmap(doc, xref)
            if pix.alpha:
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)  # drop alpha

            # Re-encode as standard JPEG (with proper YCbCr transform)
            jpeg_data = pix.tobytes("jpeg", jpg_quality=95)

            # Replace the image in the PDF
            doc.xref_set_key(xref, "ColorTransform", "1")

            # Replace the stream with properly encoded JPEG
            page.replace_image(xref, stream=jpeg_data)

            fixed += 1
            print(f"  Fixed image on page {page_num + 1} (xref {xref})")

    if fixed > 0:
        doc.save(output_path, garbage=4, deflate=True)
        print(f"Fixed {fixed} image(s), saved to {output_path}")
    else:
        print("No images needed fixing")
        if output_path != input_path:
            doc.save(output_path)

    doc.close()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"Usage: python3 {sys.argv[0]} <input.pdf> [output.pdf]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file
    fix_pdf_colors(input_file, output_file)
