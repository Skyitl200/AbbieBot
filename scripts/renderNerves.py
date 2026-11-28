"""Overlay nerve pointers on native-size user photographs without generative changes."""
from pathlib import Path
import json,hashlib,math
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
manifest=ROOT/'study-data/lab-models/nerves.json'
data=json.loads(manifest.read_text())
review=[]
for model in data['models']:
    if model['verificationStatus']=='pending':continue
    source=data['sources'][model['sourceKey']]
    path=ROOT/'study-assets/lab-models'/source['file']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==source['sha256']
    image=Image.open(path).convert('RGB');draw=ImageDraw.Draw(image)
    if model['annotation']['kind']=='region':
        x,y=model['annotation']['target'];r=model['annotation']['radius']
        draw.ellipse((x-r,y-r,x+r,y+r),outline='black',width=7)
        draw.ellipse((x-r+2,y-r+2,x+r-2,y+r-2),outline='#00edff',width=3)
    else:
        x,y=model['annotation']['target'];tx,ty=model['annotation']['tail']
        dx,dy=x-tx,y-ty;length=math.hypot(dx,dy);ux,uy=dx/length,dy/length
        tip=(x-ux*7,y-uy*7);base=(tip[0]-ux*15,tip[1]-uy*15)
        triangle=[tip,(base[0]-uy*7,base[1]+ux*7),(base[0]+uy*7,base[1]-ux*7)]
        draw.line([(tx,ty),base],fill='black',width=8);draw.line([(tx,ty),base],fill='#00edff',width=4)
        draw.polygon(triangle,fill='#00edff',outline='black',width=2)
        draw.ellipse((x-7,y-7,x+7,y+7),outline='black',width=4);draw.ellipse((x-5,y-5,x+5,y+5),outline='#00edff',width=2)
    destination=ROOT/'study-assets/lab-models'/model['expectedImageFile'];image.save(destination,optimize=True)
    model['view']={'crop':[0,0,*image.size],'scale':1};model['imageSha256']=hashlib.sha256(destination.read_bytes()).hexdigest()
    preview=Image.new('RGB',(330,375),'white');thumb=image.copy();thumb.thumbnail((320,330));preview.paste(thumb,((330-thumb.width)//2,30));ImageDraw.Draw(preview).text((10,8),model['name'],fill='black');review.append(preview)
sheet=Image.new('RGB',(990,math.ceil(len(review)/3)*375),'#e8e8e8')
for i,image in enumerate(review):sheet.paste(image,((i%3)*330,(i//3)*375))
sheet.save(ROOT/'study-assets/lab-models/nerves-preview.jpg',quality=90)
manifest.write_text(json.dumps(data,indent=2)+'\n')
print('Rendered',len(review),'nerve cards including the reference-matched coccygeal region.')
