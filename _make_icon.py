"""Nod icon v2: icon.png(深藏青方块) + icon-clear.png(透明) → 多尺寸 PNG + ICO。"""
import os
from PIL import Image

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'desktop', 'assets')
SIZES = [16, 24, 32, 48, 64, 128, 256]

img = Image.open(os.path.join(out_dir, 'icon.png')).convert('RGBA')
# ICO 含全部尺寸
img.save(os.path.join(out_dir, 'icon.ico'), sizes=[(s, s) for s in SIZES])
print('saved icon.ico', SIZES)

# 多尺寸 PNG: 深藏青方块版 + 透明版(16/24/32/48 任务栏)
clear = Image.open(os.path.join(out_dir, 'icon-clear.png')).convert('RGBA')
for s in (16, 24, 32, 48):
    img.resize((s, s), Image.LANCZOS).save(os.path.join(out_dir, f'icon-{s}.png'))
    clear.resize((s, s), Image.LANCZOS).save(os.path.join(out_dir, f'icon-clear-{s}.png'))
    print(f'saved icon-{s}.png + icon-clear-{s}.png')

# 透明版大图
clear.resize((256, 256), Image.LANCZOS).save(os.path.join(out_dir, 'icon-clear.png'))
print('done')
