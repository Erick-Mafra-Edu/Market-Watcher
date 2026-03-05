#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p logs/agents-round2 docs/tasks
: > logs/agents-round2/pids.txt

if ! command -v copilot >/dev/null 2>&1; then
  echo "ERROR: copilot CLI not found in PATH."
  exit 1
fi

run_agent() {
  local name="$1"
  local log_file="$2"
  local prompt="$3"

  copilot \
    --model gpt-5.3-codex \
    --allow-all-tools \
    --no-color \
    -p "$prompt" \
    >"$log_file" 2>&1 &

  local pid=$!
  echo "$name $pid $log_file" >> logs/agents-round2/pids.txt
  echo "started: $name (pid=$pid)"
}

run_agent \
  "task-p0-features" \
  "logs/agents-round2/task-p0-features.log" \
  "Using docs/agents/results/gap-features.md, write docs/tasks/p0-features.md with implementation-ready tasks, acceptance criteria, touched files, and execution order. Keep MVP-first."

run_agent \
  "task-communication-tests" \
  "logs/agents-round2/task-communication-tests.log" \
  "Using docs/agents/results/gap-tests.md and docs/tasks/communication.md, write docs/tasks/communication-tests.md with P0/P1/P2 test tasks, concrete test files, and definition of done."

run_agent \
  "task-doc-sync" \
  "logs/agents-round2/task-doc-sync.log" \
  "Using docs/agents/results/docs-reconcile.md, write docs/tasks/doc-sync.md listing exact documentation updates by file and section, with priority and owner suggestion."

run_agent \
  "task-master-plan" \
  "logs/agents-round2/task-master-plan.log" \
  "Read docs/tasks/p0-features.md, docs/tasks/communication-tests.md, docs/tasks/doc-sync.md and produce docs/tasks/master-execution-plan.md with parallelizable agent lanes, dependencies, and checkpoints."

cat <<'EOF'

Round 2 agents started.

Monitor logs:
  tail -f logs/agents-round2/task-p0-features.log
  tail -f logs/agents-round2/task-communication-tests.log
  tail -f logs/agents-round2/task-doc-sync.log
  tail -f logs/agents-round2/task-master-plan.log

List processes:
  cat logs/agents-round2/pids.txt
  ps -fp $(awk '{print $2}' logs/agents-round2/pids.txt | paste -sd, -)

EOF