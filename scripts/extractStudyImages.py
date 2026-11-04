#!/usr/bin/env python3
"""Extract original lecture illustrations for review; never execute slide content.

Requires Pillow. Run with the directory containing the uploaded .pptx files.
Writes review candidates locally; only selected images are later packaged.
"""
import hashlib, io, json, posixpath, re, sys, zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image

NS={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
ALIASES={'Immune_System_Compressed.pptx':'Immune System Chapter 21 Part A.pptx','Urinary_System_Compressed.pptx':'Urinary System Chapter 24.pptx'}
CREDIT='Lecture adaptation: Ahmed Katsha, Raritan Valley Community College; OpenStax / Rice University, CC BY 4.0. See original slide credit for exceptions.'

def extract(root, output):
    output.mkdir(parents=True,exist_ok=True);assets={};sources={}
    for presentation in sorted(root.rglob('*.pptx')):
        source=ALIASES.get(presentation.name,presentation.name)
        with zipfile.ZipFile(presentation) as archive:
            document=ET.fromstring(archive.read('ppt/presentation.xml'))
            size=document.find('p:sldSz',NS);slide_area=int(size.get('cx'))*int(size.get('cy'))
            slides=[]
            for name in sorted((n for n in archive.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)),key=lambda n:int(re.search(r'(\d+)\.xml',n).group(1))):
                number=int(re.search(r'(\d+)\.xml',name).group(1));xml=ET.fromstring(archive.read(name))
                text='\n'.join(''.join(p.itertext()) for p in xml.findall('.//a:p',NS))
                relname=f'ppt/slides/_rels/slide{number}.xml.rels'
                relationships={e.get('Id'):e for e in ET.fromstring(archive.read(relname))} if relname in archive.namelist() else {}
                pictures=[]
                if number<5:
                    slides.append({'slide':number,'text':text,'pictures':pictures});continue
                for pic in xml.findall('.//p:pic',NS):
                    blip=pic.find('.//a:blip',NS)
                    rid=blip.get('{'+NS['r']+'}embed') if blip is not None else None
                    rel=relationships.get(rid)
                    if rel is None or rel.get('TargetMode')=='External':continue
                    media=posixpath.normpath(posixpath.join('ppt/slides',rel.get('Target')))
                    if not media.startswith('ppt/media/') or media not in archive.namelist():continue
                    ext=pic.find('p:spPr/a:xfrm/a:ext',NS)
                    area=int(ext.get('cx'))*int(ext.get('cy'))/slide_area if ext is not None else 1
                    if area<0.025:continue
                    original=archive.read(media)
                    try:
                        im=Image.open(io.BytesIO(original))
                        if im.width<220 or im.height<140 or im.width*im.height<50000:continue
                        original_size=list(im.size);animated=getattr(im,'is_animated',False)
                        if animated and len(original)<7_500_000:
                            data=original;suffix='gif';width,height=im.size;modified=False
                        else:
                            im.seek(0);im.load();im.thumbnail((1600,1400))
                            suffix='jpg' if im.format=='JPEG' else 'png'
                            if suffix=='jpg':im=im.convert('RGB')
                            buf=io.BytesIO();im.save(buf,format='JPEG' if suffix=='jpg' else 'PNG',**({'quality':90,'optimize':True} if suffix=='jpg' else {'optimize':True}))
                            data=buf.getvalue();width,height=im.size;modified=True
                        if len(data)>7_500_000:continue
                    except (OSError,ValueError,NotImplementedError):continue
                    digest=hashlib.sha256(data).hexdigest()[:20];filename=f'{digest}.{suffix}'
                    (output/filename).write_bytes(data)
                    details=pic.find('p:nvPicPr/p:cNvPr',NS)
                    alt=details.get('descr','') if details is not None else ''
                    item={'asset':digest,'alt':alt.strip(),'display_area':round(area,4),'member':media}
                    pictures.append(item)
                    asset=assets.setdefault(digest,{'file':filename,'width':width,'height':height,'bytes':len(data),'animated':animated,'modified':modified,'original_dimensions':original_size,'original_sha256':hashlib.sha256(original).hexdigest(),'occurrences':[]})
                    asset['occurrences'].append({'source':source,'slide':number,'alt':alt.strip(),'slide_text':text,'credit':CREDIT})
                slides.append({'slide':number,'text':text,'pictures':pictures})
            sources[source]={'sha256':hashlib.sha256(presentation.read_bytes()).hexdigest(),'slides':slides}
    manifest={'version':1,'default_credit':CREDIT,'assets':assets,'sources':sources}
    (output/'candidates.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'Extracted {len(assets)} distinct images from {len(sources)} presentations into {output}')

if __name__=='__main__':
    extract(Path(sys.argv[1]),Path(__file__).resolve().parent.parent/'.local'/'study-image-candidates')
