from pathlib import Path
from docx import Document
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

root = Path(r'C:\Users\Dell Precision\Desktop\App Build\Borderless\deliverables')
(root / 'doc').mkdir(exist_ok=True)
(root / 'pdf').mkdir(exist_ok=True)

for md in sorted(root.glob('*.md')):
    base = md.stem
    doc_path = root / 'doc' / f'{base}.docx'
    pdf_path = root / 'pdf' / f'{base}.pdf'

    doc = Document()
    for line in md.read_text(encoding='utf-8').splitlines():
        if line.startswith('# '):
            doc.add_heading(line[2:], level=1)
        elif line.startswith('## '):
            doc.add_heading(line[3:], level=2)
        elif line.startswith('### '):
            doc.add_heading(line[4:], level=3)
        else:
            doc.add_paragraph(line)
    doc.save(doc_path)

    styles = getSampleStyleSheet()
    story = []
    for line in md.read_text(encoding='utf-8').splitlines():
        if line.startswith('# '):
            story.append(Paragraph(line[2:], styles['Title']))
        elif line.startswith('## '):
            story.append(Paragraph(line[3:], styles['Heading2']))
        elif line.startswith('### '):
            story.append(Paragraph(line[4:], styles['Heading3']))
        else:
            story.append(Paragraph(line, styles['BodyText']))
        story.append(Spacer(1, 6))
    doc_pdf = SimpleDocTemplate(str(pdf_path), pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    doc_pdf.build(story)

print('EXPORT_DONE')
