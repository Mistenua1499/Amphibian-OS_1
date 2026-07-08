#!/usr/bin/env bash
# ============================================================
# AMPHIBIAN OS - SMOKE TEST
# Corre esto despues de CUALQUIER cambio al backend.
# Uso: bash scripts/smoke.sh
# ============================================================
set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-4100}"
BASE="http://localhost:$PORT"
FAILS=0

check() { # check <nombre> <cmd que imprime resultado o falla>
  if OUT=$(eval "$2" 2>&1); then
    echo "  ✅ $1: $OUT"
  else
    echo "  ❌ $1: $OUT"
    FAILS=$((FAILS+1))
  fi
}

echo "🐸 Smoke test Amphibian OS"
echo "→ Levantando server temporal en :$PORT ..."
PORT=$PORT npx tsx server/src/index.ts > /tmp/amphibian-smoke.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

for i in $(seq 1 20); do
  curl -s "$BASE/api/ping" > /dev/null 2>&1 && break
  sleep 0.5
done

check "ping" "curl -sf $BASE/api/ping | grep -o '\"ok\":true'"
check "dashboard" "curl -sf $BASE/api/dashboard | python3 -c \"import json,sys; d=json.load(sys.stdin); print('dinero pendiente \$' + str(d['money']['total']), '| pipeline stages:', len(d['pipeline']))\""
check "reglas de recordatorios" "curl -sf -X POST $BASE/api/reminders/run | python3 -c \"import json,sys; print(json.load(sys.stdin)['created'], 'creados')\""
check "listar recordatorios" "curl -sf $BASE/api/reminders | python3 -c \"import json,sys; print(len(json.load(sys.stdin)), 'pendientes')\""
check "captura texto (sin IA no truena)" "curl -sf -X POST $BASE/api/captures -H 'content-type: application/json' -d '{\"raw\":\"prueba smoke: hablé con Mich sobre el video\"}' | python3 -c \"import json,sys; d=json.load(sys.stdin); print('id', d['capture']['id'][:8])\""
check "listar personas" "curl -sf '$BASE/api/entities?type=PERSONA' | python3 -c \"import json,sys; print(len(json.load(sys.stdin)), 'personas')\""
check "detalle persona con timeline" "MICH=\$(curl -s '$BASE/api/entities?type=PERSONA&q=Mich' | python3 -c \"import json,sys; print(json.load(sys.stdin)[0]['id'])\") && curl -sf $BASE/api/entities/\$MICH | python3 -c \"import json,sys; d=json.load(sys.stdin); print(d['name'], '| timeline', len(d['timeline']), '| opps', len(d['opportunities']))\""
check "crear oportunidad" "curl -sf -X POST $BASE/api/opportunities -H 'content-type: application/json' -d '{\"name\":\"SMOKE opp\",\"value\":1000,\"stage\":\"LEAD\"}' | python3 -c \"import json,sys; print(json.load(sys.stdin)['name'])\""
check "mover etapa (kanban)" "ID=\$(curl -s $BASE/api/opportunities | python3 -c \"import json,sys; print([o['id'] for o in json.load(sys.stdin) if o['name']=='SMOKE opp'][0])\") && curl -sf -X POST $BASE/api/opportunities/\$ID/stage -H 'content-type: application/json' -d '{\"stage\":\"PROPUESTA\"}' | python3 -c \"import json,sys; print(json.load(sys.stdin)['stage'])\""
check "borrar oportunidad smoke" "ID=\$(curl -s $BASE/api/opportunities | python3 -c \"import json,sys; print([o['id'] for o in json.load(sys.stdin) if o['name']=='SMOKE opp'][0])\") && curl -sf -X DELETE $BASE/api/opportunities/\$ID | grep -o '\"ok\":true'"
check "guardar bitácora" "curl -sf -X POST $BASE/api/journal -H 'content-type: application/json' -d '{\"date\":\"2020-01-01\",\"whatHappened\":\"smoke test\",\"wins\":\"probé el sistema\"}' | python3 -c \"import json,sys; print(json.load(sys.stdin)['date'])\""
check "salud manual" "curl -sf -X POST $BASE/api/health -H 'content-type: application/json' -d '{\"date\":\"2020-01-01\",\"sleepHours\":7.5,\"stress\":40}' | python3 -c \"import json,sys; print('sueño', json.load(sys.stdin)['sleepHours'], 'h')\""
check "sync status" "curl -sf $BASE/api/sync/status | python3 -c \"import json,sys; d=json.load(sys.stdin); print(d['pending'], 'pendientes de sync')\""
check "google status" "curl -sf $BASE/api/google/status | python3 -c \"import json,sys; d=json.load(sys.stdin); print('configured:', d['configured'], '| connected:', d['connected'])\""
check "finanzas" "curl -sf $BASE/api/finances | python3 -c \"import json,sys; print(len(json.load(sys.stdin)), 'movimientos')\""

echo
if [ "$FAILS" -eq 0 ]; then
  echo "🎉 TODO PASÓ. El backend está sano."
  exit 0
else
  echo "💥 $FAILS pruebas fallaron. Revisa /tmp/amphibian-smoke.log"
  exit 1
fi
