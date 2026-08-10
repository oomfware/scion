import { summarizeSamples } from '../lib/stats.mjs';

const OPS = [
	{ name: 'mount', setup: [], call: 'mount', leaves: 1024 },
	{ name: 'update_root', setup: ['mount'], call: 'updateRoot', leaves: 1024 },
	{ name: 'update_partial', setup: ['mount'], call: 'updatePartial', leaves: 1024 },
	{ name: 'partial_unmount', setup: ['mount'], call: 'partialUnmount', leaves: 992 },
	{ name: 'partial_remount', setup: ['mount', 'partialUnmount'], call: 'partialRemount', leaves: 1024 },
	{ name: 'unmount', setup: ['mount'], call: 'unmount', leaves: 0 },
];

export const suite = {
	name: 'recursive-context',
	fixture: 'recursive-context',
	ops: OPS.map((op) => op.name),
	runtimes: ['scion', 'react', 'preact'],

	waitForReady(page) {
		return page.waitForFunction(() => Boolean(window.benchRecursiveContext));
	},

	async measure({ page, iterations }) {
		const ops = {};
		for (const op of OPS) {
			const samples = [];
			for (let index = 0; index < iterations; index++) {
				await page.evaluate(() => window.benchRecursiveContext.unmount());
				await page.evaluate((setup) => {
					for (const call of setup) {
						window.benchRecursiveContext[call]();
					}
				}, op.setup);
				const elapsed = await page.evaluate((call) => {
					(window.gc || (() => {}))();
					const started = performance.now();
					window.benchRecursiveContext[call]();
					return performance.now() - started;
				}, op.call);
				const snapshot = await page.evaluate(() => ({
					leaves: document.querySelectorAll('.leaf').length,
					local: Array.from(document.querySelectorAll('.mid .leaf')).filter((leaf) =>
						leaf.textContent?.endsWith(':1'),
					).length,
					root: Array.from(document.querySelectorAll('.leaf')).filter((leaf) =>
						/\|1:/.test(leaf.textContent ?? ''),
					).length,
				}));
				if (snapshot.leaves !== op.leaves) {
					throw new Error(`${op.name} rendered ${snapshot.leaves} leaves, expected ${op.leaves}`);
				}
				if (op.name === 'update_root' && snapshot.root !== 1024) {
					throw new Error('root context update did not reach all leaves');
				}
				if (op.name === 'update_partial' && snapshot.local !== 32) {
					throw new Error(`partial context update reached ${snapshot.local} leaves, expected 32`);
				}
				samples.push(elapsed);
			}
			ops[op.name] = summarizeSamples(samples);
		}
		return { ops, meta: { depth: 10, leaves: 1024, partialLeaves: 32 } };
	},
};
