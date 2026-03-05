# Multi-Agent Execution Roadmap

## Objective

Run 4 Copilot CLI agents in parallel and track execution in VS Code terminals/logs.

## Agent Set

1. `gap-features`: map missing features with file evidence and MVP priority.
2. `gap-tests`: map test gaps and produce P0/P1/P2 test backlog.
3. `communication-task`: draft `/docs/tasks/communication.md` from real code flows.
4. `docs-reconcile`: find divergence between docs and implementation.

## Status Board

| Agent | Status | Output File | Log File |
|---|---|---|---|
| gap-features | done | `docs/agents/results/gap-features.md` | `logs/agents/gap-features.log` |
| gap-tests | done | `docs/agents/results/gap-tests.md` | `logs/agents/gap-tests.log` |
| communication-task | done | `docs/tasks/communication.md` | `logs/agents/communication-task.log` |
| docs-reconcile | done | `docs/agents/results/docs-reconcile.md` | `logs/agents/docs-reconcile.log` |

## Run

```bash
bash scripts/start-multi-agents.sh
```

## Monitor

```bash
tail -f logs/agents/gap-features.log
tail -f logs/agents/gap-tests.log
tail -f logs/agents/communication-task.log
tail -f logs/agents/docs-reconcile.log
```

## Quick Checks

```bash
cat logs/agents/pids.txt
ps -fp $(awk '{print $2}' logs/agents/pids.txt | paste -sd, -)
```

## Notes

- Uses `copilot -p` non-interactive mode with `--allow-all-tools` for autonomous execution.
- If an agent fails due to permissions, rerun after `copilot login`.
- Outputs are isolated by file to avoid edit conflicts.
- Start timestamp: 2026-03-05 (local container time).

## Round 2 (Results-Driven)

### Objective

Run 4 new agents using round-1 outputs as inputs to produce executable task specs.

### Agent Set

1. `task-p0-features`: convert feature gaps into a P0 implementation task.
2. `task-communication-tests`: convert test gaps into executable test tasks (P0/P1/P2).
3. `task-doc-sync`: convert doc drift into concrete update checklist.
4. `task-master-plan`: unify all outputs into one execution sequence for multiple agents.

### Status Board

| Agent | Status | Output File | Log File |
|---|---|---|---|
| task-p0-features | running (pid 78361) | `docs/tasks/p0-features.md` | `logs/agents-round2/task-p0-features.log` |
| task-communication-tests | running (pid 78362) | `docs/tasks/communication-tests.md` | `logs/agents-round2/task-communication-tests.log` |
| task-doc-sync | running (pid 78363) | `docs/tasks/doc-sync.md` | `logs/agents-round2/task-doc-sync.log` |
| task-master-plan | running (pid 78364) | `docs/tasks/master-execution-plan.md` | `logs/agents-round2/task-master-plan.log` |

### Run

```bash
bash scripts/start-result-agents.sh
```
