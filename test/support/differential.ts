import { expect } from 'vitest';

import { reactRuntime, runScenario, scionRuntime, type Scenario, type ScenarioResult } from './harness.ts';

/**
 * compares a scenario under scion and React.
 *
 * @param body the scenario to run under both runtimes
 * @param options comparison options
 * @returns scion's result, for assertions that only make sense against the runtime under test
 * @throws if the runtimes disagree
 */
export const expectAgreement = async (
	body: (scenario: Scenario) => Promise<void> | void,
	options: {
		/** whether to compare the final DOM. */
		compareDom?: boolean;
	} = {},
): Promise<ScenarioResult> => {
	const { react, scion } = await runBoth(body);

	expect(scion.uncaught, 'uncaught errors').toEqual(react.uncaught);
	expect(scion.entries, 'side-effect log').toEqual(react.entries);
	expect(scion.snapshots, 'labelled snapshots').toEqual(react.snapshots);
	if (options.compareDom !== false) {
		expect(scion.dom, 'final dom').toEqual(react.dom);
	}
	return scion;
};

/**
 * creates a scenario that snapshots two renders.
 *
 * @param first the first element
 * @param second the second element
 * @returns the scenario body
 */
export const transition =
	(first: unknown, second: unknown) =>
	async (scenario: Scenario): Promise<void> => {
		await scenario.render(first);
		scenario.snapshot('first');
		await scenario.render(second);
		scenario.snapshot('second');
	};

/**
 * runs a scenario under both runtimes without comparison.
 *
 * @param body the scenario to run under both runtimes
 * @returns both runtimes' results
 */
export const runBoth = async (
	body: (scenario: Scenario) => Promise<void> | void,
): Promise<{ react: ScenarioResult; scion: ScenarioResult }> => {
	const scion = await runScenario(scionRuntime, body);
	const react = await runScenario(reactRuntime, body);
	return { react, scion };
};
