import { censusDomNodes, deterministicCount } from '../lib/dom-nodes.mjs';
import { summarizeSamples } from '../lib/stats.mjs';

const ROW_COUNT = 1000;
const ROW_COUNT_LARGE = 10000;

const OPS = [
	{ name: 'run', pre: 'empty', click: '#run' },
	{ name: 'replace', pre: 'rows', click: '#run' },
	{ name: 'add', pre: 'rows', click: '#add' },
	{ name: 'update', pre: 'rows', click: '#update' },
	{
		name: 'select',
		pre: 'rows',
		click: 'tbody tr:nth-child(5) td:nth-child(2) a',
		alternateClick: 'tbody tr:nth-child(6) td:nth-child(2) a',
	},
	{ name: 'swap', pre: 'rows', click: '#swaprows' },
	{ name: 'remove', pre: 'rows', click: 'tbody tr:nth-child(5) td:nth-child(3) a' },
	{ name: 'prepend_100', pre: 'rows', click: '#prepend100' },
	{ name: 'insert_mid_100', pre: 'rows', click: '#insertmid100' },
	{ name: 'reverse', pre: 'rows', click: '#reverse' },
	{ name: 'shuffle', pre: 'rows', click: '#shuffle' },
	{ name: 'displace_4', pre: 'rows', click: '#displace4' },
	{ name: 'runlots', pre: 'empty', click: '#runlots' },
	{
		name: 'select_lots',
		pre: 'rows-large',
		click: 'tbody tr:nth-child(5000) td:nth-child(2) a',
		alternateClick: 'tbody tr:nth-child(5001) td:nth-child(2) a',
	},
	// upstream clears the 10,000-row table.
	{ name: 'clear', pre: 'rows-large', click: '#clear' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// use the same labels in each column.
const seedRandom = (page) =>
	page.evaluate(() => {
		let state = 0x5eed5eed >>> 0;
		Math.random = () => {
			state = (state + 0x6d2b79f5) | 0;
			let value = Math.imul(state ^ (state >>> 15), 1 | state);
			value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
			return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
		};
	});

const rowCount = (page) => page.evaluate(() => document.querySelectorAll('tbody tr').length);

const waitForRows = (page, count) =>
	page.waitForFunction((n) => document.querySelectorAll('tbody tr').length === n, count, {
		timeout: 10_000,
	});

const ensureState = async (page, pre) => {
	switch (pre) {
		case 'empty': {
			await page.evaluate(() => document.getElementById('clear').click());
			await waitForRows(page, 0);
			break;
		}
		case 'rows': {
			if ((await rowCount(page)) !== ROW_COUNT) {
				await page.evaluate(() => document.getElementById('run').click());
				await waitForRows(page, ROW_COUNT);
			}
			break;
		}
		case 'rows-large': {
			if ((await rowCount(page)) !== ROW_COUNT_LARGE) {
				await page.evaluate(() => document.getElementById('runlots').click());
				await waitForRows(page, ROW_COUNT_LARGE);
			}
			break;
		}
	}
	await sleep(20);
};

const timeClick = (page, selector) =>
	page.evaluate((query) => {
		const element = document.querySelector(query);
		if (element === null) {
			throw new Error(`selector not found: ${query}`);
		}
		(window.gc || (() => {}))();
		const started = performance.now();
		element.click();
		return performance.now() - started;
	}, selector);

const verifySelection = (page, selector) =>
	page.evaluate((query) => {
		const expected = document.querySelector(query)?.closest('tr');
		const selected = document.querySelectorAll('tbody tr.danger');
		if (expected && selected.length === 1 && selected[0] === expected) {
			return;
		}

		const label = (row) => row.querySelector('td')?.textContent || '(missing id)';
		throw new Error(
			`selection gate failed: expected only ${expected ? label(expected) : '(missing row)'}, ` +
				`found ${Array.from(selected, label).join(', ') || '(none)'}`,
		);
	}, selector);

export const suite = {
	name: 'js-framework',
	fixture: 'js-framework',
	ops: OPS.map((op) => op.name),

	waitForReady(page) {
		return page.waitForSelector('#run', { timeout: 15_000 });
	},

	async measure({ page, iterations }) {
		await seedRandom(page);

		for (let index = 0; index < 3; index++) {
			await page.evaluate(() => document.getElementById('run').click());
			await sleep(120);
			await page.evaluate(() => document.getElementById('clear').click());
			await sleep(80);
		}

		const ops = {};
		for (const op of OPS) {
			const samples = [];
			for (let index = 0; index < iterations; index++) {
				await ensureState(page, op.pre);
				// avoid selecting the same row twice.
				const selector = index % 2 === 1 && op.alternateClick ? op.alternateClick : op.click;
				const sample = await timeClick(page, selector);
				if (op.alternateClick) {
					await verifySelection(page, selector);
				}
				samples.push(sample);
				await sleep(60);
			}
			ops[op.name] = summarizeSamples(samples);
		}

		await ensureState(page, 'rows');
		const census = await page.evaluate(censusDomNodes, '#main');
		ops.nodes_1k = deterministicCount(census.total);
		ops.elements_1k = deterministicCount(census.elements);
		ops.text_1k = deterministicCount(census.text);
		ops.comments_1k = deterministicCount(census.comments);

		return { ops, meta: { dom: census } };
	},
};
