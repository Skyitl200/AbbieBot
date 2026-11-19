#!/usr/bin/env python3
"""Render pointers on the full original neuron photograph without cropping or resizing."""
from pathlib import Path
import json,hashlib,math
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];FILE=ROOT/'study-data/lab-models/neuron.json'
def main():
 data=json.loads(FILE.read_text());source=ROOT/'study-assets/lab-models'/data['sourceImageFile'];assert hashlib.sha256(source.read_bytes()).hexdigest()==data['sourceImageSha256']
 original=Image.open(source).convert('RGB');assert original.size==(646,1024)
 for model in data['models']:
  image=original.copy();draw=ImageDraw.Draw(image);a=model['annotation']
  if a['kind']=='arrow':
   x,y=a['target'];tail=a['tail'];dx,dy=x-tail[0],y-tail[1];length=math.hypot(dx,dy);ux,uy=dx/length,dy/length
   tip=(x-ux*8,y-uy*8);base=(tip[0]-ux*12,tip[1]-uy*12);tri=[tip,(base[0]-uy*6,base[1]+ux*6),(base[0]+uy*6,base[1]-ux*6)]
   draw.line([tuple(tail),base],fill='black',width=7);draw.line([tuple(tail),base],fill='#00edff',width=3);draw.polygon(tri,fill='#00edff',outline='black',width=1)
   draw.ellipse((x-7,y-7,x+7,y+7),outline='black',width=3);draw.ellipse((x-5,y-5,x+5,y+5),outline='#00edff',width=2)
  elif a['kind']=='axon-long-line':
   points=[tuple(p) for p in a['points']];draw.line(points,fill='black',width=7,joint='curve');draw.line(points,fill='#3979ff',width=4,joint='curve')
  else:
   points=[tuple(p) for p in a['points']];draw.line(points,fill='black',width=7,joint='curve');draw.line(points,fill='#00edff',width=3,joint='curve')
  assert model['view']=={'crop':[0,0,646,1024],'scale':1}
  destination=ROOT/'study-assets/lab-models'/model['expectedImageFile'];destination.parent.mkdir(exist_ok=True);image.save(destination,optimize=True);model['imageSha256']=hashlib.sha256(destination.read_bytes()).hexdigest()
 FILE.write_text(json.dumps(data,indent=2)+'\n');print('Rendered',len(data['models']),'full-photo neuron cards.')
if __name__=='__main__':main()
