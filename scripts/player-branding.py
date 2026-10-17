"""Build local EIU installer artwork; no network assets."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out = Path(__file__).resolve().parents[1] / 'desktop-player' / 'ui'
out.mkdir(parents=True, exist_ok=True)
font_path = Path('C:/Windows/Fonts/segoeuib.ttf')
if not font_path.exists():
    font_path = Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
def font(size):
    return ImageFont.truetype(str(font_path), size) if font_path.exists() else ImageFont.load_default(size=size)
navy=(8,41,69); gold=(233,202,139); cream=(251,250,247)
icon=Image.new('RGBA',(1024,1024),(0,0,0,0)); d=ImageDraw.Draw(icon)
d.rounded_rectangle((20,20,1004,1004),radius=225,fill=navy,outline=gold,width=14)
d.text((512,464),'E',font=font(640),fill=gold,anchor='mm')
d.rounded_rectangle((265,803,759,823),radius=10,fill=(179,145,89))
icon.save(out/'icon.png');icon.save(out/'icon.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
icon.save(out/'icon.icns')
sidebar=Image.new('RGB',(164,314),navy);d=ImageDraw.Draw(sidebar)
d.rounded_rectangle((18,24,66,73),radius=12,outline=gold,width=1)
d.text((42,49),'E',font=font(36),fill=gold,anchor='mm')
d.text((18,111),'EIU',font=font(31),fill=cream)
d.text((18,154),'LESSON',font=font(18),fill=gold)
d.text((18,179),'PLAYER',font=font(18),fill=gold)
d.line((18,220,78,220),fill=gold,width=2)
d.text((18,251),'LEARNING',font=font(10),fill=cream)
d.text((18,269),'SPACE',font=font(10),fill=cream)
sidebar.save(out/'installer-sidebar.bmp')
header=Image.new('RGB',(150,57),cream);d=ImageDraw.Draw(header)
d.rounded_rectangle((6,6,48,48),radius=10,fill=navy)
d.text((27,25),'E',font=font(29),fill=gold,anchor='mm')
d.text((61,9),'EIU',font=font(21),fill=navy)
d.text((61,34),'LEARNING SPACE',font=font(7),fill=(157,121,68))
header.save(out/'installer-header.bmp')
