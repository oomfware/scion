import { summarizeSamples } from '../lib/stats.mjs';

const OPS = [
	{
		name: 'mount_1k',
		pre: 'empty',
		call: 'fresh',
		rows: 1000,
		expect: { mounts: 1000, cleanups: 0, refs: 1000, refCleanups: 0, layouts: 100 },
	},
	{
		name: 'update_nodeps',
		pre: 'fresh',
		call: 'updateNoDeps',
		rows: 1000,
		expect: { mounts: 0, cleanups: 0, refs: 0, refCleanups: 0, layouts: 0 },
	},
	{
		name: 'update_deps',
		pre: 'fresh',
		call: 'updateDeps',
		rows: 1000,
		expect: { mounts: 0, cleanups: 0, refs: 0, refCleanups: 0, layouts: 100 },
	},
	{
		name: 'clear',
		pre: 'fresh',
		call: 'clear',
		rows: 0,
		expect: { mounts: 0, cleanups: 1000, refs: 0, refCleanups: 1000, layouts: 0 },
	},
	{
		name: 'remount',
		pre: 'fresh',
		call: 'fresh',
		rows: 1000,
		expect: { mounts: 1000, cleanups: 1000, refs: 1000, refCleanups: 1000, layouts: 100 },
	},
	{
		name: 'remove_100_scattered',
		pre: 'fresh',
		call: 'remove100',
		rows: 900,
		expect: { mounts: 0, cleanups: 100, refs: 0, refCleanups: 100, layouts: 0 },
	},
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const prepare = async (page, pre) => {
	await page.evaluate((state) => {
		if (state === 'empty') {
			window.benchEffectfulList.clear();
		} else {
			window.benchEffectfulList.fresh();
		}
	}, pre);
	await sleep(20);
	await page.evaluate(() => window.benchEffectfulList.resetCounters());
};

export const suite = {
	name: 'effectful-list',
	fixture: 'effectful-list',
	ops: OPS.map((op) => op.name),

	waitForReady(page) {
		return page.waitForFunction(() => Boolean(window.benchEffectfulList));
	},

	async measure({ page, iterations }) {
		const ops = {};
		for (const op of OPS) {
			const samples = [];
			for (let index = 0; index < iterations; index++) {
				await prepare(page, op.pre);
				const elapsed = await page.evaluate(
					async ({ call, expect }) => {
						(window.gc || (() => {}))();
						const started = performance.now();
						window.benchEffectfulList[call]();
						for (let attempt = 0; attempt < 1000; attempt++) {
							const counters = window.benchEffectfulList.counters();
							if (Object.entries(expect).every(([name, value]) => counters[name] === value)) {
								return performance.now() - started;
							}
							await new Promise((resolve) => setTimeout(resolve, 0));
						}
						throw new Error(`${call} effects did not settle`);
					},
					{ call: op.call, expect: op.expect },
				);
				const result = await page.evaluate(() => ({
					counters: window.benchEffectfulList.counters(),
					rows: document.querySelectorAll('tbody tr').length,
				}));
				if (result.rows !== op.rows) {
					throw new Error(`${op.name} left ${result.rows} rows, expected ${op.rows}`);
				}
				for (const [name, expected] of Object.entries(op.expect)) {
					if (result.counters[name] !== expected) {
						throw new Error(`${op.name} produced ${name}=${result.counters[name]}, expected ${expected}`);
					}
				}
				samples.push(elapsed);
			}
			ops[op.name] = summarizeSamples(samples);
		}
		return { ops, meta: { rows: 1000, probeRows: 100 } };
	},
};
