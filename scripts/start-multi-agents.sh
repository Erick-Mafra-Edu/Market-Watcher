#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p logs/agents docs/agents/results docs/tasks
: > logs/agents/pids.txt

if ! command -v copilot >/dev/null 2>&1; then
  echo "ERROR: copilot CLI not found in PATH."
  exit 1
fi

if ! copilot --version >/dev/null 2>&1; then
  echo "ERROR: copilot CLI is installed but not ready. Run: copilot login"
  exit 1
fi

run_agent() {
  local name="$1"
  local output_file="$2"
  local log_file="$3"
  local prompt="$4"

  copilot \
    --model gpt-5.3-codex \
    --allow-all-tools \
    --no-color \
    -p "$prompt" \
    >"$log_file" 2>&1 &

  local pid=$!
  echo "$name $pid $log_file $output_file" >> logs/agents/pids.txt
  echo "started: $name (pid=$pid)"
}

run_agent \
  "gap-features" \
  "docs/agents/results/gap-features.md" \
  "logs/agents/gap-features.log" \
  "Analyze /workspaces/Market-Watcher and write docs/agents/results/gap-features.md with missing functional capabilities, evidence by file path, and MVP priority. Keep concise and actionable."

run_agent \
  "gap-tests" \
  "docs/agents/results/gap-tests.md" \
  "logs/agents/gap-tests.log" \
  "Analyze communication test coverage in /workspaces/Market-Watcher and write docs/agents/results/gap-tests.md with P0/P1/P2 backlog. Focus on RabbitMQ contracts and service integration."

run_agent \
  "communication-task" \
  "docs/tasks/communication.md" \
  "logs/agents/communication-task.log" \
  "Update docs/tasks/communication.md with the current communication architecture from code (RabbitMQ, HTTP, DB), producer-consumer matrix, and test-first acceptance criteria. Use concrete file references."

run_agent \
  "docs-reconcile" \
  "docs/agents/results/docs-reconcile.md" \
  "logs/agents/docs-reconcile.log" \
  "Compare DECISOES_DE_ARQUITETURA.md, STATUS_ENTREGAS_E_TESTES_FUTUROS.md, SERVICE_ARCHITECTURE.md with current implementation and write docs/agents/results/docs-reconcile.md listing divergences and suggested doc updates."

cat <<'EOF'

All agents started.

Monitor logs:
  tail -f logs/agents/gap-features.log
  tail -f logs/agents/gap-tests.log
  tail -f logs/agents/communication-task.log
  tail -f logs/agents/docs-reconcile.log

List processes:
  cat logs/agents/pids.txt
  ps -fp $(awk '{print $2}' logs/agents/pids.txt | paste -sd, -)

EOF