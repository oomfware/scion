import { summarizeSamples } from '../lib/stats.mjs';

const ITEM_COUNT = 200;
const OPS = [
	'mount_closed',
	'open_all',
	'rerender_open_A',
	'rerender_open_B',
	'rerender_open_B_stable',
	'open_close_cycle',
	'open_close_distinct',
	'dispatch_through_portal',
];

const time = (page, operation, value) =>
	page.evaluate(
		({ body, argument }) => {
			(window.gc || (() => {}))();
			if (body === 'dispatch') {
				const buttons = document.querySelectorAll('.tipA .tip-btn');
				const started = performance.now();
				for (const button of buttons) {
					button.click();
				}
				return (performance.now() - started) / buttons.length;
			}
			const started = performance.now();
			switch (body) {
				case 'mount': {
					window.benchPortalSwarm.mount();
					break;
				}
				case 'openAll': {
					window.benchPortalSwarm.openAll();
					break;
				}
				case 'rerender': {
					for (let index = 0; index < 10; index++) {
						window.benchPortalSwarm.rerender(argument);
					}
					return (performance.now() - started) / 10;
				}
				case 'cycle': {
					for (let index = 0; index < 5; index++) {
						window.benchPortalSwarm.openAll();
						window.benchPortalSwarm.closeAll();
					}
					return (performance.now() - started) / 5;
				}
			}
			return performance.now() - started;
		},
		{ argument: value, body: operation },
	);

const verify = (page, expectedTips) =>
	page.evaluate(
		({ count, tips }) => {
			if (document.querySelectorAll('.item').length !== count * 3) {
				throw new Error('portal rows are incomplete');
			}
			if (document.querySelectorAll('.pt').length !== count) {
				throw new Error('portal targets are incomplete');
			}
			if (document.querySelectorAll('.tip').length !== tips) {
				throw new Error('portal count is incorrect');
			}
		},
		{ count: ITEM_COUNT, tips: expectedTips },
	);

export const suite = {
	name: 'portal-swarm',
	fixture: 'portal-swarm',
	ops: OPS,

	waitForReady(page) {
		return page.waitForFunction(() => Boolean(window.benchPortalSwarm));
	},

	async measure({ page, iterations }) {
		const samples = Object.fromEntries(OPS.map((name) => [name, []]));
		for (let index = 0; index < iterations; index++) {
			await page.evaluate(() => window.benchPortalSwarm.unmount());
			samples.mount_closed.push(await time(page, 'mount'));
			await verify(page, 0);

			await page.evaluate(() => window.benchPortalSwarm.closeAll());
			samples.open_all.push(await time(page, 'openAll'));
			await verify(page, ITEM_COUNT * 3);

			for (const [name, section, selector] of [
				['rerender_open_A', 'A', '.tipA'],
				['rerender_open_B', 'B', '.tipB'],
				['rerender_open_B_stable', 'BS', '.tipBS'],
			]) {
				await page.evaluate((selected) => {
					window.benchPortalSwarm.closeAll();
					window.benchPortalSwarm.open(selected);
				}, section);
				samples[name].push(await time(page, 'rerender', section));
				const count = await page.locator(selector).count();
				if (count !== ITEM_COUNT) {
					throw new Error(`${name} left ${count} portals`);
				}
			}

			for (const [name, distinct] of [
				['open_close_cycle', false],
				['open_close_distinct', true],
			]) {
				await page.evaluate((value) => {
					window.benchPortalSwarm.closeAll();
					window.benchPortalSwarm.setDistinct(value);
				}, distinct);
				samples[name].push(await time(page, 'cycle'));
				await verify(page, 0);
			}

			await page.evaluate(() => {
				window.benchPortalSwarm.setDistinct(false);
				window.benchPortalSwarm.open('A');
			});
			const before = await page.evaluate(() => window.benchPortalSwarm.hits());
			samples.dispatch_through_portal.push(await time(page, 'dispatch'));
			const after = await page.evaluate(() => window.benchPortalSwarm.hits());
			if (after - before !== ITEM_COUNT) {
				throw new Error('portal dispatch lost click events');
			}
		}
		return {
			ops: Object.fromEntries(
				Object.entries(samples).map(([name, values]) => [name, summarizeSamples(values)]),
			),
			meta: { portalsPerSection: ITEM_COUNT, sections: 3 },
		};
	},
};
