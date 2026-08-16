#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""从 app.asar 提取指定文件 (asar 格式: 头pickle+JSON树+文件数据)"""
import struct, json, sys, os

def parse_header(path):
    with open(path, 'rb') as f:
        head = f.read(8)
        header_size = struct.unpack('<I', head[4:8])[0]
        header_buf = f.read(header_size)
        # 字符串 pickle: [4: payload_size][4: string_len][string_bytes]
        json_len = struct.unpack('<I', header_buf[4:8])[0]
        header_str = header_buf[8:8 + json_len].decode('utf-8')
        header = json.loads(header_str)
        data_start = 8 + header_size
    return header, data_start

def find_node(header, parts):
    node = header
    for p in parts:
        node = node['files'][p]
    return node

def extract(asar_path, target, out_path):
    header, data_start = parse_header(asar_path)
    parts = [p for p in target.replace('\\', '/').split('/') if p]
    node = find_node(header, parts)
    if 'files' in node:  # 是目录
        raise ValueError(f'{target} 是目录')
    size = node['size']
    offset = int(node['offset'])
    with open(asar_path, 'rb') as f:
        f.seek(data_start + offset)
        data = f.read(size)
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    with open(out_path, 'wb') as f:
        f.write(data)
    print(f'OK: {target} -> {out_path} ({size} bytes)')

if __name__ == '__main__':
    asar = r'C:\Users\chenm\Desktop\interview-pilot\LockedIn\resources\app.asar'
    outdir = r'C:\Users\chenm\Desktop\interview-pilot\lockedin-ref'
    targets = sys.argv[1:] or [
        'build/static/css/main.1922fc7f.css',
        'src/components/layout/CopilotPanel.react.js',
        'src/components/ui-style/CopilotTextBoxv3.react.js',
        'src/components/ui-style/CopilotIndicator.react.js',
    ]
    for t in targets:
        try:
            extract(asar, t, os.path.join(outdir, os.path.basename(t)))
        except Exception as e:
            print(f'FAIL: {t} - {e}')
