include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-lan-wake
PKG_VERSION:=1.1.1
PKG_RELEASE:=1

LUCI_TITLE:=Wake-on-LAN
LUCI_DEPENDS:=+luci-base +rpcd +etherwake
LUCI_PKGARCH:=all

PKG_LICENSE:=MIT
PKG_MAINTAINER:=chenyu <admin@chenyu.cc>

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	chmod 755 /usr/libexec/lan-wake-update-mac-vendors.sh 2>/dev/null
	chmod 755 /usr/libexec/rpcd/lan-wake 2>/dev/null
	chmod 755 /etc/uci-defaults/90_luci-app-lan-wake 2>/dev/null
	[ -x /etc/uci-defaults/90_luci-app-lan-wake ] && /etc/uci-defaults/90_luci-app-lan-wake
	rm -f /tmp/luci-indexcache 2>/dev/null || true
	/etc/init.d/rpcd restart >/dev/null 2>&1 || true
	rm -f /tmp/luci-indexcache 2>/dev/null || true
}
exit 0
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/lan_wake
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
