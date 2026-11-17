#!/usr/bin/env python3
"""Crop the user's joined eye views and add one pointer per verified card."""
from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageDraw
from renderRespiratoryPointers import polygon

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'study-data/lab-models/eye-anatomy.json'


def main():
    data = json.loads(MANIFEST.read_text())
    source = ROOT / 'study-assets/lab-models' / data['sourceImageFile']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == data['sourceImageSha256']
    original = Image.open(source).convert('RGB')
    count = 0
    for model in data['models']:
        if model.get('verificationStatus') == 'pending':
            continue
        a = model['annotation']
        box = a['cropBox']
        assert 0 <= box[0] < box[2] <= original.width
        assert 0 <= box[1] < box[3] <= original.height
        image = original.crop(box)
        tail, tip = a['tail'], a['tip']
        assert all(0 <= p[0] < image.width and 0 <= p[1] < image.height for p in (tail, tip))
        dx, dy = tip[0] - tail[0], tip[1] - tail[1]
        length = math.hypot(dx, dy)
        assert length > 0
        outer = polygon(tail, tip, a['shaftWidth'] + 2*a['outlineWidth'], a['headWidth'] + 2*a['outlineWidth'], a['headLength'] + 1)
        inner = polygon([tail[0]+dx/length, tail[1]+dy/length], [tip[0]-dx/length, tip[1]-dy/length], a['shaftWidth'], a['headWidth'], a['headLength'])
        draw = ImageDraw.Draw(image)
        draw.polygon([tuple(p) for p in outer], fill=(0, 0, 0))
        draw.polygon([tuple(p) for p in inner], fill=(0, 229, 255))
        destination = ROOT / 'study-assets/lab-models' / model['expectedImageFile']
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, format='PNG', optimize=True)
        model['imageSha256'] = hashlib.sha256(destination.read_bytes()).hexdigest()
        a['overlayPolygons'] = [outer, inner]
        count += 1
    MANIFEST.write_text(json.dumps(data, indent=2)+'\n')
    print(f'Rendered {count} verified cards from the original {original.width}x{original.height} joined photograph.')


if __name__ == '__main__':
    main()
