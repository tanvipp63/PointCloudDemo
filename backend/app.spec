# -*- mode: python ; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules
block_cipher = None

here = os.path.abspath(os.path.dirname(__name__))

pathex = [ here ]

datas = collect_data_files('vedo')

hiddenimports = collect_submodules('vedo')

utils_dir = os.path.join(here, 'utils')

def collect_dir(src_dir, dest_folder):
    items = []
    if not os.path.exists(src_dir):
        return items
    for root, _, files in os.walk(src_dir):
        for fn in files:
            srcf = os.path.join(root, fn)
            # destination should preserve subdirectory structure under dest_folder
            rel = os.path.relpath(srcf, src_dir)
            dest = os.path.join(dest_folder, rel)
            items.append((srcf, dest))
    return items

datas += collect_dir(utils_dir, 'utils')

try:
    hiddenimports += collect_submodules('utils')
except Exception:
    pass

a = Analysis(
    ['app.py'],
    pathex=pathex,
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    exclude_binaries=False,
    name='app',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
