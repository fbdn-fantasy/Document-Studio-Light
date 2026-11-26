from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
import json
root=Path(__file__).resolve().parents[1];folder=root/'assets/page-surfaces';n=512;rng=np.random.default_rng(130)
y,x=np.mgrid[:n,:n]
def noise(s):
    data=rng.normal(128,40,(s,s)).clip(0,255).astype('uint8')
    return (np.asarray(Image.fromarray(data).resize((n,n),Image.Resampling.BICUBIC)).astype(float)-128)/40
grain=noise(n)
materials={'Fine Paper Grain':220+grain*13,'Handmade Paper':215+noise(10)*10+noise(90)*8+grain*6,'Parchment':213+noise(7)*19+noise(27)*8+grain*5,'Canvas Weave':210+18*np.cos(x*2*np.pi/9)*np.cos(y*2*np.pi/18)+13*np.cos(y*2*np.pi/9)+grain*4,'Watercolor Wash':227+22*np.sin(noise(5)*2+noise(25)*.18)+noise(75)*4,'Pencil Grain':225+12*np.sin((x+y*.33)*1.4+noise(16))+grain*9,'Brushed Surface':208+np.repeat(rng.normal(0,11,(n,1)),n,axis=1)+noise(10)*8+grain*3,'Geometric Lattice':237-20*((abs((x+y)%48-24)<1.5)|(abs((x-y)%48-24)<1.5))}
for name,a in materials.items():
    im=Image.fromarray(np.uint8(np.clip(a,0,255)))
    if name=='Handmade Paper':
        d=ImageDraw.Draw(im)
        for _ in range(2500):
            px,py=rng.uniform(0,n,2);dx,dy=rng.normal(0,3,2);d.line((px,py,px+dx,py+dy),fill=int(rng.uniform(160,230)))
    im.convert('RGB').save(folder/(name.replace(' ','_')+'_Texture.jpg'),quality=90)
(root/'pro-surface-files.js').write_text('window.FTESurfaceFiles='+json.dumps(sorted(p.name for p in folder.glob('*.jpg')))+';')
