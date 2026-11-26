"""Offline digital PDF and image import worker. Status and results use JSONL."""
from __future__ import annotations
import argparse, base64, contextlib, ctypes, hashlib, html, io, json, math, os, re, sys, traceback, zipfile
from pathlib import Path
from statistics import median

MAX_BYTES = 256 * 1024 * 1024
MAX_PAGES = 300
MAX_PIXELS = 32_000_000
MAX_CHARS = 300_000
MAX_OUTPUT_BYTES = 512 * 1024 * 1024
_JOB_HANDLE = None

def constrain_worker():
    global _JOB_HANDLE
    import socket
    def offline(*args,**kwargs): raise OSError('Document Studio import is offline; network connections are disabled.')
    socket.socket.connect=offline;socket.socket.connect_ex=offline;socket.create_connection=offline
    if os.name!='nt': return
    from ctypes import wintypes as W
    class BASIC(ctypes.Structure):
        _fields_=[('PerProcessUserTimeLimit',ctypes.c_int64),('PerJobUserTimeLimit',ctypes.c_int64),('LimitFlags',W.DWORD),('MinimumWorkingSetSize',ctypes.c_size_t),('MaximumWorkingSetSize',ctypes.c_size_t),('ActiveProcessLimit',W.DWORD),('Affinity',ctypes.c_size_t),('PriorityClass',W.DWORD),('SchedulingClass',W.DWORD)]
    class IO(ctypes.Structure): _fields_=[(n,ctypes.c_uint64) for n in ('ReadOperationCount','WriteOperationCount','OtherOperationCount','ReadTransferCount','WriteTransferCount','OtherTransferCount')]
    class EXTENDED(ctypes.Structure):
        _fields_=[('BasicLimitInformation',BASIC),('IoInfo',IO),('ProcessMemoryLimit',ctypes.c_size_t),('JobMemoryLimit',ctypes.c_size_t),('PeakProcessMemoryUsed',ctypes.c_size_t),('PeakJobMemoryUsed',ctypes.c_size_t)]
    k=ctypes.WinDLL('kernel32',use_last_error=True)
    k.CreateJobObjectW.restype=W.HANDLE;k.CreateJobObjectW.argtypes=[ctypes.c_void_p,W.LPCWSTR]
    k.SetInformationJobObject.argtypes=[W.HANDLE,ctypes.c_int,ctypes.c_void_p,W.DWORD]
    k.AssignProcessToJobObject.argtypes=[W.HANDLE,W.HANDLE];k.GetCurrentProcess.restype=W.HANDLE
    handle=k.CreateJobObjectW(None,None);limits=EXTENDED()
    limits.BasicLimitInformation.LimitFlags=0x2000|0x100|0x8
    limits.BasicLimitInformation.ActiveProcessLimit=4;limits.ProcessMemoryLimit=6*1024**3
    if not handle or not k.SetInformationJobObject(handle,9,ctypes.byref(limits),ctypes.sizeof(limits)) or not k.AssignProcessToJobObject(handle,k.GetCurrentProcess()):
        raise OSError('Unable to establish the Windows import safety limits. Restart the application and try again.')
    _JOB_HANDLE=handle

def emit(kind, **values):
    print(json.dumps({'type': kind, **values}, ensure_ascii=False),file=sys.__stdout__,flush=True)

def progress(message, page=0, total=0, **extra):
    emit('progress', message=str(message), page=page, total=total, **extra)

def png_data(image):
    b = io.BytesIO(); image.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode('ascii')

def image_bytes(src):
    if not isinstance(src, str) or not re.match(r'^data:image/(png|jpeg);base64,', src):
        raise ValueError('Invalid embedded image')
    return base64.b64decode(src.split(',', 1)[1], validate=True)

def finite(value, default=0):
    try:
        n = float(value)
        return n if math.isfinite(n) else default
    except (TypeError, ValueError): return default

def clean_text(value):
    return ''.join(c for c in str(value or '') if c in '\n\t' or ord(c) >= 32).replace('\ufffd', '')

def safe_font(value):
    value = re.sub(r'^[A-Z]{6}\+', '', str(value or 'Arial'))
    return re.sub(r'[^\w ,.-]', '', value)[:100] or 'Arial'

def font_family(name):
    n = name.lower()
    if 'helvetica' in n: return 'Arial'
    if 'times' in n: return 'Times New Roman'
    if 'courier' in n: return 'Courier New'
    return safe_font(name)

def union(boxes):
    return [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]

def clamp_box(box, width, height):
    b = [finite(x) for x in box]
    return [max(0, min(width, b[0])), max(0, min(height, b[1])), max(0, min(width, b[2])), max(0, min(height, b[3]))]

def native_text(page):
    import pypdfium2 as pdfium
    raw = pdfium.raw
    width, height = page.get_size()
    textpage = page.get_textpage()
    count = textpage.count_chars()
    if count > MAX_CHARS: raise ValueError('A PDF page exceeds the safe text limit.')
    chars, lines, current = [], [], []
    def flush():
        nonlocal current
        if current and ''.join(c['text'] for c in current).strip(): lines.append(current)
        current = []
    def transformed(box):
        points = []
        for x, y in ((box[0], box[1]), (box[2], box[3]), (box[0], box[3]), (box[2], box[1])):
            dx, dy = ctypes.c_int(), ctypes.c_int()
            raw.FPDF_PageToDevice(page, 0, 0, round(width * 10), round(height * 10), 0, x, y, dx, dy)
            points.append((dx.value / 10, dy.value / 10))
        return [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)]
    for i in range(count):
        cp = raw.FPDFText_GetUnicode(textpage, i)
        if not cp or cp > 0x10FFFF: continue
        c = chr(cp)
        if c in '\r\n': flush(); continue
        if ord(c) < 32 and c != '\t': continue
        try: box = transformed(textpage.get_charbox(i))
        except Exception: continue
        size = max(2, min(250, finite(raw.FPDFText_GetFontSize(textpage, i), 12)))
        flags = ctypes.c_int(); length = raw.FPDFText_GetFontInfo(textpage, i, None, 0, flags)
        fontbuf = ctypes.create_string_buffer(max(1, min(length, 4096)))
        raw.FPDFText_GetFontInfo(textpage, i, fontbuf, len(fontbuf), flags)
        name = fontbuf.value.decode('utf8', 'replace')
        rgb = [ctypes.c_uint() for _ in range(4)]
        raw.FPDFText_GetFillColor(textpage, i, *rgb)
        color = ''.join(f'{v.value:02x}' for v in rgb[:3])
        obj = raw.FPDFText_GetTextObject(textpage, i)
        invisible = bool(obj and raw.FPDFTextObj_GetTextRenderMode(obj) == 3)
        item = {'text': c, 'bbox': box, 'font': font_family(name), 'fontSize': size,
                'bold': raw.FPDFText_GetFontWeight(textpage, i) >= 600 or 'bold' in name.lower(),
                'italic': bool(flags.value & 64) or any(x in name.lower() for x in ('italic', 'oblique')),
                'color': color, 'invisible': invisible}
        if current:
            prev = current[-1]
            if abs(box[3] - prev['bbox'][3]) > max(size, prev['fontSize']) * .65 or box[0] - prev['bbox'][2] > size * 4:
                flush()
        current.append(item); chars.append(item)
    flush()
    blocks = []
    for line in lines:
        runs = []
        for c in line:
            style = {k: c[k] for k in ('font', 'fontSize', 'bold', 'italic', 'color')}
            if runs and all(runs[-1][k] == v for k, v in style.items()): runs[-1]['text'] += c['text']
            else: runs.append({'text': c['text'], **style})
        box = union([c['bbox'] for c in line]); size = median(c['fontSize'] for c in line)
        # PDF tight glyph boxes exclude the font ascender: reconstruct a line box.
        box[1] -= size * .18; box[3] = max(box[3], box[1] + size * 1.15)
        # Tight glyph bounds omit right side-bearings; office line layout uses
        # advance widths. Reserve a small tolerance to avoid spurious line wraps.
        box[2] = min(width,box[2] + max(6,size*.35))
        blocks.append({'type':'text', 'text': ''.join(c['text'] for c in line), 'bbox':box,
                       'runs':runs, 'fontSize':size, 'confidence':1, 'source':'pdf-text'})
    textpage.close()
    return blocks, bool(chars and sum(c['invisible'] for c in chars) > len(chars) * .7)

def render_pdf_page(page, dpi=180):
    w, h = page.get_size()
    scale = min(dpi / 72, math.sqrt(MAX_PIXELS / max(1, w * h)))
    bitmap = page.render(scale=scale, rev_byteorder=True)
    image = bitmap.to_pil().convert('RGB'); bitmap.close()
    return image

def remove_text_background(page, blocks, invisible):
    import pypdfium2 as pdfium
    raw = pdfium.raw
    hidden = []
    for obj in page.get_objects(filter=[raw.FPDF_PAGEOBJ_TEXT]):
        mode = raw.FPDFTextObj_GetTextRenderMode(obj)
        if raw.FPDFTextObj_SetTextRenderMode(obj, 3): hidden.append((obj, mode))
    try:
        image = render_pdf_page(page)
    finally:
        for obj, mode in hidden: raw.FPDFTextObj_SetTextRenderMode(obj, mode)
    if invisible:
        # Searchable scans have visible pixels and invisible text. Use native text
        # for editable regions and clear the original ink there.
        image = erase_text(image, blocks, page.get_size())
    else:
        image = erase_text(image,[b for b in blocks if b.get('type')=='table'],page.get_size())
    return image

def erase_text(image, blocks, page_size=None):
    from PIL import ImageDraw
    result = image.copy(); draw = ImageDraw.Draw(result)
    sx, sy = (image.width / page_size[0], image.height / page_size[1]) if page_size else (1, 1)
    for b in blocks:
        if b.get('type') not in ('text', 'table', 'formula', 'image') or b.get('preserveVisual'): continue
        x0,y0,x1,y1 = b['bbox']; box = [int(x0*sx),int(y0*sy),int(x1*sx),int(y1*sy)]
        if b.get('type')=='table': box=[box[0]-3,box[1]-3,box[2]+3,box[3]+3]
        box = clamp_box(box, image.width-1, image.height-1)
        if box[2] <= box[0] or box[3] <= box[1]: continue
        # Sample the perimeter so colored stationery does not turn white.
        samples=[]
        for x in range(int(box[0]), int(box[2])+1, max(1,int((box[2]-box[0])/24))):
            for y in [max(0,int(box[1])-2), min(image.height-1,int(box[3])+2)]: samples.append(image.getpixel((x,y))[:3])
        color=tuple(int(median(p[i] for p in samples)) for i in range(3)) if samples else (255,255,255)
        draw.rectangle(box, fill=color)
    return result

def detect_ruled_tables(image, blocks, page_size):
    """Find connected horizontal and vertical rules around existing PDF text."""
    from PIL import Image
    scale = min(1, 1150 / max(image.size))
    gray = image.convert('L').resize((max(1, round(image.width*scale)), max(1, round(image.height*scale))))
    mask = gray.point(lambda value: 1 if value < 180 else 0)
    def line_runs(bitmap, minimum):
        pattern = re.compile(bytes([1]) + ('{%d,}' % minimum).encode('ascii'))
        raw = bitmap.tobytes()
        runs = []
        for row in range(bitmap.height):
            offset = row*bitmap.width
            for match in pattern.finditer(raw, offset, offset+bitmap.width):
                runs.append((row, match.start()-offset, match.end()-offset-1))
        return runs
    horizontal = line_runs(mask, max(18, mask.width//30))
    vertical = line_runs(mask.transpose(Image.Transpose.TRANSPOSE), max(14, mask.height//60))
    if not horizontal or not vertical or len(horizontal)*len(vertical)>2_000_000:
        return blocks
    neighbors = {}
    for hi,(y,left,right) in enumerate(horizontal):
        for vi,(x,top,bottom) in enumerate(vertical):
            if left-2<=x<=right+2 and top-2<=y<=bottom+2:
                # Horizontal IDs are positive, vertical IDs are negative.
                a,b=hi+1,-vi-1
                neighbors.setdefault(a,[]).append(b)
                neighbors.setdefault(b,[]).append(a)
    def positions(values):
        groups=[]
        for value in sorted(set(values)):
            if not groups or value-groups[-1][-1]>2:groups.append([value])
            else:groups[-1].append(value)
        return [round(median(group)) for group in groups]
    def has_line(lines, at, start, end):
        return any(abs(at-pos)<=2 and left<=start+3 and right>=end-3 for pos,left,right in lines)
    consumed=set(); tables=[]
    sx,sy=page_size[0]/mask.width,page_size[1]/mask.height
    while neighbors:
        pending=[next(iter(neighbors))]; hlines=[]; vlines=[]
        while pending:
            key=pending.pop()
            adjacent=neighbors.pop(key,None)
            if adjacent is None:continue
            pending.extend(adjacent)
            if key>0:hlines.append(horizontal[key-1])
            else:vlines.append(vertical[-key-1])
        xs=positions(x for x,_,_ in vlines)
        ys=positions(y for y,_,_ in hlines)
        if not 2<=len(xs)<=31 or not 3<=len(ys)<=101: continue
        cells=[]; used=[]; occupied=set()
        for r in range(len(ys)-1):
            for c in range(len(xs)-1):
                if (r,c) in occupied: continue
                # Missing internal edges identify merged cells.
                cs=1; rs=1
                while c+cs<len(xs)-1:
                    if has_line(vlines,xs[c+cs],ys[r],ys[r+1]): break
                    cs+=1
                while r+rs<len(ys)-1:
                    if has_line(hlines,ys[r+rs],xs[c],xs[c+cs]): break
                    rs+=1
                box=[xs[c]*sx,ys[r]*sy,xs[c+cs]*sx,ys[r+rs]*sy]
                matches=[]
                for i,b in enumerate(blocks):
                    bb=b['bbox']; cx=(bb[0]+bb[2])/2; cy=(bb[1]+bb[3])/2
                    if b['type']=='text' and i not in consumed and box[0]<=cx<=box[2] and box[1]<=cy<=box[3]: matches.append((i,b))
                text='\n'.join(b['text'] for _,b in sorted(matches,key=lambda ib:(ib[1]['bbox'][1],ib[1]['bbox'][0])))
                ordered=[b for _,b in sorted(matches,key=lambda ib:(ib[1]['bbox'][1],ib[1]['bbox'][0]))]
                runs=[]
                for li,line in enumerate(ordered):
                    if li:runs.append({'text':'\n','font':'Arial','fontSize':line.get('fontSize',11)})
                    runs.extend(line.get('runs',[{'text':line['text'],'fontSize':line.get('fontSize',11)}]))
                cells.append({'row':r,'col':c,'rowspan':rs,'colspan':cs,'text':text,'bbox':box,'runs':runs,
                              'paddingLeft':max(0,min(20,min((b['bbox'][0] for b in ordered),default=box[0]+2)-box[0]))})
                used.extend(i for i,_ in matches)
                occupied.update((rr,cc) for rr in range(r,r+rs) for cc in range(c,c+cs))
        if len(used)<2: continue
        consumed.update(used)
        tables.append({'type':'table','bbox':[xs[0]*sx,ys[0]*sy,xs[-1]*sx,ys[-1]*sy],
                       'cells':cells,'rows':len(ys)-1,'cols':len(xs)-1,'columnWidths':[(xs[i+1]-xs[i])*sx for i in range(len(xs)-1)],
                       'rowHeights':[(ys[i+1]-ys[i])*sy for i in range(len(ys)-1)],'confidence':1,'source':'pdf-grid'})
    return [b for i,b in enumerate(blocks) if i not in consumed]+tables

def page_art(image, width, height):
    from PIL import Image
    preview=image.copy()
    preview.thumbnail((900,900),Image.Resampling.LANCZOS)
    return {'width':width, 'height':height, 'blocks':[], 'background':png_data(image),
            'preview':png_data(preview), 'method':'image', 'warnings':[]}

def process_inputs(inputs, output):
    import pypdfium2 as pdfium
    from PIL import Image, ImageOps, ImageSequence
    Image.MAX_IMAGE_PIXELS=MAX_PIXELS
    pages=[]; sources=[]
    for file in inputs:
        path=Path(file).resolve(strict=True)
        if not path.is_file() or path.stat().st_size>MAX_BYTES: raise ValueError('Each source must be a regular file no larger than 256 MB.')
        ext=path.suffix.lower()
        if ext not in ('.pdf','.png','.jpg','.jpeg','.webp','.bmp','.tif','.tiff'): raise ValueError('Unsupported document format: '+ext)
        sources.append({'name':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size})
        if ext=='.pdf':
            try: pdf=pdfium.PdfDocument(str(path))
            except pdfium.PdfiumError as e: raise ValueError('Unable to open PDF. It may be damaged or password protected. Save an unlocked copy and try again.') from e
            try:
                if len(pages)+len(pdf)>MAX_PAGES: raise ValueError('Imports are limited to 300 pages. Split this document into smaller files.')
                for i in range(len(pdf)):
                    progress('Reading '+path.name,page=i+1,total=len(pdf),stage='pdf')
                    with contextlib.closing(pdf[i]) as page:
                        width,height=page.get_size()
                        if not 36<=width<=3750 or not 36<=height<=3750: raise ValueError('Unsupported or invalid PDF page dimensions.')
                        blocks,invisible=native_text(page)
                        source=render_pdf_page(page,200)
                        if any(b['text'].strip() for b in blocks):
                            blocks=detect_ruled_tables(source,blocks,(width,height))
                            bg=remove_text_background(page,blocks,invisible)
                            result={'width':width,'height':height,'blocks':blocks,'background':png_data(bg),
                                    'preview':png_data(source.resize((round(source.width*min(1,900/source.height)),min(900,source.height)))),'method':'pdf-text','warnings':[]}
                            if invisible: result['warnings'].append('This page contains a searchable scan. Native text was reused; its background was cleaned for editing.')
                        else:
                            result=page_art(source,width,height)
                        result.update(source=path.name,sourcePage=i+1); pages.append(result)
            finally: pdf.close()
        else:
            try:
                with Image.open(path) as image:
                    count=getattr(image,'n_frames',1)
                    if len(pages)+count>MAX_PAGES: raise ValueError('Imports are limited to 300 pages.')
                    for i,frame in enumerate(ImageSequence.Iterator(image)):
                        if frame.width*frame.height>MAX_PIXELS: raise ValueError('A source image exceeds 32 megapixels. Resize it before importing.')
                        progress('Reading '+path.name,page=i+1,total=count,stage='image')
                        source=ImageOps.exif_transpose(frame).convert('RGB')
                        dpi=frame.info.get('dpi') or image.info.get('dpi')
                        if not (isinstance(dpi,(tuple,list)) and len(dpi)>=2 and all(36<=finite(v)<=1200 for v in dpi[:2])):
                            dpi=(96,96)
                        width,height=source.width*72/float(dpi[0]),source.height*72/float(dpi[1])
                        shrink=min(1,1584/max(width,height))
                        result=page_art(source,max(36,width*shrink),max(36,height*shrink))
                        result.update(source=path.name,sourcePage=i+1); pages.append(result)
            except (OSError,Image.DecompressionBombError) as e: raise ValueError('The document image is damaged, too large, or unsupported.') from e
        if sum(len(p['background']) for p in pages)>MAX_OUTPUT_BYTES: raise ValueError('Converted image data exceeds the safe import limit. Import fewer pages together.')
    if not pages: raise ValueError('No pages found in the selected documents.')
    return pages,sources

def table_html(block):
    cells=block.get('cells',[]); rows=max((c['row']+c['rowspan'] for c in cells),default=0)
    cols=max((c['col']+c['colspan'] for c in cells),default=0)
    out=['<table style="border-collapse:collapse;table-layout:fixed;width:100%;height:100%;font:10pt Arial;color:#000;background:#fff">']
    if block.get('columnWidths'): out.append('<colgroup>'+''.join(f'<col style="width:{w:.3f}pt">' for w in block['columnWidths'])+'</colgroup>')
    for r in range(rows):
        rh=(block.get('rowHeights') or [])[r:r+1]
        out.append('<tr'+(f' style="height:{rh[0]:.3f}pt"' if rh else '')+'>')
        for c in sorted((c for c in cells if c['row']==r),key=lambda c:c['col']):
            content=html.escape(c['text']).replace('\n','<br>')
            if c.get('runs'):
                content=''.join('<span style="font-family:'+html.escape(safe_font(run.get('font','Arial')),quote=True)+';font-size:'+str(finite(run.get('fontSize'),10))+'pt;font-weight:'+('bold' if run.get('bold') else 'normal')+'">'+html.escape(clean_text(run.get('text',''))).replace('\n','<br>')+'</span>' for run in c['runs'])
            out.append(f'<td rowspan="{c["rowspan"]}" colspan="{c["colspan"]}" style="border:0.5pt solid #555;padding:0 0 0 {finite(c.get("paddingLeft"),2):.3f}pt;vertical-align:middle"><p style="margin:0">'+content+'</p></td>')
        out.append('</tr>')
    out.append('</table>'); return ''.join(out)

def project_for(pages, name):
    out=[]
    for pi,p in enumerate(pages):
        if pi: out.append('<div class="page-break" contenteditable="false"></div>')
        out.append(f'<div class="ds-import-page" data-ds-width="{p["width"]:.4f}" data-ds-height="{p["height"]:.4f}" style="width:{p["width"]:.4f}pt;height:{p["height"]:.4f}pt;background:#fff;color:#000">')
        out.append('<img class="ds-import-background" alt="Preserved page artwork" src="'+p['background']+'">')
        for bi,b in enumerate(p['blocks']):
            x,y,r,bot=b['bbox']; w=max(1,r-x); h=max(1,bot-y)
            style=f'left:{x:.4f}pt;top:{y:.4f}pt;width:{w:.4f}pt;min-height:{h:.4f}pt;'
            attrs=f'data-ds-type="{b["type"]}" data-ds-id="{pi}-{bi}" data-ds-confidence="{b.get("confidence",1):.4f}"'
            if b['type']=='text':
                out.append(f'<div class="ds-import-block ds-import-text" {attrs} style="{style}font-size:{b.get("fontSize",12):.3f}pt;line-height:1.15">')
                for run in b.get('runs',[{'text':b.get('text','')} ]):
                    font=html.escape(safe_font(run.get('font','Arial')),quote=True)
                    color=run.get('color','000000'); color=color if re.fullmatch('[0-9a-fA-F]{6}',color) else '000000'
                    out.append(f'<span style="font-family:{font};font-size:{finite(run.get("fontSize"),b.get("fontSize",12)):.3f}pt;color:#{color};font-weight:{"bold" if run.get("bold") else "normal"};font-style:{"italic" if run.get("italic") else "normal"}">'+html.escape(clean_text(run.get('text'))).replace('\n','<br>')+'</span>')
                out.append('</div>')
            elif b['type']=='table': out.append(f'<div class="ds-import-block" {attrs} style="{style}height:{h:.4f}pt">'+table_html(b)+'</div>')
            elif b['type'] in ('formula','image'):
                latex=html.escape(b.get('latex',''),quote=True); omml=html.escape(b.get('omml',''),quote=True)
                out.append(f'<div class="ds-import-block" {attrs} data-ds-latex="{latex}" data-ds-omml="{omml}" data-ds-math-size="{h*.95:.3f}" style="{style}"><img style="width:{w:.4f}pt;height:{h:.4f}pt;max-width:none" alt="'+html.escape('Equation: '+b.get('latex','') if b['type']=='formula' else 'Preserved illustration',quote=True)+'" src="'+b.get('image','')+'"></div>')
        out.append('</div>')
    return {'format':'ForbiddenStudio','version':2,'name':name,'html':''.join(out),'margin':0,'spacing':1.15,'hf':False,
            'extra':{'width':max(p['width'] for p in pages)*4/3,'height':max(p['height'] for p in pages)*4/3,'margin':0,
                     'importedDocument':{'version':1,'pages':len(pages),'sourceNames':list(dict.fromkeys(p['source'] for p in pages))}}}

def build_docx(pages,path,project):
    from docx import Document
    from docx.shared import Pt, RGBColor
    from docx.enum.section import WD_SECTION_START
    from docx.enum.table import WD_ROW_HEIGHT_RULE,WD_CELL_VERTICAL_ALIGNMENT
    from docx.oxml import OxmlElement, parse_xml
    from docx.oxml.ns import qn
    from lxml import etree as ET
    doc=Document(); doc.core_properties.title=project['name']; doc.core_properties.creator='Document Studio'
    normal=doc.styles['Normal']; normal.font.name='Arial'; normal.font.size=Pt(12)
    normal.paragraph_format.space_after=Pt(0); normal.paragraph_format.space_before=Pt(0)
    def node(tag,attrs):
        e=OxmlElement(tag)
        for k,v in attrs.items(): e.set(qn(k),str(v))
        return e
    def frame(p,b):
        x,y,r,bot=b
        p._p.get_or_add_pPr().append(node('w:framePr',{'w:w':round((r-x)*20),'w:h':round((bot-y)*20),'w:x':round(x*20),'w:y':round(y*20),'w:hAnchor':'page','w:vAnchor':'page','w:wrap':'notBeside','w:hRule':'atLeast'}))
        p.paragraph_format.line_spacing=1.0
    def floating_picture(p,src,x,y,w,h,behind=False):
        p.paragraph_format.line_spacing=Pt(1);p.paragraph_format.space_after=Pt(0)
        shape=p.add_run().add_picture(io.BytesIO(image_bytes(src)),width=Pt(w),height=Pt(h));inline=shape._inline
        anchor=ET.Element(qn('wp:anchor'),nsmap=inline.nsmap,attrib={'distT':'0','distB':'0','distL':'0','distR':'0','simplePos':'0','relativeHeight':'0' if behind else '1','behindDoc':'1' if behind else '0','locked':'0','layoutInCell':'1','allowOverlap':'1'})
        simple=ET.SubElement(anchor,qn('wp:simplePos'));simple.set('x','0');simple.set('y','0')
        for axis,value in (('H',x),('V',y)):
            pos=ET.SubElement(anchor,qn('wp:position'+axis));pos.set('relativeFrom','page');ET.SubElement(pos,qn('wp:posOffset')).text=str(round(value*12700))
        for child in list(inline):anchor.append(child)
        anchor.insert(4,ET.Element(qn('wp:wrapNone')));inline.getparent().replace(inline,anchor)
    for pi,page in enumerate(pages):
        section=doc.sections[0] if not pi else doc.add_section(WD_SECTION_START.NEW_PAGE)
        section.page_width=Pt(page['width']); section.page_height=Pt(page['height'])
        section.top_margin=section.bottom_margin=section.left_margin=section.right_margin=Pt(0)
        section.header_distance=section.footer_distance=Pt(0)
        # DrawingML floating background is a visual preservation layer for imported page artwork.
        floating_picture(doc.add_paragraph(),page['background'],0,0,page['width'],page['height'],behind=True)
        for b in sorted(page['blocks'],key=lambda b:(b['bbox'][1],b['bbox'][0])):
            if b['type']=='table':
                cells=b.get('cells',[]); nr=max(c['row']+c['rowspan'] for c in cells); nc=max(c['col']+c['colspan'] for c in cells)
                table=doc.add_table(rows=nr,cols=nc);table.autofit=False
                table._tbl.tblPr.append(node('w:tblpPr',{'w:horzAnchor':'page','w:vertAnchor':'page','w:tblpX':round(b['bbox'][0]*20),'w:tblpY':round(b['bbox'][1]*20),'w:leftFromText':0,'w:rightFromText':0,'w:topFromText':0,'w:bottomFromText':0}))
                widths=b.get('columnWidths') or [(b['bbox'][2]-b['bbox'][0])/nc]*nc
                for col,width in zip(table.columns,widths): col.width=Pt(width)
                for ri,row in enumerate(table.rows):
                    heights=b.get('rowHeights') or []
                    if ri<len(heights):row.height=Pt(heights[ri]);row.height_rule=WD_ROW_HEIGHT_RULE.AT_LEAST
                table._tbl.tblPr.append(node('w:tblInd',{'w:w':0,'w:type':'dxa'}))
                margins=node('w:tblCellMar',{})
                for side in ('top','left','bottom','right'):margins.append(node('w:'+side,{'w:w':0,'w:type':'dxa'}))
                table._tbl.tblPr.append(margins)
                borders=node('w:tblBorders',{})
                for side in ('top','left','bottom','right','insideH','insideV'): borders.append(node('w:'+side,{'w:val':'single','w:sz':4,'w:color':'555555'}))
                table._tbl.tblPr.append(borders)
                for c in cells:
                    cell=table.cell(c['row'],c['col'])
                    if c['rowspan']>1 or c['colspan']>1: cell=cell.merge(table.cell(c['row']+c['rowspan']-1,c['col']+c['colspan']-1))
                    cell.text=''
                    for run in c.get('runs',[{'text':c['text'],'fontSize':10}]):
                        r=cell.paragraphs[0].add_run(clean_text(run.get('text')));r.font.name=safe_font(run.get('font','Arial'));r.font.size=Pt(finite(run.get('fontSize'),10));r.bold=bool(run.get('bold'));r.italic=bool(run.get('italic'))
                    cell.paragraphs[0].paragraph_format.left_indent=Pt(finite(c.get('paddingLeft'),2))
                    cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
                    for p in cell.paragraphs:
                        p.paragraph_format.space_after=Pt(0)
                continue
            p=doc.add_paragraph()
            if b['type']=='image' or b['type']=='formula' and not b.get('omml'):
                if b.get('image'):floating_picture(p,b['image'],b['bbox'][0],b['bbox'][1],b['bbox'][2]-b['bbox'][0],b['bbox'][3]-b['bbox'][1])
                continue
            frame(p,b['bbox'])
            if b['type']=='text':
                for run in b.get('runs',[{'text':b.get('text','')} ]):
                    r=p.add_run(clean_text(run.get('text')));r.font.name=safe_font(run.get('font','Arial'));r.font.size=Pt(finite(run.get('fontSize'),b.get('fontSize',12)));r.bold=bool(run.get('bold'));r.italic=bool(run.get('italic'))
                    color=run.get('color','000000')
                    if re.fullmatch('[0-9a-fA-F]{6}',color):r.font.color.rgb=RGBColor.from_string(color)
            elif b['type']=='formula' and b.get('omml'):
                math=parse_xml(b['omml']);size=round(max(4,(b['bbox'][3]-b['bbox'][1])*.95)*2)
                for run in math.findall('.//{http://schemas.openxmlformats.org/officeDocument/2006/math}r'):
                    props=node('w:rPr',{});props.append(node('w:sz',{'w:val':size}));props.append(node('w:szCs',{'w:val':size}));run.insert(0,props)
                p._p.append(math)
        # A tiny ending paragraph keeps the floating objects assigned to this section.
        end=doc.add_paragraph();end.paragraph_format.line_spacing=Pt(1);end.paragraph_format.space_after=Pt(0);end.add_run().font.size=Pt(1)
    doc.save(path)
    # Exact editor reopening is safe only while the visible DOCX XML is unchanged.
    original=path.read_bytes()
    with zipfile.ZipFile(io.BytesIO(original)) as z,zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as out:
        for name in z.namelist():
            data=z.read(name)
            if name=='[Content_Types].xml':
                root=ET.fromstring(data);default=ET.SubElement(root,'{http://schemas.openxmlformats.org/package/2006/content-types}Default');default.set('Extension','json');default.set('ContentType','application/json');data=ET.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
            out.writestr(name,data)
    fingerprint=hashlib.sha256()
    with zipfile.ZipFile(path) as z:
        for name in sorted(n for n in z.namelist() if not n.endswith('/') and n!='document-studio/project.json'):
            fingerprint.update(name.encode('utf-8')+b'\0');fingerprint.update(z.read(name))
    with zipfile.ZipFile(path,'a',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as out:
        out.writestr('document-studio/project.json',json.dumps({'packageHash':fingerprint.hexdigest(),'project':project},ensure_ascii=False))

def validate_output(path,pages):
    from lxml import etree as ET
    from docx import Document
    with zipfile.ZipFile(path) as z:
        bad=z.testzip()
        if bad:raise ValueError('DOCX archive verification failed: '+bad)
        for name in z.namelist():
            if name.endswith('.xml'):ET.fromstring(z.read(name),ET.XMLParser(resolve_entities=False,no_network=True))
        root=ET.fromstring(z.read('word/document.xml'))
        ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        sections=len(root.findall('.//w:sectPr',ns));text=''.join(root.itertext())
        expected=''.join(b.get('text','') if b['type']=='text' else ''.join(c['text'] for c in b.get('cells',[])) for p in pages for b in p['blocks'])
        text=text.replace('\n','')
        expected_parts=[b['text'] for p in pages for b in p['blocks'] if b['type']=='text']+[c['text'] for p in pages for b in p['blocks'] for c in b.get('cells',[])]
        missing=[s for s in expected_parts if s.replace('\n','') not in text]
        if sections!=len(pages):raise ValueError('Converted DOCX page-section count does not match the source.')
        if missing:raise ValueError('Converted DOCX is missing extracted text.')
        images=len([n for n in z.namelist() if n.startswith('word/media/')])
        if not images:raise ValueError('Converted DOCX is missing page artwork.')
    Document(path)
    return {'archiveIntegrity':'passed','xmlValidity':'passed','pageSections':sections,'embeddedImages':images,'missingTextBlocks':len(missing),'extractedCharacters':len(expected)}

def geometry_checks(pages):
    results=[]
    for pi,p in enumerate(pages):
        outside=0;overlaps=0;area=0
        for i,b in enumerate(p['blocks']):
            x,y,r,bot=b['bbox'];area+=max(0,r-x)*max(0,bot-y)
            if x< -1 or y< -1 or r>p['width']+2 or bot>p['height']+2:outside+=1
            if b['type']!='text':continue
            for c in p['blocks'][i+1:]:
                if c['type']!='text':continue
                cx,cy,cr,cb=c['bbox'];inter=max(0,min(r,cr)-max(x,cx))*max(0,min(bot,cb)-max(y,cy))
                if inter>max(1,min((r-x)*(bot-y),(cr-cx)*(cb-cy)))*.35:overlaps+=1
        results.append({'page':pi+1,'outOfBoundsBlocks':outside,'majorTextOverlaps':overlaps,'structuredAreaFraction':round(min(1,area/(p['width']*p['height'])),4)})
    return results

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--request');parser.add_argument('--health',action='store_true');args=parser.parse_args()
    if args.health:
        import pypdfium2,docx,PIL,lxml
        emit('result',healthy=True,pdfium=str(pypdfium2.PDFIUM_INFO),python=sys.version.split()[0]);return
    if not args.request:raise ValueError('Missing conversion request.')
    request_path=Path(args.request).resolve(strict=True)
    if request_path.stat().st_size>65536:raise ValueError('Invalid conversion request.')
    req=json.loads(request_path.read_text('utf-8-sig'));inputs=req.get('inputs')
    if not isinstance(inputs,list) or not 1<=len(inputs)<=300 or not all(isinstance(x,str) for x in inputs):raise ValueError('Choose 1–300 document files.')
    output=Path(req['output']).resolve();output.mkdir(parents=True,exist_ok=True)
    for name in ('converted.docx','project.json','report.json'):
        if (output/name).exists():raise ValueError('Conversion output must be a fresh directory.')
    pages,sources=process_inputs(inputs,output)
    name=Path(inputs[0]).stem+(' combined' if len(inputs)>1 else '')
    project=project_for(pages,name)
    progress('Reconstructing editable document',page=len(pages),total=len(pages),stage='docx')
    docx_path=output/'converted.docx';build_docx(pages,docx_path,project)
    validation=validate_output(docx_path,pages)
    validation['geometry']=geometry_checks(pages)
    uncertain=[{'page':pi+1,'id':f'{pi}-{bi}','text':b.get('text',b.get('latex','')),'confidence':b.get('confidence',1)} for pi,p in enumerate(pages) for bi,b in enumerate(p['blocks']) if b.get('confidence',1)<.85]
    warnings=list(dict.fromkeys(w for p in pages for w in p.get('warnings',[])))
    if any(b.get('omml') for p in pages for b in p['blocks']):warnings.append('Editable equation size and spacing can vary between Word-compatible applications. Compare equations with the source preview; the editor and PDF export retain the source appearance.')
    for check in validation['geometry']:
        if check['outOfBoundsBlocks'] or check['majorTextOverlaps']:warnings.append('Page '+str(check['page'])+' contains overlapping or out-of-page text regions. Review its layout before saving.')
    warnings.append('Positioned text and graphics preserve source layout. Editing text may require resizing or moving a text region. Fonts unavailable on this computer are substituted. Vector artwork is preserved as a high-resolution image.')
    report={'pages':len(pages),'sources':sources,'validation':validation,'warnings':warnings,'uncertain':uncertain,
            'pageDetails':[{'page':i+1,'source':p['source'],'sourcePage':p['sourcePage'],'method':p['method'],'width':p['width'],'height':p['height'],'blocks':len(p['blocks']),'preview':p['preview']} for i,p in enumerate(pages)],
            'visualComparison':{'status':'review-required','reason':'Source previews are supplied for review. A Word rendering engine is not bundled; exact DOCX pagination cannot be guaranteed.'}}
    (output/'project.json').write_text(json.dumps(project,ensure_ascii=False),'utf-8')
    (output/'report.json').write_text(json.dumps(report,ensure_ascii=False),'utf-8')
    emit('result',docx=str(docx_path),project=str(output/'project.json'),report=str(output/'report.json'),pages=len(pages),warnings=warnings)

if __name__=='__main__':
    try:
        constrain_worker()
        main()
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        emit('error',message=str(e) or type(e).__name__)
        sys.exit(1)
