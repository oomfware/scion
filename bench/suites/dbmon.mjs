import { censusDomNodes, deterministicCount } from '../lib/dom-nodes.mjs';
import { summarizeSamples } from '../lib/stats.mjs';

const ROW_COUNT = 1000;
const CELLS_PER_ROW = 7;

const OPS = [
	{ name: 'mount', pre: 'unmounted', call: 'mount' },
	{ name: 'tick', pre: 'mounted', call: 'tick' },
	{ name: 'tick_partial', pre: 'mounted', call: 'tickPartial' },
	{ name: 'remount', pre: 'mounted', call: 'remount' },
	{ name: 'sort', pre: 'mounted', call: 'sort' },
	{ name: 'unmount', pre: 'mounted', call: 'unmount' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureState = async (page, pre) => {
	await page.evaluate((wanted) => {
		const mounted = window.bench.isMounted();
		if (wanted === 'mounted' && !mounted) {
			window.bench.mount();
		} else if (wanted === 'unmounted' && mounted) {
			window.bench.unmount();
		}
	}, pre);
	await sleep(20);
};

const timeCall = (page, call) =>
	page.evaluate((name) => {
		(window.gc || (() => {}))();
		const started = performance.now();
		window.bench[name]();
		return performance.now() - started;
	}, call);

const verifyTable = (page, expectedRows) =>
	page.evaluate((expected) => {
		const rows = document.querySelectorAll('table.dbmon tbody tr');
		if (rows.length !== expected) {
			throw new Error(`table gate failed: expected ${expected} rows, found ${rows.length}`);
		}
		if (expected === 0) {
			return;
		}
		const cells = rows[0].querySelectorAll('td');
		if (cells.length !== 7) {
			throw new Error(`table gate failed: expected 7 cells per row, found ${cells.length}`);
		}
	}, expectedRows);

export const suite = {
	name: 'dbmon',
	fixture: 'dbmon',
	ops: OPS.map((op) => op.name),

	waitForReady(page) {
		return page.waitForFunction(() => Boolean(window.bench), null, { timeout: 15_000 });
	},

	async measure({ page, iterations }) {
		for (let index = 0; index < 3; index++) {
			await page.evaluate(() => {
				window.bench.mount();
				window.bench.tick();
				window.bench.sort();
				window.bench.unmount();
			});
			await sleep(80);
		}

		const ops = {};
		for (const op of OPS) {
			const samples = [];
			for (let index = 0; index < iterations; index++) {
				await ensureState(page, op.pre);
				samples.push(await timeCall(page, op.call));
				await verifyTable(page, op.call === 'unmount' ? 0 : ROW_COUNT);
				await sleep(60);
			}
			ops[op.name] = summarizeSamples(samples);
		}

		await ensureState(page, 'mounted');
		const census = await page.evaluate(censusDomNodes, '#main');
		ops.nodes = deterministicCount(census.total);
		ops.elements = deterministicCount(census.elements);
		ops.text = deterministicCount(census.text);
		ops.comments = deterministicCount(census.comments);

		return { ops, meta: { dom: census, cellsPerRow: CELLS_PER_ROW, rows: ROW_COUNT } };
	},
};
