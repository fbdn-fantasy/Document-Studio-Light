"""Build deterministic real input files for manual and automated acceptance."""
from pathlib import Path
import json,sys
from reportlab.pdfgen import canvas
from reportlab.lib.pdfencrypt import StandardEncryption
from PIL import Image,ImageDraw,ImageFont
root=Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
c=canvas.Canvas(str(root/'digital.pdf'),pagesize=(612,792))
c.setFont('Helvetica-Bold',20);c.setFillColorRGB(.2,.1,.5);c.drawString(60,730,'Document Studio integration')
c.setFont('Times-Roman',12);c.setFillColorRGB(0,0,0);c.drawString(60,690,'Native selectable text stays editable.')
c.drawString(60,670,'The source PDF remains unchanged after import.')
c.setFillColorRGB(.1,.5,.3);c.rect(60,550,150,60,fill=1,stroke=0)
c.setFillColorRGB(0,0,0);c.setFont('Helvetica',11)
for x in (60,220,380):c.line(x,360,x,500)
for y in (360,405,450,500):c.line(60,y,380,y)
for x,y,t in [(70,475,'Quantity'),(230,475,'Value'),(70,425,'Length'),(230,425,'12 cm'),(70,380,'Mass'),(230,380,'2 kg')]:c.drawString(x,y,t)
c.showPage();c.setPageSize((792,612));c.setFont('Helvetica',14);c.drawString(40,560,'Second landscape page');c.drawString(40,530,'Left column');c.drawString(420,530,'Right column');c.save()
im=Image.new('RGB',(1500,2100),'white');d=ImageDraw.Draw(im);font=ImageFont.load_default(size=42);title=ImageFont.load_default(size=65)
d.text((130,120),'SCIENCE LESSON',font=title,fill='black');d.text((130,260),'The speed of light is constant.',font=font,fill='black');d.text((130,340),'Read each question carefully.',font=font,fill='black')
for x in [130,710,1320]:d.line((x,520,x,1000),fill='black',width=3)
for y in [520,640,760,880,1000]:d.line((130,y,1320,y),fill='black',width=3)
for x,y,t in [(160,560,'Material'),(750,560,'Mass'),(160,680,'Copper'),(750,680,'20 g'),(160,800,'Iron'),(750,800,'30 g'),(160,920,'Water'),(750,920,'50 g')]:d.text((x,y),t,font=font,fill='black')
d.text((130,1160),'Energy equation',font=font,fill='black');d.text((130,1270),'E = mc²',font=title,fill='black')
d.ellipse((180,1500,600,1920),outline='#174b7a',width=8);d.line((180,1710,600,1710),fill='#174b7a',width=5);d.text((760,1630),'Scientific illustration',font=font,fill='black')
im.save(root/'scan.png');im.save(root/'scan.webp');im.rotate(90,expand=True).save(root/'rotated.jpg');im.save(root/'multipage.tiff',save_all=True,append_images=[im.rotate(180)])
im.save(root/'scanned.pdf','PDF',resolution=180)
c=canvas.Canvas(str(root/'mixed.pdf'),pagesize=(612,792));c.setFont('Helvetica',18);c.drawString(50,730,'Digital first page');c.showPage();c.drawImage(str(root/'scan.png'),0,0,612,792);c.save()
c=canvas.Canvas(str(root/'encrypted.pdf'),encrypt=StandardEncryption('test'));c.drawString(50,700,'Locked');c.save();(root/'corrupt.pdf').write_bytes(b'%PDF-1.7 damaged')
print(root)
