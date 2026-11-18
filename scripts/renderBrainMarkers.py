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
  file=out/f'brain-{i:02}.png';image.save(file,optimize=True)
  model['expectedImageFile']=f'brain-left-sagittal/{file.name}'
  model['renderMethod']='original-photo-arrow-and-ring-overlay'
  model['imageSha256']=hashlib.sha256(file.read_bytes()).hexdigest()
  model['annotation']={'kind':'arrow-and-open-ring','target':[x,y],'tail':list(tail),'radius':radius,'overlayBounds':[x-12,y-49,x+65,y+12]}
  for q in model['questions']:
   q['question']='Identify the structure indicated by the cyan arrow and open ring.'
   q['typedQuestion']=q['question']
 data['source']='User-provided Head.jpg, 26-term vocabulary list, and reference screenshot. One cyan arrow and open ring identify the target on each card. Original source anatomy is preserved outside the pointer overlay.'
 FILE.write_text(json.dumps(data,indent=2)+'\n')
 print('Rendered',len(data['models']),'individual marked cards.')
if __name__=='__main__':main()
