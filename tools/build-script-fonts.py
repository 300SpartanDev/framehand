#!/usr/bin/env python3
"""Build the small script-fallback fonts in fonts/scripts/ (all SIL OFL 1.1, renamed "FH Script …" as the OFL asks
for modified copies). The poster and kinetic faces (Anton, Archivo Black, Kalam…) are Latin-only; clip.js registers
these under the same family names with a unicode-range, so a Cyrillic, Greek, Arabic, Hebrew, Devanagari, Thai,
Korean or Japanese line is drawn in one bold face on every machine instead of whatever the system has.

Needs fontTools (pip install fonttools). Source fonts are Google Fonts files; pass their folder as the first argument.
    python3 tools/build-script-fonts.py /usr/share/fonts/truetype/sand-box/google
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer

SRC = sys.argv[1] if len(sys.argv) > 1 else '/usr/share/fonts/truetype/sand-box/google'
OUT = os.path.join(os.path.dirname(__file__), '..', 'fonts', 'scripts')

def r(a, b): return list(range(a, b + 1))
def jis_level1():
    out = []
    for hi in range(0x88, 0x99):
        for lo in list(range(0x40, 0x7F)) + list(range(0x80, 0xFD)):
            try: ch = bytes([hi, lo]).decode('cp932')
            except UnicodeDecodeError: continue
            if '\u4e00' <= ch <= '\u9fff': out.append(ord(ch))
    return out

PUNCT = r(0x20, 0x40) + r(0x2010, 0x2027) + [0x2030, 0x20AC, 0x00A0, 0x00AB, 0x00BB]
FONTS = [
    # (output, source file, variable axes, codepoints)
    ('FHScript-CyrGreekViet.woff', 'Noto Sans/NotoSans-VariableFont_wdth,wght.ttf', {'wght': 800, 'wdth': 100},
     r(0x0370, 0x03FF) + r(0x1F00, 0x1FFF) + r(0x0400, 0x052F) + r(0x1C80, 0x1C8F) + r(0xA640, 0xA69F) + r(0x2DE0, 0x2DFF)
     + [0x102, 0x103, 0x110, 0x111, 0x128, 0x129, 0x168, 0x169, 0x1A0, 0x1A1, 0x1AF, 0x1B0, 0x20AB] + r(0x0300, 0x0323) + r(0x1EA0, 0x1EF9)),
    ('FHScript-Arabic.woff', 'Noto Sans Arabic/NotoSansArabic-VariableFont_wdth,wght.ttf', {'wght': 800, 'wdth': 100},
     r(0x0600, 0x06FF) + r(0x0750, 0x077F) + r(0x08A0, 0x08FF) + r(0xFB50, 0xFDFF) + r(0xFE70, 0xFEFF) + [0x200C, 0x200D, 0x200E, 0x200F]),
    ('FHScript-Hebrew.woff', 'Heebo/Heebo-VariableFont_wght.ttf', {'wght': 800}, r(0x0590, 0x05FF) + r(0xFB1D, 0xFB4F)),
    ('FHScript-Devanagari.woff', 'Mukta/Mukta-ExtraBold.ttf', None, r(0x0900, 0x097F) + r(0xA8E0, 0xA8FF) + r(0x1CD0, 0x1CFF) + [0x200C, 0x200D, 0x25CC, 0x20B9]),
    ('FHScript-Thai.woff', 'Kanit/Kanit-Bold.ttf', None, r(0x0E00, 0x0E7F)),
    ('FHScript-Hangul.woff', 'Black Han Sans/BlackHanSans-Regular.ttf', None, r(0xAC00, 0xD7A3) + r(0x1100, 0x11FF) + r(0x3130, 0x318F)),
    ('FHScript-Japanese.woff', 'Dela Gothic One/DelaGothicOne-Regular.ttf', None, r(0x3000, 0x30FF) + r(0x31F0, 0x31FF) + r(0xFF01, 0xFF9F) + jis_level1()),
]

os.makedirs(OUT, exist_ok=True)
for out, src, axes, cps in FONTS:
    f = TTFont(os.path.join(SRC, src))
    if axes: f = instancer.instantiateVariableFont(f, {k: v for k, v in axes.items() if k in [a.axisTag for a in f['fvar'].axes]})
    opts = subset.Options(); opts.flavor = 'woff'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
    s = subset.Subsetter(opts); s.populate(unicodes=sorted(set(cps + PUNCT))); s.subset(f)
    fam = 'FH Script ' + out[9:-5]
    for rec in f['name'].names:
        if rec.nameID in (1, 4, 16): rec.string = fam
        elif rec.nameID == 6: rec.string = fam.replace(' ', '')
        elif rec.nameID == 3: rec.string = fam + ' (subset)'
    f.flavor = 'woff'; f.save(os.path.join(OUT, out))
    print(f'{out:30s} {os.path.getsize(os.path.join(OUT, out)) / 1024:8.0f} KB  from {src}')
