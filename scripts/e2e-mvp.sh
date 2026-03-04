#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export COMPOSE_PROJECT_NAME="market-watcher-e2e"
COMPOSE_ARGS="-f docker-compose.yml -f docker-compose.e2e.yml"
export SMTP_HOST="mailhog"
export SMTP_PORT="1025"
export SMTP_SECURE="false"
export NOTIFICATION_CHANNEL_MODE="email-only"
export JWT_SECRET="e2e-test-secret"
export RABBITMQ_USER="${RABBITMQ_USER:-admin}"
export RABBITMQ_PASS="${RABBITMQ_PASS:-admin}"

cleanup() {
  docker compose $COMPOSE_ARGS down -v --remove-orphans || true
}
trap cleanup EXIT

for container_name in market-watcher-db market-watcher-rabbitmq market-watcher-mailhog market-watcher-api-handler market-watcher-notifier market-watcher-web; do
  docker rm -f "$container_name" >/dev/null 2>&1 || true
done

echo "[E2E] Starting services..."
docker compose $COMPOSE_ARGS up -d --build database rabbitmq mailhog notifier-service api-handler web-app

wait_for_http() {
  local url="$1"
  local timeout_seconds="${2:-120}"
  local elapsed=0

  until curl -fsS "$url" >/dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if (( elapsed >= timeout_seconds )); then
      echo "[E2E] Timeout waiting for $url"
      return 1
    fi
  done
}

wait_for_rabbit() {
  local timeout_seconds="${1:-120}"
  local elapsed=0

  until curl -fsS -u "${RABBITMQ_USER}:${RABBITMQ_PASS}" "http://localhost:15672/api/overview" >/dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if (( elapsed >= timeout_seconds )); then
      echo "[E2E] Timeout waiting for authenticated RabbitMQ API"
      return 1
    fi
  done
}

publish_queue_message() {
  local queue="$1"
  local payload_json="$2"

  python - "$queue" "$payload_json" <<'PY' | curl -fsS -u "${RABBITMQ_USER:-admin}:${RABBITMQ_PASS:-admin}" \
    -H 'content-type: application/json' \
    -X POST "http://localhost:15672/api/exchanges/%2F/amq.default/publish" \
    -d @- >/dev/null
import json
import sys
queue = sys.argv[1]
payload = json.loads(sys.argv[2])
print(json.dumps({
    "properties": {},
    "routing_key": queue,
    "payload": json.dumps(payload),
    "payload_encoding": "string"
}))
PY
}

extract_json_field() {
  local json_input="$1"
  local field="$2"
  printf '%s' "$json_input" | python -c 'import json,sys
field=sys.argv[1]
obj=json.load(sys.stdin)
value=obj.get(field)
if value is None:
    raise SystemExit(1)
print(value)
' "$field"
}

echo "[E2E] Waiting for RabbitMQ and Web App..."
wait_for_rabbit 120
wait_for_http "http://localhost:3000/health" 120

EMAIL="e2e.$(date +%s)@example.com"
PASSWORD="123456"
NAME="E2E User"

REGISTER_RESPONSE=$(curl -fsS -X POST "http://localhost:3000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$NAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(extract_json_field "$REGISTER_RESPONSE" "token")
AUTH_HEADER="Authorization: Bearer ${TOKEN}"

echo "[E2E] Register and watchlist setup..."
curl -fsS -X POST "http://localhost:3000/api/watchlist" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"symbol":"PETR4","minPriceChange":5}' >/dev/null

echo "[E2E] Publishing news, fundamentals and price updates..."
for i in 1 2 3; do
  publish_queue_message "news_queue" "{\"title\":\"Market update $i\",\"description\":\"stock market gains today\",\"url\":\"https://example.com/news-$i-$(date +%s)\",\"source\":\"E2E\",\"published_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"topic\":\"stock market\"}"
done

publish_queue_message "fundamentals_queue" "{\"symbol\":\"PETR4\",\"dividend_yield\":6.5,\"p_vp\":1.8,\"p_l\":10.2,\"roe\":20.1,\"liquidity\":1500000,\"scraped_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
publish_queue_message "price_updates" "{\"symbol\":\"PETR4\",\"price\":38.12,\"changePercent\":7.4,\"volume\":25000000,\"marketCap\":120000000000,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

echo "[E2E] Waiting for alert generation..."
for attempt in {1..30}; do
  ALERTS_RESPONSE=$(curl -fsS "http://localhost:3000/api/alerts" -H "$AUTH_HEADER")
  ALERT_COUNT=$(printf '%s' "$ALERTS_RESPONSE" | python -c 'import json,sys
obj=json.load(sys.stdin)
print(len(obj.get("alerts", [])))
')

  if [[ "$ALERT_COUNT" -ge 1 ]]; then
    echo "[E2E] Success: alert generated and available in API"
    exit 0
  fi

  sleep 2
done

echo "[E2E] Failed: no alerts generated within expected time"
exit 1
