from pathlib import Path
import sys
from docx import Document
from openpyxl import Workbook
from pptx import Presentation
root=Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
d=Document();d.add_heading('Qingye Office Test',0);d.add_paragraph('Word document conversion 123');d.save(root/'sample.docx')
w=Workbook();s=w.active;s.append(['Item','Amount']);s.append(['Qingye',123]);w.save(root/'sample.xlsx')
p=Presentation();slide=p.slides.add_slide(p.slide_layouts[0]);slide.shapes.title.text='Qingye Presentation';slide.placeholders[1].text='PowerPoint conversion 123';p.save(root/'sample.pptx')
