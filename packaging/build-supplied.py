"""Build editable text and separate artwork from the supplied PDFs (PyMuPDF)."""
from pathlib import Path
import fitz,json,re,html,base64
root=Path(__file__).resolve().parents[1]
catalog=[]
for source in sorted((root/'references/Documents Templates').glob('*.pdf')):
    doc=fitz.open(source); pages=[]; previews=[]
    for page in doc:
        previews.append('data:image/png;base64,'+base64.b64encode(page.get_pixmap(matrix=fitz.Matrix(.45,.45)).tobytes()).decode())
        lines=[]; slots=[]; pictures=[]
        blocks=page.get_text('dict')['blocks']
        for block in blocks:
            if block['type']==1:
                pictures.append(fitz.Rect(block['bbox']))
        for block in blocks:
            for line in block.get('lines',[]):
                spans=line['spans']
                for s in spans:
                    font=s['font']; size=s['size']; x,y=s['origin']
                    family='Times New Roman' if 'Times' in font else 'Courier New' if 'Courier' in font else 'SuppliedSans'
                    style=f'font:{("italic " if s["flags"]&2 else "")}{("bold " if s["flags"]&16 else "")}{size:.3f}pt/1 {family};color:#{s["color"]:06x}'
                    text=s['text']; top=y-size*.85
                    lines.append((top,x,size,style,text))
                    if text in ('PHOTO','{{PHOTO}}','{{FEATURED IMAGE}}','{{EVENT IMAGE}}','{{LARGE IMAGE}}'):
                        label=fitz.Rect(s['bbox'])
                        if text=='PHOTO':
                            r=next(r for r in pictures if r.contains(label))
                            half=r.width*.365; cx=(r.x0+r.x1)/2;cy=(r.y0+r.y1)/2
                            slots.append((fitz.Rect(cx-half,cy-half,cx+half,cy+half),'round'))
                        else:
                            r=min((d['rect'] for d in page.get_drawings() if d['rect'].contains(label)),key=lambda r:r.get_area())
                            slots.append((r+(2,2,-2,-2),'rect'))
        page.add_redact_annot(page.rect,fill=False);page.apply_redactions(images=0,graphics=0,text=0)
        def image_data(rect=None):
            return 'data:image/png;base64,'+base64.b64encode(page.get_pixmap(matrix=fitz.Matrix(1.6,1.6),clip=rect).tobytes()).decode()
        def bounds(r):
            return f'left:{100*r.x0/page.rect.width:.5f}%;top:{r.y0:.3f}pt;width:{100*r.width/page.rect.width:.5f}%;height:{r.height:.3f}pt;'
        pieces=[f'<img class="supplied-piece" style="{bounds(r)}" alt="Supplied illustration" src="{image_data(r)}">' for r in pictures]
        if pictures:
            page.add_redact_annot(page.rect,fill=False);page.apply_redactions(images=1,graphics=0,text=0)
        art=f'<img class="supplied-art" style="height:{page.rect.height}pt" alt="Page artwork" src="{image_data()}">'
        controls=[]
        for r,shape in slots:
            controls.append(f'<span class="photo-slot {shape}" tabindex="0" role="button" aria-label="Add or replace photo" title="Add or replace photo" style="{bounds(r)}"></span>')
        body=['<div class="supplied-anchor">'+art+''.join(pieces+controls)+'</div>']
        last=0;rows=[]
        for item in sorted(lines,key=lambda item:(item[0],item[1])):
            if not rows or abs(rows[-1][0][0]-item[0])>.65:rows.append([])
            rows[-1].append(item)
        for row in rows:
            row.sort(key=lambda item:item[1]);top=min(item[0] for item in row)
            body.append(f'<div class="supplied-row" style="margin-top:{top-last:.3f}pt">')
            for j,(_,x,size,style,text) in enumerate(row):
                right=row[j+1][1] if j+1<len(row) else page.rect.width
                width=max(1,(right-x)/page.rect.width*100)
                body.append(f'<span class="supplied-copy" style="{style};margin-left:{100*x/page.rect.width:.5f}%;width:{width:.5f}%">{html.escape(text)}</span>')
            body.append('</div>');last=top+max(item[2] for item in row)
        pages.append(''.join(body))
    name=re.sub(r'(?<=[a-z])(?=[A-Z])',' ',source.stem.replace('_',' '))
    category='Notices' if name.startswith('Notice') else 'Résumés' if 'Resume' in name else 'Letters' if 'Letter' in name else 'Editorial' if name.split()[0] in ('Press','Blog','Newsletter') else 'Cards'
    catalog.append(dict(id='supplied-'+source.stem,name=name,category=category,language='en',previews=previews,html='<div class="page-break"></div>'.join(pages),project=dict(margin=0,hf=False,extra=dict(width=page.rect.width*4/3,height=page.rect.height*4/3,margin=0))))
(root/'pro-supplied.js').write_text('window.FTEProTemplates='+json.dumps(catalog,separators=(',',':'))+';')
