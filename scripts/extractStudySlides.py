#!/usr/bin/env python3
"""Extract presentation text for question authoring, retaining slide numbers.

Usage: python scripts/extractStudySlides.py /workspace/attachments
Outputs are local authoring material in the ignored .local/study-sources folder.
Diagram labels embedded in images still require visual review of the originals.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

SOURCE_NAMES = {
    'Immune_System_Compressed.pptx': 'Immune System Chapter 21 Part A.pptx',
    'Urinary_System_Compressed.pptx': 'Urinary System Chapter 24.pptx',
}


def extract(root, output):
    output.mkdir(parents=True, exist_ok=True)
    manifest = []
    for presentation in sorted(root.rglob('*.pptx')):
        source_name = SOURCE_NAMES.get(presentation.name, presentation.name)
        slides = []
        with zipfile.ZipFile(presentation) as archive:
            names = [name for name in archive.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', name)]
            for name in sorted(names, key=lambda name: int(re.search(r'slide(\d+)', name).group(1))):
                xml = ET.fromstring(archive.read(name))
                paragraphs = xml.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}p')
                lines = [''.join(p.itertext()) for p in paragraphs]
                slides.append({'slide': int(re.search(r'slide(\d+)', name).group(1)), 'text': '\n'.join(lines)})
        (output / f'{Path(source_name).stem}.json').write_text(json.dumps(
            {'source': source_name, 'uploaded_file': presentation.name, 'slides': slides}, ensure_ascii=False, indent=2) + '\n')
        manifest.append({'source': source_name, 'uploaded_file': presentation.name, 'slides': len(slides),
                         'characters': sum(len(slide['text']) for slide in slides),
                         'sha256': hashlib.sha256(presentation.read_bytes()).hexdigest()})
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Extracted {len(manifest)} presentations into {output}')


if __name__ == '__main__':
    extract(Path(sys.argv[1]), Path(__file__).resolve().parent.parent / '.local' / 'study-sources')
