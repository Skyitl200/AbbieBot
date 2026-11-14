#!/usr/bin/env python3
"""Render original-photo pointers, then lossless nearest-neighbor detail views."""
from pathlib import Path
import hashlib, json, subprocess, sys
from PIL import Image

root=Path(__file__).resolve().parents[1]
subprocess.run([sys.executable,str(root/'scripts/renderRespiratoryPointers.py'),'spinal-nerves.json'],check=True)
manifest=root/'study-data/lab-models/spinal-nerves.json'
data=json.loads(manifest.read_text())
for model in data['models']:
    view=model.get('view')
    if not view:
        continue
    path=root/'study-assets/lab-models'/model['expectedImageFile']
    image=Image.open(path).crop(view['crop'])
    image=image.resize((image.width*view['scale'],image.height*view['scale']),Image.Resampling.NEAREST)
    image.save(path,optimize=True)
    model['imageSha256']=hashlib.sha256(path.read_bytes()).hexdigest()
manifest.write_text(json.dumps(data,indent=2)+'\n')
