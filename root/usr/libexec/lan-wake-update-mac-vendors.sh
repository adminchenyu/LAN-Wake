#!/bin/sh
#
# Download and parse Wireshark's MAC vendor database for LAN-Wake.
# Failures are intentionally ignored so device scanning can continue offline.

set -u

RUNDIR="/tmp/lan-wake"
CACHE="$RUNDIR/mac-vendors.tsv"
STAMP="$RUNDIR/mac-vendors.last"
URL="https://www.wireshark.org/download/automated/data/manuf.gz"
TODAY="$(date +%F 2>/dev/null)"

mkdir -p "$RUNDIR" 2>/dev/null || exit 0

[ -n "$TODAY" ] || exit 0

if [ -s "$CACHE" ] && [ -r "$STAMP" ] && [ "$(cat "$STAMP" 2>/dev/null)" = "$TODAY" ]; then
	exit 0
fi

TMP_GZ="$RUNDIR/manuf.gz.$$"
TMP_TXT="$RUNDIR/manuf.txt.$$"
TMP_TSV="$RUNDIR/mac-vendors.tsv.$$"

cleanup() {
	rm -f "$TMP_GZ" "$TMP_TXT" "$TMP_TSV" 2>/dev/null
}
trap cleanup EXIT INT TERM

fetch_ok=0
if command -v uclient-fetch >/dev/null 2>&1; then
	uclient-fetch -T 5 -O "$TMP_GZ" "$URL" >/dev/null 2>&1 && fetch_ok=1
fi
if [ "$fetch_ok" -ne 1 ] && command -v wget >/dev/null 2>&1; then
	wget -T 5 -O "$TMP_GZ" "$URL" >/dev/null 2>&1 && fetch_ok=1
fi

[ "$fetch_ok" -eq 1 ] && [ -s "$TMP_GZ" ] || exit 0

if command -v gzip >/dev/null 2>&1; then
	gzip -dc "$TMP_GZ" > "$TMP_TXT" 2>/dev/null || exit 0
elif command -v zcat >/dev/null 2>&1; then
	zcat "$TMP_GZ" > "$TMP_TXT" 2>/dev/null || exit 0
else
	exit 0
fi

[ -s "$TMP_TXT" ] || exit 0

awk '
	function trim(s) {
		gsub(/^[ \t]+|[ \t]+$/, "", s)
		return s
	}
	/^[ \t]*$/ { next }
	/^[ \t]*#/ { next }
	{
		prefix = $1
		short_name = $2
		full_name = ""
		if (NF > 2) {
			for (i = 3; i <= NF; i++)
				full_name = full_name (full_name ? " " : "") $i
		}

		bits = 24
		if (index(prefix, "/") > 0) {
			split(prefix, p, "/")
			prefix = p[1]
			if (p[2] ~ /^[0-9]+$/)
				bits = p[2] + 0
		}

		gsub(/:/, "", prefix)
		gsub(/-/, "", prefix)
		prefix = toupper(prefix)
		if (prefix !~ /^[0-9A-F]+$/)
			next

		chars = int((bits + 3) / 4)
		if (chars < 1 || length(prefix) < chars)
			next
		prefix = substr(prefix, 1, chars)

		vendor = short_name ? short_name : full_name
		vendor = trim(vendor)
		if (!vendor)
			next

		gsub(/\t/, " ", vendor)
		print prefix "\t" bits "\t" vendor
	}
' "$TMP_TXT" > "$TMP_TSV" 2>/dev/null || exit 0

[ -s "$TMP_TSV" ] || exit 0

mv "$TMP_TSV" "$CACHE" 2>/dev/null || exit 0
printf '%s\n' "$TODAY" > "$STAMP" 2>/dev/null || true
exit 0
