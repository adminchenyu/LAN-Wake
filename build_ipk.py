#!/usr/bin/env python3
import gzip
import io
import os
import shutil
import tarfile
import time
from pathlib import Path

PKG = "luci-app-lan-wake"
VERSION = "1.1.1"
RELEASE = "1"
ARCH = "all"

ROOT = Path(__file__).resolve().parent
SRC = ROOT
DIST = ROOT / "dist"
TMP = ROOT / f".ipk-build-{PKG}-{VERSION}-{int(time.time())}"


def add_text(tar, name, text, mode=0o644):
    data = text.encode("utf-8")
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mode = mode
    info.uid = 0
    info.gid = 0
    info.uname = "root"
    info.gname = "root"
    info.mtime = int(time.time())
    tar.addfile(info, io.BytesIO(data))


def add_file(tar, source, arcname, mode=None):
    source = Path(source)
    info = tar.gettarinfo(str(source), arcname)
    info.uid = 0
    info.gid = 0
    info.uname = "root"
    info.gname = "root"
    if mode is not None:
        info.mode = mode
    with source.open("rb") as f:
        tar.addfile(info, f)


def add_tree(tar, base):
    base = Path(base)
    for path in sorted(base.rglob("*")):
        rel = path.relative_to(base).as_posix()
        if path.is_dir():
            info = tarfile.TarInfo(rel)
            info.type = tarfile.DIRTYPE
            info.mode = 0o755
            info.uid = 0
            info.gid = 0
            info.uname = "root"
            info.gname = "root"
            info.mtime = int(time.time())
            tar.addfile(info)
            continue
        mode = 0o644
        if rel in {
            "etc/uci-defaults/90_luci-app-lan-wake",
            "usr/libexec/lan-wake-update-mac-vendors.sh",
            "usr/libexec/rpcd/lan-wake",
        }:
            mode = 0o755
        add_file(tar, path, rel, mode)


def gz_tar(path, writer):
    with gzip.GzipFile(filename="", mode="wb", fileobj=path.open("wb"), mtime=int(time.time())) as gz:
        with tarfile.open(fileobj=gz, mode="w", format=tarfile.GNU_FORMAT) as tar:
            writer(tar)


def add_binary(tar, name, data, mode=0o644):
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mode = mode
    info.uid = 0
    info.gid = 0
    info.uname = "root"
    info.gname = "root"
    info.mtime = int(time.time())
    tar.addfile(info, io.BytesIO(data))


def write_ar_member(out, name, data, mode=0o100644):
    if name.startswith("./"):
        name = name[2:]
    if not name.endswith("/"):
        name = name + "/"
    if len(name) > 16:
        raise ValueError(f"ar member name too long: {name}")
    header = (
        f"{name:<16}"
        f"{int(time.time()):<12}"
        f"{0:<6}"
        f"{0:<6}"
        f"{mode:<8o}"
        f"{len(data):<10}"
        "`\n"
    ).encode("ascii")
    if len(header) != 60:
        raise ValueError("invalid ar header size")
    out.write(header)
    out.write(data)
    if len(data) % 2:
        out.write(b"\n")


def main():
    DIST.mkdir(exist_ok=True)
    TMP.mkdir()

    control_text = (
        f"Package: {PKG}\n"
        f"Version: {VERSION}-{RELEASE}\n"
        f"Architecture: {ARCH}\n"
        "Maintainer: chenyu <admin@chenyu.cc>\n"
        "Section: luci\n"
        "Priority: optional\n"
        "Depends: luci-base, rpcd, etherwake\n"
        "Description: Wake-on-LAN LuCI app for iStoreOS / OpenWrt\n"
    )
    postinst_text = (
        "#!/bin/sh\n"
        "[ -f /usr/libexec/lan-wake-update-mac-vendors.sh ] && chmod 755 /usr/libexec/lan-wake-update-mac-vendors.sh\n"
        "[ -f /usr/libexec/rpcd/lan-wake ] && chmod 755 /usr/libexec/rpcd/lan-wake\n"
        "[ -f /etc/uci-defaults/90_luci-app-lan-wake ] && chmod 755 /etc/uci-defaults/90_luci-app-lan-wake\n"
        "[ -x /etc/uci-defaults/90_luci-app-lan-wake ] && /etc/uci-defaults/90_luci-app-lan-wake\n"
        "rm -f /tmp/luci-indexcache 2>/dev/null || true\n"
        "/etc/init.d/rpcd restart >/dev/null 2>&1 || true\n"
        "rm -f /tmp/luci-indexcache 2>/dev/null || true\n"
        "exit 0\n"
    )
    conffiles_text = "/etc/config/lan_wake\n"

    control_tgz = TMP / "control.tar.gz"
    data_tgz = TMP / "data.tar.gz"
    debian_binary = TMP / "debian-binary"

    gz_tar(control_tgz, lambda tar: (add_text(tar, "./control", control_text), add_text(tar, "./postinst", postinst_text, 0o755), add_text(tar, "./conffiles", conffiles_text)))

    data_root = TMP / "data-root"
    shutil.copytree(SRC / "root", data_root)
    view_dir = data_root / "www" / "luci-static" / "resources" / "view"
    view_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SRC / "htdocs" / "luci-static" / "resources" / "view" / "lan-wake.js", view_dir / "lan-wake.js")
    i18n_dir = data_root / "usr" / "lib" / "lua" / "luci" / "i18n"
    i18n_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SRC / "po" / "zh-cn" / "lan-wake.po", i18n_dir / "lan-wake.zh-cn.po")
    gz_tar(data_tgz, lambda tar: add_tree(tar, data_root))

    debian_binary.write_bytes(b"2.0\r\n")

    ipk = DIST / f"{PKG}_{VERSION}-{RELEASE}_{ARCH}.ipk"
    gz_tar(
        ipk,
        lambda tar: (
            add_binary(tar, "./debian-binary", debian_binary.read_bytes()),
            add_binary(tar, "./control.tar.gz", control_tgz.read_bytes()),
            add_binary(tar, "./data.tar.gz", data_tgz.read_bytes()),
        ),
    )
    print(ipk)
    shutil.rmtree(TMP, ignore_errors=True)


if __name__ == "__main__":
    main()
