#!/usr/bin/env bash
# Verifica que ningún secreto del servidor haya terminado en el código que
# se manda al navegador (.next/static).
#
# Cómo funciona: el CI hace el build con valores "canario" en las variables
# secretas. Si alguno aparece en .next/static, un componente de cliente leyó
# un secreto y el CI falla. Es una segunda barrera además de "server-only".
# Uso: scripts/check-client-bundle.sh VALOR1 [VALOR2 ...]
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d .next/static ]; then
  echo "No existe .next/static: corré npm run build primero." >&2
  exit 1
fi
if [ "$#" -eq 0 ]; then
  echo "Pasá al menos un valor canario." >&2
  exit 1
fi

found=0
for canary in "$@"; do
  if grep -rqF -- "$canary" .next/static; then
    # No imprimimos el valor: en un uso real podría ser un secreto.
    echo "ERROR: un valor secreto aparece en el bundle del navegador." >&2
    found=1
  fi
done

if [ "$found" -ne 0 ]; then exit 1; fi
echo "OK: ningún secreto en .next/static."
