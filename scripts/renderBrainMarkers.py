#!/usr/bin/env python3
"""Build quiz pointer overlays while retaining every source pixel elsewhere."""
from pathlib import Path
import json, hashlib, math
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
FILE=ROOT/'study-data/lab-models/brain-left-sagittal.json'
# Coordinates use the user's unaltered 772 x 1024 source photograph.
# Colliculi match the user's two circled model screenshots: superior first,
# inferior second. Coordinates are mapped back onto the original photograph.
TARGETS=[(548,108),(281,156),(443,195),(441,225),(431,158),(405,277),(365,309),(377,343),(416,346),(428,321),(443,406),(449,355),(459,487),(428,640),(592,461),(550,406),(493,405),(476,350),(655,366),(495,364),(488,331),(510,323),(437,295),(456,299),(479,283),(444,249)]
def main():
 data=json.loads(FILE.read_text());source=ROOT/'study-assets/lab-models'/data['sourceImageFile']
 assert hashlib.sha256(source.read_bytes()).hexdigest()==data['sourceImageSha256']
 original=Image.open(source).convert('RGB');assert original.size==(772,1024)
 out=ROOT/'study-assets/lab-models/brain-left-sagittal';out.mkdir(exist_ok=True)
 for i,(model,(x,y)) in enumerate(zip(data['models'],TARGETS),1):
  image=original.copy();draw=ImageDraw.Draw(image)
  # One hollow ring and one arrow: no filled dot obscures the target.
  tail=(x+59,y-43);radius=7
  dx,dy=x-tail[0],y-tail[1];length=math.hypot(dx,dy);ux,uy=dx/length,dy/length
  tip=(x-ux*(radius+3),y-uy*(radius+3));base=(tip[0]-ux*13,tip[1]-uy*13)
  triangle=[tip,(base[0]-uy*7,base[1]+ux*7),(base[0]+uy*7,base[1]-ux*7)]
  draw.line([tail,base],fill='black',width=9);draw.line([tail,base],fill='#00edff',width=5)
  draw.polygon(triangle,fill='#00edff',outline='black',width=2)
  draw.ellipse((x-radius-2,y-radius-2,x+radius+2,y+radius+2),outline='black',width=4)
  draw.ellipse((x-radius,y-radius,x+radius,y+radius),outline='#00edff',width=3)
  special=None
  if model['name']=='Cerebellum':
   image=original.copy();draw=ImageDraw.Draw(image)
   boundary=[(547,354),(572,359),(597,378),(619,405),(635,435),(630,463),(607,487),(573,505),(531,518),(476,523),(479,500),(489,472),(498,440),(495,412),(502,390),(523,369),(547,354)]
   draw.line(boundary,fill='black',width=7,joint='curve');draw.line(boundary,fill='#00edff',width=3,joint='curve')
   special={'kind':'whole-section-outline','outline':boundary,'overlayBounds':[470,348,641,529]}
  elif model['name']=='Arbor vitae':
   image=original.copy();draw=ImageDraw.Draw(image)
   branches=[((539,389),(606,354)),((581,425),(656,411)),((547,468),(623,514))]
   for (bx,by),start in branches:
    dx,dy=bx-start[0],by-start[1];length=math.hypot(dx,dy);ux,uy=dx/length,dy/length
    tip=(bx-ux*9,by-uy*9);base=(tip[0]-ux*12,tip[1]-uy*12)
    triangle=[tip,(base[0]-uy*6,base[1]+ux*6),(base[0]+uy*6,base[1]-ux*6)]
    draw.line([start,base],fill='black',width=8);draw.line([start,base],fill='#00edff',width=4)
    draw.polygon(triangle,fill='#00edff',outline='black',width=2)
    draw.ellipse((bx-7,by-7,bx+7,by+7),outline='black',width=3)
    draw.ellipse((bx-5,by-5,bx+5,by+5),outline='#00edff',width=2)
   special={'kind':'branching-network-markers','targets':[list(point) for point,tail in branches],'tails':[list(tail) for point,tail in branches],'overlayBounds':[530,345,665,523]}
  file=out/f'brain-{i:02}.png';image.save(file,optimize=True)
  model['expectedImageFile']=f'brain-left-sagittal/{file.name}'
  model['renderMethod']='original-photo-arrow-and-ring-overlay'
  model['imageSha256']=hashlib.sha256(file.read_bytes()).hexdigest()
  model['annotation']={'kind':'arrow-and-open-ring','target':[x,y],'tail':list(tail),'radius':radius,'overlayBounds':[x-12,y-49,x+65,y+12]}
  if special:
   model['annotation']=special
   model['renderMethod']='original-photo-section-outline' if i==15 else 'original-photo-branching-network-markers'
  for q in model['questions']:
   q['question']='Identify the entire section outlined in cyan.' if i==15 else 'Identify the branching network indicated by the cyan markers.' if i==16 else 'Identify the structure indicated by the cyan arrow and open ring.'
   q['typedQuestion']=q['question']
 data['source']='User-provided Head.jpg, 26-term vocabulary list, and reference screenshot. Cyan pointers identify individual targets; the cerebellum uses a whole-section outline and arbor vitae uses markers on multiple white-matter branches. Original source anatomy is preserved outside the pointer overlay.'
 FILE.write_text(json.dumps(data,indent=2)+'\n')
 print('Rendered',len(data['models']),'individual marked cards.')
if __name__=='__main__':main()
