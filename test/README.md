# tests

run with `pnpm run test`, or `pnpm run test:watch` while working.

## how these tests work

scion is a drop-in replacement, so almost every question about it is really a question about whether
it matches react. rather than assert hand-written expectations, the suite installs real
`react`/`react-dom` 19.2.8 as a dev dependency and uses them as an **oracle**: one scenario is run
twice, once on each runtime, and the two are compared.

`test/support/` holds the machinery:

- `runtime.ts` — a facade over whichever runtime is active. every hook forwards at call time, so a
  single component definition resolves its hooks against the runtime currently mounting it.
  `Fragment`, `Suspense`, `Activity` and `StrictMode` are the same well-known symbols in both
  runtimes, so they are re-exported directly.
- `harness.ts` — `runScenario` mounts a root, drives it, and returns three things to compare: an
  ordered **side-effect log**, labelled **DOM snapshots**, and the final DOM. `serializeDom` dumps
  tags, attributes _and_ live form properties, because a controlled input whose value exists only as
  a property serialises identically to an empty one in `innerHTML`.
- `differential.ts` — `expectAgreement(body)` asserts the two runtimes agree; `runBoth(body)`
  returns both results without comparing, for recording a difference that is real.

elements are always built by real react's jsx runtime (see `oxc.jsx` in `vitest.config.ts`). both
runtimes tag elements with `Symbol.for('react.transitional.element')` and read the same
`type`/`key`/`props` shape, so one element object feeds either renderer and the comparison stays
honest.

### settling

`act` means different things per runtime. scion defers a render to a microtask and its passive
effects to a further one, so settling drains the microtask queue and then checks the `__scion`
`passiveScheduled` flag. real react goes through its own `act`.

## recording a difference

a difference that is real gets pinned, never ignored, in one of two shapes:

- `test.fails(...)` on a parity assertion, where scion is simply wrong. when someone fixes the
  runtime the test reports "expected to fail but passed", which is the prompt to delete the
  `.fails`.
- `runBoth` plus explicit assertions on each side, where the behaviour differs by design or where
  pinning what _each_ runtime does is more useful than pinning that they differ.

every one carries a comment explaining the cause and what it costs. there are no `test.fails` pins
left: the suite is fully green, and the 16 remaining `runBoth` sites record what scion gives up by
being a synchronous renderer with no form-state machine, no document-metadata hoisting and no class
components — plus a handful of commit-order and error-reporting choices it makes differently. none
is a defect waiting on a fix. a new `test.fails` is therefore a to-do list of one, and it should not
survive the change that adds it.

a `runBoth` that ends in `expect(scion.entries).toEqual(react.entries)` is not a pin: it records
something surprising the runtimes nonetheless agree on, where saying so is more useful than
asserting it silently.

## what upstream react's own test suite is good for

not for running. react's tests are jest-specific (custom runner, legacy fake timers, `@gate`
pragmas), are written in flow against internal module paths (`shared/ReactFeatureFlags`,
`react-reconciler/src/ReactFiberConfig`), assert on dev warnings scion does not emit, and build
almost all hook/suspense coverage on `react-noop-renderer` plus a mock scheduler — concepts a
synchronous renderer has no analogue for.

they are worth reading as a specification. `ReactChildren-test.js`, `DOMPropertyOperations-test.js`,
`CSSPropertyOperations-test.js`, `ReactDOMInput-test.js` and `refs-test.js` all describe behaviour
that is exactly specified, and the cases in them informed the fixtures here. the oracle does the
rest.
