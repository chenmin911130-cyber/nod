"""打包客户发布包：安装版 + 绿色版 + 中英文档 + SHA-256 校验 + RELEASE 元数据 → 单一 zip。

用法（完整链路）：
  1. 打引擎：      env -u PYTHONPATH .venv/Scripts/python.exe -m PyInstaller --noconfirm --clean \
                    --name nod-engine --onedir \
                    --collect-all sounddevice --collect-all soundcard \
                    --exclude-module keyboard faster_whisper av ctranslate2 onnxruntime \
                    tokenizers hf_xet tqdm huggingface_hub app.py
  2. 放客户配置：  cp config.client.json dist/nod-engine/_internal/config.json
                  cp secrets.client.json dist/nod-engine/_internal/secrets.json
  3. 打安装包：    cd desktop && npx electron-builder --win
  4. 出发布包：    python _make_client_zip.py

输出：release/Nod-<version>-Client-Package.zip（唯一正式候选包）
"""
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
DESKTOP = os.path.join(ROOT, "desktop")
BUILD_DIR = os.path.join(DESKTOP, "release")     # electron-builder 输出目录
PUBLISH_ROOT = os.path.join(ROOT, "release")     # 仓库根 canonical 发布目录


def get_version():
    with open(os.path.join(DESKTOP, "package.json"), encoding="utf-8") as f:
        return json.load(f)["version"]


def git_commit():
    try:
        out = subprocess.run(["git", "-C", ROOT, "rev-parse", "--short", "HEAD"],
                             capture_output=True, text=True, timeout=5)
        return out.stdout.strip() if out.returncode == 0 else None
    except Exception:
        return None


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def md_to_txt(md_path):
    lines = []
    for raw in open(md_path, encoding="utf-8"):
        line = raw.rstrip()
        s = line.strip()
        if s.startswith("# "):
            lines.append(s[2:])
            lines.append("=" * len(s[2:]))
        elif s.startswith("## "):
            lines.append("")
            lines.append(s[3:])
            lines.append("-" * len(s[3:]))
        elif s.startswith("|") and "---" not in s:
            lines.append(s.strip("|").replace("|", "  "))
        elif s.startswith("> "):
            lines.append(s[2:])
        elif s.startswith("- "):
            lines.append("  • " + s[2:])
        elif re.match(r"^\d+\. ", s):
            lines.append("  " + s)
        else:
            lines.append(re.sub(r"\*\*|`", "", s))
    return "\n".join(lines)


def main():
    version = get_version()
    staging = os.path.join(PUBLISH_ROOT, f"Nod-{version}")
    if os.path.exists(staging):
        shutil.rmtree(staging)
    os.makedirs(staging)

    # 1) 二进制：安装版 + 绿色版（electron-builder 产物，版本随 package.json）
    missing = []
    for src, note in [
        (os.path.join(BUILD_DIR, f"Nod Setup {version}.exe"), "安装版"),
        (os.path.join(BUILD_DIR, f"Nod {version}.exe"), "绿色版"),
    ]:
        if os.path.exists(src):
            shutil.copy(src, staging)
            print("copied", os.path.basename(src))
        else:
            missing.append(note)
    if missing:
        print("!! 缺少二进制产物:", ", ".join(missing), "(先跑 electron-builder)")

    # 2) 文档：中英 → 纯文本
    for src, name in [
        ("docs/客户安装说明.md", "客户安装说明.txt"),
        ("DISCLAIMER.md", "免责声明.txt"),
        ("docs/CUSTOMER_GUIDE.md", "CUSTOMER_GUIDE.txt"),
        ("docs/DISCLAIMER_EN.md", "DISCLAIMER.txt"),
        ("LICENSE", "LICENSE.txt"),
    ]:
        p = os.path.join(ROOT, src)
        if not os.path.exists(p):
            print("!! 缺少文档", src)
            continue
        txt = md_to_txt(p) if src.endswith(".md") else open(p, encoding="utf-8").read()
        with open(os.path.join(staging, name), "w", encoding="utf-8") as f:
            f.write(txt)
        print("generated", name)

    # 3) SHA-256 校验（覆盖 exe + 文档）
    sums = []
    for fn in sorted(os.listdir(staging)):
        fp = os.path.join(staging, fn)
        if os.path.isfile(fp):
            sums.append(f"{sha256(fp)}  {fn}")
    with open(os.path.join(staging, "SHA256SUMS.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(sums) + "\n")

    # 4) RELEASE 元数据（版本 / 构建时间 / Git 提交 / 变更日志）
    commit = git_commit()
    build_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = [
        f"Nod {version} — Release Notes",
        "=" * 40,
        f"Version:    {version}",
        f"Build time: {build_time}",
        f"Git commit: {commit or '(not a git repository)'}",
        "",
        "Changelog:  see CHANGELOG.md in the source repo.",
        "",
        "Verify integrity:  certutil -hashfile <file> SHA256  (Windows)",
        "",
        "SHA-256:",
    ]
    with open(os.path.join(staging, "RELEASE.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(header) + "\n")
        f.write("\n".join(sums) + "\n")

    # 5) 单一候选包 zip
    zip_path = os.path.join(PUBLISH_ROOT, f"Nod-{version}-Client-Package.zip")
    if os.path.exists(zip_path):
        os.remove(zip_path)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fn in sorted(os.listdir(staging)):
            zf.write(os.path.join(staging, fn), fn)

    print("ZIP:", zip_path, round(os.path.getsize(zip_path) / 1024 / 1024, 1), "MB")
    # 保留 staging 目录便于核对；只 zip 一个正式候选包


if __name__ == "__main__":
    main()
