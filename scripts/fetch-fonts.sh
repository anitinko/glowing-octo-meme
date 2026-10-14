#!/usr/bin/env bash
# Downloads static TTF instances (with Cyrillic) from the Google Fonts CSS API.
# A non-browser user agent makes the API return plain truetype files instead of split woff2.
set -euo pipefail
cd "$(dirname "$0")/../assets/fonts"

fetch() { # family-query  file-prefix
  local css
  css=$(curl -fsSL -A "Wget/1.0" "https://fonts.googleapis.com/css2?family=$1&display=swap")
  # Each @font-face block: font-style, font-weight, src url
  echo "$css" | awk -v prefix="$2" '
    /font-style/ { gsub(/[;: ]|font-style/, ""); style=$0 }
    /font-weight/ { gsub(/[;: ]|font-weight/, ""); weight=$0 }
    /src:/ { match($0, /https:[^)]+/); url=substr($0, RSTART, RLENGTH);
             suffix = (style == "italic") ? "i" : "";
             print url, prefix "-" weight suffix ".ttf" }
  ' | while read -r url file; do
    [ -s "$file" ] || curl -fsSL "$url" -o "$file"
    echo "  $file"
  done
}

fetch "Unbounded:wght@200;300;400;500;600;700;800;900" Unbounded
fetch "JetBrains+Mono:ital,wght@0,400;0,500;0,700;0,800;1,400" JetBrainsMono
fetch "Manrope:wght@400;500;600;700;800" Manrope
fetch "Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900" Playfair
