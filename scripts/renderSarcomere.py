#!/usr/bin/env python3
"""Render cropped model photos with arrows and band/triad brackets."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw
from renderRespiratoryPointers import polygon

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'study-data/lab-models/sarcomere.json'


def line(draw, points, width=3):
    draw.line(points, fill=(0, 0, 0), width=width+2)
    draw.line(points, fill=(0, 229, 255), width=width)


def arrow(draw, tail, tip):
    draw.polygon([tuple(p) for p in polygon(tail, tip, 4, 17, 20)], fill=(0, 0, 0))
    draw.polygon([tuple(p) for p in polygon(tail, tip, 2, 13, 16)], fill=(0, 229, 255))


def render(data, model):
    source = data['sourceImages'][model['sourceView']]
    path = ROOT / 'study-assets/lab-models' / source['file']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256']
    a = model['annotation']
    image = Image.open(path).convert('RGB').crop(a['cropBox'])
    image = image.resize(tuple(a['renderSize']), Image.Resampling.LANCZOS)
    top, bottom = a['paddingTop'], a['paddingBottom']
    canvas = Image.new('RGB', (image.width, image.height+top+bottom), 'white')
    canvas.paste(image, (0, top))
    draw = ImageDraw.Draw(canvas)
    if a['kind'] == 'arrows':
        for pair in a['arrows']:
            arrow(draw, pair['tail'], pair['tip'])
    elif a['kind'] == 'bracket':
        x1, x2, y = a['x1'], a['x2'], a['y']
        direction = 1 if a.get('position') == 'top' else -1
        line(draw, [(x1, y+direction*15), (x1, y), (x2, y), (x2, y+direction*15)])
        if a.get('guideY') is not None:
            for x in (x1, x2):
                lo, hi = sorted((y+direction*19, a['guideY']))
                for start in range(lo, hi, 12):
                    line(draw, [(x, start), (x, min(start+5, hi))], width=1)
    else:
        raise ValueError('Unknown annotation kind')
    destination = ROOT / 'study-assets/lab-models' / model['expectedImageFile']
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, format='JPEG', quality=94, subsampling=0, optimize=True)
    model['imageSha256'] = hashlib.sha256(destination.read_bytes()).hexdigest()
    model['imageSize'] = list(canvas.size)


def main():
    data = json.loads(MANIFEST.read_text())
    for model in data['models']:
        render(data, model)
    MANIFEST.write_text(json.dumps(data, indent=2)+'\n')
    print(f"Rendered {len(data['models'])} sarcomere identification cards.")


if __name__ == '__main__':
    main()
