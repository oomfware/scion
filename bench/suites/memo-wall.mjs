import { censusDomNodes, deterministicCount } from '../lib/dom-nodes.mjs';
import { summarizeSamples } from '../lib/stats.mjs';

const ROW_COUNT = 1000;
const REPEATS = 10;
const ZERO = { innerA: 0, innerB: 0, leafA: 0, leafB: 0, rowA: 0, rowB: 0 };
const OPS = [
	{
		name: 'mount',
		call: 'mount',
		expect: { innerA: 1000, innerB: 1000, leafA: 1000, leafB: 1000, rowA: 1000, rowB: 1000 },
	},
	{ name: 'parent_rerender_equal_A', call: 'parentA', expect: ZERO },
	{ name: 'parent_rerender_equal_B', call: 'parentB', expect: ZERO },
	{ name: 'one_change_A', call: 'changeA', expect: { ...ZERO, innerA: 1, leafA: 1, rowA: 1 } },
	{ name: 'one_change_B', call: 'changeB', expect: { ...ZERO, innerB: 1, leafB: 1, rowB: 1 } },
	{ name: 'ctx_through_wall_A', call: 'contextA', expect: { leafA: ROW_COUNT, leafB: 0 } },
	{ name: 'ctx_through_wall_B', call: 'contextB', expect: { leafA: 0, leafB: ROW_COUNT } },
];

const measureCall = (page, call, repeats) =>
	page.evaluate(
		async (options) => {
			(window.gc || (() => {}))();
			window.benchMemoWall.resetRenders();
			const started = performance.now();
			for (let index = 0; index < options.repeats; index++) {
				window.benchMemoWall[options.name]();
			}
			await Promise.resolve();
			return {
				elapsed: (performance.now() - started) / options.repeats,
				renders: window.benchMemoWall.renders(),
			};
		},
		{ name: call, repeats },
	);

const assertCounts = (actual, expected, op) => {
	for (const [name, count] of Object.entries(expected)) {
		if (actual[name] !== count) {
			throw new Error(
				`${op} rendered ${name} ${actual[name]} times, expected ${count}: ${JSON.stringify(actual)}`,
			);
		}
	}
};

export const suite = {
	name: 'memo-wall',
	fixture: 'memo-wall',
	ops: OPS.map((op) => op.name),
	runtimes: ['scion', 'react', 'preact'],

	waitForReady(page) {
		return page.waitForFunction(() => Boolean(window.benchMemoWall));
	},

	async measure({ page, iterations }) {
		const ops = {};
		for (const op of OPS) {
			const samples = [];
			for (let index = 0; index < iterations; index++) {
				if (op.name === 'mount') {
					await page.evaluate(() => window.benchMemoWall.unmount());
				} else {
					await page.evaluate(() => {
						if (document.querySelectorAll('#wall-a .item').length === 0) {
							window.benchMemoWall.mount();
						}
					});
				}
				const repeats = op.name === 'mount' ? 1 : REPEATS;
				const result = await measureCall(page, op.call, repeats);
				assertCounts(
					result.renders,
					Object.fromEntries(Object.entries(op.expect).map(([name, count]) => [name, count * repeats])),
					op.name,
				);
				samples.push(result.elapsed);
			}
			ops[op.name] = summarizeSamples(samples);
		}

		const state = await page.evaluate(() => window.benchMemoWall.state());
		await page.evaluate(({ mid, midValueA, midValueB, themeA, themeB }) => {
			const rowA = document.querySelectorAll('#wall-a .item')[mid];
			const rowB = document.querySelectorAll('#wall-b .item')[mid];
			if (rowA?.querySelector('.inner')?.firstChild?.textContent !== String(midValueA)) {
				throw new Error('wall A changed row is stale');
			}
			if (rowB?.querySelector('.inner')?.firstChild?.textContent !== String(midValueB)) {
				throw new Error('wall B changed row is stale');
			}
			if (document.querySelector('#wall-a .leaf')?.textContent !== themeA) {
				throw new Error('wall A context is stale');
			}
			if (document.querySelector('#wall-b .leaf')?.textContent !== themeB) {
				throw new Error('wall B context is stale');
			}
		}, state);
		const census = await page.evaluate(censusDomNodes, '#main');
		ops.nodes = deterministicCount(census.total);
		return { ops, meta: { dom: census, repeats: REPEATS, rowsPerWall: ROW_COUNT } };
	},
};
