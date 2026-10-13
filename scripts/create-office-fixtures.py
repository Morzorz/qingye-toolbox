from pathlib import Path
import sys
from docx import Document
from openpyxl import Workbook
from pptx import Presentation
root=Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
d=Document();d.add_heading('Qingye Office Test',0);d.add_paragraph('Word document conversion 123');
from docx.oxml.ns import qn
for font in ['宋体','微软雅黑','仿宋','黑体','QingyeMissingFont']:
    run=d.add_paragraph().add_run('中文转换测试：合同金额人民币，审批意见。'+font)
    run.font.name=font
    run._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),font)
d.save(root/'sample.docx')
w=Workbook();s=w.active;s.append(['Item','Amount']);s.append(['Qingye',123]);s.append(['中文转换测试','合同金额人民币']);s.column_dimensions['A'].width=26;s.column_dimensions['B'].width=30;w.save(root/'sample.xlsx')
p=Presentation();slide=p.slides.add_slide(p.slide_layouts[0]);slide.shapes.title.text='Qingye Presentation';slide.placeholders[1].text='PowerPoint conversion 123\n中文转换测试：审批意见';p.save(root/'sample.pptx')
