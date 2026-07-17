#!/bin/bash
# Incrementa o patch da versão em src/constants/version.ts
# Uso: bash scripts/bump-version.sh

FILE="src/constants/version.ts"

current=$(grep "APP_VERSION" "$FILE" | grep -oE "v[0-9]+\.[0-9]+\.[0-9]+" | head -1)
if [ -z "$current" ]; then
  echo "❌ Versão não encontrada em $FILE"
  exit 1
fi

major=$(echo "$current" | cut -d. -f1 | tr -d 'v')
minor=$(echo "$current" | cut -d. -f2)
patch=$(echo "$current" | cut -d. -f3)
new_patch=$((patch + 1))
new_version="v${major}.${minor}.${new_patch}"

python3 -c "
import re, sys
content = open('${FILE}').read()
updated = content.replace('${current}', '${new_version}')
open('${FILE}', 'w').write(updated)
"
echo "✅ Versão atualizada: ${current} → ${new_version}"
