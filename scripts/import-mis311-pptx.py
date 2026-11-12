"""Convert the latest PPTX's private PowerPoint vector render to native SVG.

Text stays SVG text; existing raster illustrations are extracted unchanged.
No PDF bytes or page screenshots are copied into the site.
"""
import argparse
import base64
import hashlib
import json
import re
import posixpath
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import pymupdf

parser = argparse.ArgumentParser()
parser.add_argument('source_pptx', type=Path)
parser.add_argument('private_render', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / 'course-content' / 'mis311'
(root / 'assets').mkdir(parents=True, exist_ok=True)
ns = '{http://www.w3.org/2000/svg}'
ET.register_namespace('', ns[1:-1])
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')

def strip_source_frame(svg, page, frame_paths, cover):
    tree = ET.fromstring(svg)
    # Remove only the verified source template objects; lesson drawings remain.
    for parent in list(tree.iter()):
        for child in list(parent):
            transform = child.get('transform', '')
            numbers = re.findall(r'-?(?:\d*\.)?\d+(?:e[+-]?\d+)?', transform)
            logo = False
            if child.tag == ns+'g' and len(numbers) == 6 and list(child.iter(ns+'image')):
                x, y = float(numbers[4]), float(numbers[5])
                logo = (abs(x-17.504)<.1 and abs(y-6.893)<.1) or (abs(x-881.62)<.1 and abs(y+5.167)<.1)
            if logo or (cover and child.tag == ns+'image'):
                parent.remove(child)
            elif child.tag == ns+'path' and (child.get('d') in frame_paths or (cover and parent.tag != ns+'clipPath')):
                parent.remove(child)
            elif child.tag == ns+'text':
                spans = list(child.iter(ns+'tspan'))
                if spans and all(float(span.get('y', '0')) > -25 and float(span.get('x', '0').split()[0]) > 895 for span in spans):
                    parent.remove(child)
    # Compute a content viewport from all remaining lesson objects. Never crop
    # large original diagrams, including Session 2's full-page cause map.
    boxes = []
    for block in page.get_text('dict')['blocks']:
        if block['type'] == 0 and not (block['bbox'][0] > 895 and block['bbox'][1] > 515):
            boxes.append(pymupdf.Rect(block['bbox']))
    for item in page.get_image_info():
        rect = pymupdf.Rect(item['bbox'])
        if not cover and not (rect.y0 < 44 and (abs(rect.x0-17.504)<.1 or abs(rect.x0-881.62)<.1)):
            boxes.append(rect)
    for drawing in page.get_drawings():
        rect = drawing['rect']
        is_frame = rect.width > 959 or (rect.y0 > 513 and rect.x0 > 895)
        if not cover and not is_frame:
            boxes.append(rect)
    bounds = pymupdf.Rect(24, 60, 948, 512)
    for box in boxes:
        bounds |= box
    bounds = pymupdf.Rect(bounds.x0-4, bounds.y0-4, bounds.x1+4, bounds.y1+4)
    tree.set('viewBox', ' '.join(str(round(v, 3)) for v in (bounds.x0, bounds.y0, bounds.width, bounds.height)))
    tree.set('width', str(round(bounds.width, 3)))
    tree.set('height', str(round(bounds.height, 3)))
    return ET.tostring(tree, encoding='unicode'), list(bounds)

source = args.source_pptx.resolve(strict=True)
if source.suffix.lower() != '.pptx':
    raise ValueError('The authoritative source must be a PPTX.')
document = pymupdf.open(args.private_render)
if len(document) <= 22:
    raise ValueError('The source must contain slides after slide 22 for Section 2.')
# Verify the render against the PPTX itself before replacing any lesson files.
ppt_ns = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
          'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
normalize = lambda text: re.sub(r'\s+', '', text.replace('\uf0e0', '→').replace('\u00ad', ''))
source_runs = []
with zipfile.ZipFile(source) as archive:
    presentation = ET.fromstring(archive.read('ppt/presentation.xml'))
    relationships = {rel.get('Id'): rel.get('Target') for rel in ET.fromstring(archive.read('ppt/_rels/presentation.xml.rels'))}
    slide_ids = presentation.find('p:sldIdLst', ppt_ns)
    if len(slide_ids) != len(document):
        raise ValueError('The private rendering does not contain every source PPTX slide.')
    for index, slide_id in enumerate(slide_ids):
        relation_id = slide_id.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        target = relationships[relation_id]
        slide_path = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join('ppt', target))
        slide = ET.fromstring(archive.read(slide_path))
        footer_nodes = {id(node) for field in slide.findall('.//a:fld', ppt_ns) if field.get('type') == 'slidenum'
                        for node in field.findall('.//a:t', ppt_ns)}
        runs = [node.text or '' for node in slide.findall('.//a:t', ppt_ns) if id(node) not in footer_nodes]
        for run in runs:
            if normalize(run) not in normalize(document[index].get_text()):
                raise ValueError(f'Source text is absent from the private render on slide {index + 1}: {run!r}')
        source_runs.append(runs)
for session, first, last in ((1, 1, 22), (2, 23, len(document))):
    folder = root / f'session{session}'
    folder.mkdir(exist_ok=True)
    pages = []
    reference = ET.fromstring(document[1].get_svg_image(text_as_path=False))
    frame_paths = {element.get('d') for child in reference if child.tag != ns+'defs'
                   for element in child.iter(ns+'path')}
    def extract_image(match):
        mime, encoded = match.groups()
        data = base64.b64decode(encoded)
        digest = hashlib.sha256(data).hexdigest()
        extension = {'image/png': 'png', 'image/jpeg': 'jpg'}.get(mime)
        if not extension:
            raise ValueError(f'Unexpected illustration format: {mime}')
        name = f'{digest}.{extension}'
        (root / 'assets' / name).write_bytes(data)
        return f'asset:{name}'
    expected_files = set()
    for index, source_number in enumerate(range(first, last + 1), 1):
        page = document[source_number - 1]
        svg = page.get_svg_image(text_as_path=False)
        cover = any(info['xref'] == document[0].get_image_info(xrefs=True)[0]['xref']
                    for info in page.get_image_info(xrefs=True))
        svg, content_bounds = strip_source_frame(svg, page, frame_paths, cover)
        svg = re.sub(r'data:(image/[^;]+);base64,([A-Za-z0-9+/=\s]+)', extract_image, svg)
        # MuPDF names its metrically compatible Arial substitute Nimbus Sans.
        svg = svg.replace('font-family="Nimbus Sans"', 'font-family="Arial, Helvetica, sans-serif"')
        svg = svg.replace('font-family="Arial"', 'font-family="Arial, Helvetica, sans-serif"')
        # MuPDF has already mapped the symbol-font arrow to Unicode.
        svg = svg.replace('font-family="Wingdings"', 'font-family="Arial, Helvetica, sans-serif"')
        filename = f'page-{index:02}.svg'
        expected_files.add(filename)
        (folder / filename).write_text(svg, encoding='utf8')
        # The system template supplies page numbers; retain original source text
        # separately so the content audit can distinguish footer replacement.
        source_text = page.get_text()
        content_text = ''.join(''.join(span['text'] for span in line['spans'])+'\n'
                              for block in page.get_text('dict')['blocks'] if block['type'] == 0
                              and not (block['bbox'][0] > 895 and block['bbox'][1] > 515)
                              for line in block['lines'])
        pages.append({'number': index, 'sourceSlide': source_number, 'file': filename, 'text': content_text, 'sourceText': source_text,
                      'sourceTextRuns': source_runs[source_number - 1],
                      'contentBounds': content_bounds,
                      'width': page.rect.width, 'height': page.rect.height,
                      'textSpans': len(re.findall(r'<tspan\b', svg)),
                      'illustrations': len(re.findall(r'<image\b', svg))})
    manifest = {'session': session, 'title': f'Week 7 · Session {session}',
                'sourceFilename': source.name, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'sourceSlideRange': [first, last], 'sourceSlideCount': len(document),
                'pageCount': len(pages), 'assignedTemplate': '86101dcf-70f4-49c3-a6a9-983c77708ad2',
                'templateResolution': 'User selected the existing EIU without reference template. Source frame, logos, background and page numbers removed; all lesson content retained.',
                'pages': pages}
    (folder / 'storyboard.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    for obsolete in folder.glob('page-*.svg'):
        if obsolete.name not in expected_files:
            obsolete.unlink()
    print(f'Session {session}: preserved {len(pages)} pages, native text and original illustrations.')

# Drop extracted source branding files that no content slide references.
used = {match for file in root.glob('session*/*.svg') for match in re.findall(r'asset:([a-f0-9]+\.(?:png|jpg))', file.read_text(encoding='utf8'))}
for asset in (root / 'assets').iterdir():
    if asset.is_file() and asset.name not in used:
        asset.unlink()
