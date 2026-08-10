import { summarizeSamples } from '../lib/stats.mjs';

const OPS = [
	{
		name: 'clear_shared_small',
		container: '#shared-small',
		fill: 'fillSharedSmall',
		clear: 'clearSharedSmall',
		groups: 150,
		survivors: 2,
	},
	{
		name: 'clear_shared_1000',
		container: '#shared-large',
		fill: 'fillSharedLarge',
		clear: 'clearSharedLarge',
		groups: 3,
		survivors: 2,
	},
	{
		name: 'clear_owned_1000',
		container: '#owned',
		fill: 'fillOwned',
		clear: 'clearOwned',
		groups: 3,
		survivors: 0,
	},
];

export const suite = {
	name: 'list-clear',
	fixture: 'list-clear',
	ops: OPS.map((op) => op.name),

	waitForReady(page) {
		return page.waitForFunction(() => Boolean(window.benchListClear));
	},

	async measure({ page, iterations }) {
		const ops = {};
		for (const op of OPS) {
			const samples = [];
			for (let index = 0; index < iterations; index++) {
				await page.evaluate((fill) => window.benchListClear[fill](), op.fill);
				const elapsed = await page.evaluate((clear) => {
					(window.gc || (() => {}))();
					const started = performance.now();
					window.benchListClear[clear]();
					return performance.now() - started;
				}, op.clear);
				const result = await page.locator(op.container).evaluate((container) => ({
					lists: container.querySelectorAll('ul').length,
					rows: container.querySelectorAll('li.row').length,
					survivors: Array.from(container.querySelectorAll('ul')).map((list) =>
						Array.from(list.children, (child) => child.textContent),
					),
				}));
				if (result.lists !== op.groups || result.rows !== 0) {
					throw new Error(`${op.name} left ${result.rows} rows across ${result.lists} lists`);
				}
				for (const survivors of result.survivors) {
					if (survivors.length !== op.survivors) {
						throw new Error(`${op.name} removed the wrong list span`);
					}
				}
				samples.push(elapsed);
			}
			ops[op.name] = summarizeSamples(samples);
		}
		return { ops, meta: { ownedGroups: 3, sharedLargeGroups: 3, sharedSmallGroups: 150 } };
	},
};
