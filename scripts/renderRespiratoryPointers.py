#!/usr/bin/env python3
"""Draw arrows onto the original photo without regenerating or retouching anatomy.

Developer-only asset build; requires Pillow. PNG outputs retain every source pixel
outside the pointer polygon. The bot serves the prebuilt assets without Pillow.
"""
from pathlib import Path
import hashlib
import json
import math
import sys
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'study-data/lab-models' / (sys.argv[1] if len(sys.argv) > 1 else 'upper-respiratory.json')

def polygon(tail, tip, shaft, head_width, head_length):
    dx, dy = tip[0] - tail[0], tip[1] - tail[1]
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    vx, vy = -uy, ux
    bx, by = tip[0] - ux * head_length, tip[1] - uy * head_length
    points = [tip, (bx + vx*head_width/2, by + vy*head_width/2),
        (bx + vx*shaft/2, by + vy*shaft/2), (tail[0]+vx*shaft/2, tail[1]+vy*shaft/2),
        (tail[0]-vx*shaft/2, tail[1]-vy*shaft/2), (bx-vx*shaft/2, by-vy*shaft/2),
        (bx-vx*head_width/2, by-vy*head_width/2)]
    return [[round(x), round(y)] for x, y in points]

def main():
    data = json.loads(DATA.read_text())
    source = ROOT / 'study-assets/lab-models' / data['sourceImageFile']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == data['sourceImageSha256']
    original = Image.open(source).convert('RGB')
    for model in data['models']:
        a = model['annotation']
        if a.get('kind') == 'bracket':
            outer = a['outerPolygon']
            inner = a['innerPolygon']
        else:
            tail, tip = a['tail'], a['tip']
            dx, dy = tip[0]-tail[0], tip[1]-tail[1]; length = math.hypot(dx,dy)
            outer = polygon(tail, tip, a['shaftWidth']+2*a['outlineWidth'], a['headWidth']+2*a['outlineWidth'], a['headLength']+1)
            inner_tip = [tip[0]-dx/length, tip[1]-dy/length]
            inner_tail = [tail[0]+dx/length, tail[1]+dy/length]
            inner = polygon(inner_tail, inner_tip, a['shaftWidth'], a['headWidth'], a['headLength'])
        image = original.copy(); draw = ImageDraw.Draw(image)
        draw.polygon([tuple(p) for p in outer], fill=(0,0,0)); draw.polygon([tuple(p) for p in inner], fill=(0,229,255))
        path = ROOT / 'study-assets/lab-models' / model['expectedImageFile']
        image.save(path, format='PNG', optimize=True)
        model['imageSha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        a['overlayPolygon'] = outer
    DATA.write_text(json.dumps(data, indent=2)+'\n')
    print(f"Rendered {len(data['models'])} PNGs from the original {original.width}x{original.height} photo.")

if __name__ == '__main__':
    main()
