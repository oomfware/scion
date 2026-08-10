# benchmarks

browser benchmark suites for scion, measured against React, Preact, and Redact.

```bash
pnpm --filter @oomfware/scion build                    # the suites consume dist/ files
pnpm --filter @oomfware/scion-bench bench              # every suite, 8 samples per operation
pnpm --filter @oomfware/scion-bench bench -- --quick   # 3 samples, for a smoke pass
node bench.mjs js-framework --iterations=20            # from this directory
node bench.mjs memo-wall --runtimes=scion,react        # select comparison runtimes
node bench.mjs --list
```

select one or more suites by name to keep a profiling run focused. the adapted workload suites are:

- `memo-wall`
- `effectful-list`
- `list-clear`
- `portal-swarm`
- `recursive-context`
- `chat-stream`
- `todomvc`

the runtime stress workloads use separate fixtures so a focused run does not mount unrelated UI:

- `application-composition`
- `controlled-form`
- `event-delegation`
- `external-store-fanout`
- `external-store-integrations`
- `lifecycle-memory`
- `scaling-curves`
- `scheduler-responsiveness`
- `suspense-recovery`
