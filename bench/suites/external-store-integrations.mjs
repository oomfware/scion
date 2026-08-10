import { STORE_SUBSCRIBER_COUNT } from '../fixtures/runtime-shared/src/config.mjs';
import { summarizeSamples } from '../lib/stats.mjs';

const INTEGRATIONS = ['jotai', 'tanstack-query', 'zustand'];
const WRITE_REPEATS = 20;
const OPS = INTEGRATIONS.flatMap((name) => [
	`${name}_mount`,
	`${name}_narrow_write`,
	`${name}_broad_write`,
	...(name === 'tanstack-query' ? [`${name}_invalidate`] : []),
	`${name}_unmount`,
]);

const time = (page, operation, values) =>
	page.evaluate(
		({ argument, call }) => {
			(window.gc || (() => {}))();
			const started = performance.now();
			window.benchExternalStoreIntegrations[call](...argument);
			return performance.now() - started;
		},
		{ argument: values, call: operation },
	);

const timeWrites = (page, operation, values) =>
	page.evaluate(
		({ argument, call, repeats }) => {
			(window.gc || (() => {}))();
			const started = performance.now();
			for (let index = 0; index < repeats; index++) {
				window.benchExternalStoreIntegrations[call](...argument, index + 1);
			}
			return (performance.now() - started) / repeats;
		},
		{ argument: values, call: operation, repeats: WRITE_REPEATS },
	);

export const suite = {
	fixture: 'external-store-integrations',
	name: 'external-store-integrations',
	ops: OPS,
	waitForReady(page) {
		return page.waitForFunction(() => Boolean(window.benchExternalStoreIntegrations));
	},
	async measure({ page, iterations }) {
		const raw = Object.fromEntries(OPS.map((operation) => [operation, []]));
		const meta = [];
		for (let iteration = 0; iteration < iterations; iteration++) {
			for (const integration of INTEGRATIONS) {
				await page.reload({ waitUntil: 'load' });
				await this.waitForReady(page);
				await page.evaluate((name) => window.benchExternalStoreIntegrations.activate(name), integration);

				raw[`${integration}_mount`].push(await time(page, 'mount', []));
				await page.waitForFunction(
					(count) =>
						document.querySelectorAll('[data-subscriber-index]').length === count &&
						window.benchExternalStoreIntegrations.stats().size === count,
					STORE_SUBSCRIBER_COUNT,
				);

				raw[`${integration}_narrow_write`].push(await timeWrites(page, 'writeOne', [17]));
				const changed = await page
					.locator('[data-subscriber-index]')
					.evaluateAll((nodes) =>
						nodes
							.filter((node) => node.textContent !== '0')
							.map((node) => node.getAttribute('data-subscriber-index')),
					);
				if (changed.length !== 1 || changed[0] !== '17') {
					throw new Error(`${integration} narrow write changed the wrong subscribers`);
				}

				raw[`${integration}_broad_write`].push(await timeWrites(page, 'writeAll', []));
				await page.waitForFunction(() =>
					Array.from(document.querySelectorAll('[data-subscriber-index]')).every(
						(node) => node.textContent === '20',
					),
				);

				if (integration === 'tanstack-query') {
					const invalidation = await page.evaluate(async () => {
						const started = performance.now();
						const result = await window.benchExternalStoreIntegrations.invalidate();
						return { elapsed: performance.now() - started, result };
					});
					if (invalidation.result?.refetches !== 1 || invalidation.result.value !== WRITE_REPEATS + 1) {
						throw new Error('TanStack Query invalidation did not refetch the active data');
					}
					raw[`${integration}_invalidate`].push(invalidation.elapsed);
				}

				raw[`${integration}_unmount`].push(await time(page, 'unmount', []));
				await page.waitForFunction(() => window.benchExternalStoreIntegrations.stats().size === 0);
				const stats = await page.evaluate(() => window.benchExternalStoreIntegrations.stats());
				if (stats.size !== 0 || stats.subscribeCalls !== stats.unsubscribeCalls) {
					throw new Error(`${integration} retained external-store subscribers`);
				}
				meta.push({ integration, ...stats });
			}
		}
		return {
			ops: Object.fromEntries(
				Object.entries(raw).map(([operation, values]) => [operation, summarizeSamples(values)]),
			),
			meta: { samples: meta, subscribers: STORE_SUBSCRIBER_COUNT, writeRepeats: WRITE_REPEATS },
		};
	},
};
