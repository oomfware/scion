import {
	EVENT_DISPATCH_COUNT,
	FORM_FIELD_COUNT as FORM_FIELDS,
	LIFECYCLE_ROW_COUNT as LIFECYCLE_ROWS,
	SCALE_LEVELS,
	STORE_SUBSCRIBER_COUNT as STORE_SUBSCRIBERS,
} from '../fixtures/runtime-shared/src/config.mjs';
import { summarizeSamples } from '../lib/stats.mjs';

const fresh = async (page) => {
	await page.reload({ waitUntil: 'load' });
	await page.waitForFunction(() => window.runtimeStress?.ready === true);
};

const makeSuite = ({ fixture, name: suiteName, ops, sample }) => ({
	fixture,
	name: suiteName,
	ops,
	waitForReady(page) {
		return page.waitForFunction(() => window.runtimeStress?.ready === true);
	},
	async measure({ page, iterations }) {
		const raw = Object.fromEntries(ops.map((op) => [op, []]));
		const meta = [];
		for (let index = 0; index < iterations; index++) {
			await fresh(page);
			const result = await sample(page);
			for (const [operation, value] of Object.entries(result.ops)) {
				raw[operation].push(value);
			}
			meta.push(result.meta);
		}
		return {
			ops: Object.fromEntries(
				Object.entries(raw).map(([operation, values]) => [operation, summarizeSamples(values)]),
			),
			meta: { samples: meta },
		};
	},
});

const lifecycle = makeSuite({
	fixture: 'lifecycle-memory',
	name: 'lifecycle-memory',
	ops: ['mount', 'update', 'unmount', 'cycle'],
	async sample(page) {
		const mount = [];
		const update = [];
		const unmount = [];
		for (let index = 0; index < 12; index++) {
			let started = await page.evaluate(() => performance.now());
			await page.locator('#lifecycle-toggle').click();
			await page.waitForFunction(
				(count) => document.querySelectorAll('[data-lifecycle-row]').length === count,
				LIFECYCLE_ROWS,
			);
			mount.push((await page.evaluate(() => performance.now())) - started);
			started = await page.evaluate(() => performance.now());
			await page.locator('#lifecycle-update').click();
			await page.waitForFunction(
				(tick) =>
					Array.from(document.querySelectorAll('[data-lifecycle-row]')).every(
						(row, rowIndex) => row.textContent === `${rowIndex}:${tick}`,
					),
				index + 1,
			);
			update.push((await page.evaluate(() => performance.now())) - started);
			started = await page.evaluate(() => performance.now());
			await page.locator('#lifecycle-toggle').click();
			await page.waitForFunction(
				() =>
					document.querySelectorAll('[data-lifecycle-row]').length === 0 &&
					window.runtimeStress.store.size === 0,
			);
			unmount.push((await page.evaluate(() => performance.now())) - started);
		}
		const state = await page.evaluate(() => {
			const before = window.runtimeStress.stats.lifecycle.probeEvents;
			document.dispatchEvent(new Event('scion-runtime-probe'));
			return {
				...window.runtimeStress.stats.lifecycle,
				retainedListeners: window.runtimeStress.stats.lifecycle.probeEvents - before,
				retainedStore: window.runtimeStress.store.size,
			};
		});
		if (
			state.mounts !== LIFECYCLE_ROWS * 12 ||
			state.cleanups !== state.mounts ||
			state.retainedListeners !== 0 ||
			state.retainedStore !== 0
		) {
			throw new Error('lifecycle resources were retained or miscounted');
		}
		const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
		return {
			ops: {
				mount: average(mount),
				update: average(update),
				unmount: average(unmount),
				cycle: average(mount) + average(update) + average(unmount),
			},
			meta: state,
		};
	},
});

const controlledForm = makeSuite({
	fixture: 'controlled-form',
	name: 'controlled-form',
	ops: ['typing', 'controls_submit', 'reset'],
	async sample(page) {
		await page.waitForFunction(
			(count) => document.querySelectorAll('input[data-field-index]').length === count,
			FORM_FIELDS,
		);
		const input = page.locator('input[data-field-index="37"]');
		await input.click();
		const typingStarted = await page.evaluate(() => performance.now());
		await input.pressSequentially('octane benchmark');
		await input.press('ArrowLeft');
		await input.press('ArrowLeft');
		await input.press('X');
		const expected = 'octane benchmaXrk';
		await page.waitForFunction(
			(value) => document.querySelector('[data-field-output="37"]')?.textContent === value,
			expected,
		);
		await page.waitForFunction(() => {
			const form = window.runtimeStress.stats.form;
			return form.validationApplied + form.validationStale === form.validationRequests;
		});
		const typedAt = await page.evaluate(() => performance.now());
		const controlsStarted = await page.evaluate(() => performance.now());
		await page.locator('#form-checkbox').check();
		await page.locator('#form-radio-express').check();
		await page.locator('#form-select').selectOption('team');
		await page.locator('#form-conditional-toggle').click();
		await page.locator('#form-submit').click();
		await page.waitForFunction(() => {
			const form = window.runtimeStress.stats.form;
			return form.submits === 1 && form.validationApplied + form.validationStale === form.validationRequests;
		});
		const submittedAt = await page.evaluate(() => performance.now());
		const submission = await page.evaluate(() => window.runtimeStress.stats.form.lastSubmission);
		if (
			submission?.['field-37'] !== expected ||
			submission.notifications !== 'enabled' ||
			submission.delivery !== 'express' ||
			submission.audience !== 'team'
		) {
			throw new Error('controlled form submitted stale state');
		}
		const resetStarted = await page.evaluate(() => performance.now());
		await page.locator('#form-reset').click();
		await page.waitForFunction(
			() =>
				document.querySelector('input[data-field-index="37"]')?.value === '' &&
				!document.querySelector('#form-checkbox')?.checked &&
				document.querySelector('#form-radio-standard')?.checked &&
				document.querySelector('#form-select')?.value === 'personal',
		);
		const resetAt = await page.evaluate(() => performance.now());
		return {
			ops: {
				typing: typedAt - typingStarted,
				controls_submit: submittedAt - controlsStarted,
				reset: resetAt - resetStarted,
			},
			meta: { fields: FORM_FIELDS, validation: await page.evaluate(() => window.runtimeStress.stats.form) },
		};
	},
});

const externalStore = makeSuite({
	fixture: 'external-store-fanout',
	name: 'external-store-fanout',
	ops: ['mount', 'narrow_write', 'broad_write', 'rapid_writes', 'unmount'],
	async sample(page) {
		const repeats = 20;
		const timedWrite = (method, index) =>
			page.evaluate(
				(options) => {
					(window.gc || (() => {}))();
					const started = performance.now();
					for (let value = 1; value <= options.repeats; value++) {
						if (options.index === undefined) {
							window.runtimeStress.store[options.method](value);
						} else {
							window.runtimeStress.store[options.method](options.index, value);
						}
					}
					return (performance.now() - started) / options.repeats;
				},
				{ index, method, repeats },
			);
		const timedToggle = (visible) =>
			page.evaluate(
				(options) => {
					(window.gc || (() => {}))();
					let elapsed = 0;
					for (let index = 0; index < options.repeats; index++) {
						const started = performance.now();
						window.runtimeStress.setStoreVisible(options.visible);
						elapsed += performance.now() - started;
						if (index + 1 < options.repeats) {
							window.runtimeStress.setStoreVisible(!options.visible);
						}
					}
					return elapsed / options.repeats;
				},
				{ repeats, visible },
			);
		const timedRapidWrite = () =>
			page.evaluate((count) => {
				(window.gc || (() => {}))();
				const started = performance.now();
				for (let index = 0; index < count; index++) {
					window.runtimeStress.store.writeManySync(17, [8, 9, 10]);
				}
				return (performance.now() - started) / count;
			}, repeats);
		const mount = await timedToggle(true);
		await page.waitForFunction(
			(count) =>
				document.querySelectorAll('[data-subscriber-index]').length === count &&
				window.runtimeStress.store.size === count,
			STORE_SUBSCRIBERS,
		);
		const narrow = await timedWrite('writeOneSync', 17);
		await page.waitForFunction(
			(value) => document.querySelector('[data-subscriber-index="17"]')?.textContent === String(value),
			repeats,
		);
		const changed = await page
			.locator('[data-subscriber-index]')
			.evaluateAll((nodes) =>
				nodes
					.filter((node) => node.textContent !== '0')
					.map((node) => node.getAttribute('data-subscriber-index')),
			);
		if (changed.length !== 1 || changed[0] !== '17') {
			throw new Error('narrow store write changed the wrong subscribers');
		}
		const broad = await timedWrite('writeAllSync');
		await page.waitForFunction(
			(value) =>
				Array.from(document.querySelectorAll('[data-subscriber-index]')).every(
					(node) => node.textContent === String(value),
				),
			repeats,
		);
		const rapid = await timedRapidWrite();
		await page.waitForFunction(() =>
			Array.from(document.querySelectorAll('[data-subscriber-index]')).every(
				(node, index) => node.textContent === (index === 17 ? '10' : '20'),
			),
		);
		const unmount = await timedToggle(false);
		await page.waitForFunction(
			() =>
				document.querySelectorAll('[data-subscriber-index]').length === 0 &&
				window.runtimeStress.store.size === 0,
		);
		const state = await page.evaluate(() => window.runtimeStress.stats.store);
		if (state.subscribeCalls !== state.unsubscribeCalls) {
			throw new Error('external store retained subscribers');
		}
		return {
			ops: { mount, narrow_write: narrow, broad_write: broad, rapid_writes: rapid, unmount },
			meta: { ...state, repeats },
		};
	},
});

const scheduler = makeSuite({
	fixture: 'scheduler-responsiveness',
	name: 'scheduler-responsiveness',
	ops: ['input_during_updates'],
	async sample(page) {
		const session = await page.context().newCDPSession(page);
		await session.send('Emulation.setCPUThrottlingRate', { rate: 6 });
		try {
			await page.locator('#lifecycle-toggle').click();
			await page.locator('#store-toggle').click();
			await page.waitForFunction(
				({ rows, subscribers }) =>
					document.querySelectorAll('[data-lifecycle-row]').length === rows &&
					document.querySelectorAll('[data-subscriber-index]').length === subscribers,
				{ rows: LIFECYCLE_ROWS, subscribers: STORE_SUBSCRIBERS },
			);
			const input = page.locator('input[data-field-index="37"]');
			await input.click();
			const started = await page.evaluate(() => performance.now());
			await Promise.all([
				page.evaluate(async () => {
					for (let index = 0; index < 8; index++) {
						await new Promise((resolve) => setTimeout(resolve, 0));
						window.runtimeStress.store.writeAll(index + 1);
					}
				}),
				input.pressSequentially('responsive input'),
			]);
			await page.waitForFunction(
				() =>
					document.querySelector('[data-field-output="37"]')?.textContent === 'responsive input' &&
					Array.from(document.querySelectorAll('[data-subscriber-index]')).every(
						(node) => node.textContent === '8',
					),
			);
			const completed = await page.evaluate(() => performance.now());
			return { ops: { input_during_updates: completed - started }, meta: { cpuRate: 6 } };
		} finally {
			await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
			await session.detach();
		}
	},
});

const suspenseRecovery = makeSuite({
	fixture: 'suspense-recovery',
	name: 'suspense-recovery',
	ops: ['error_reveal', 'retry_recovery', 'cancel_recovery'],
	async sample(page) {
		const errorStarted = await page.evaluate(() => performance.now());
		await page.locator('#async-reject').click();
		await page.waitForFunction(() => document.querySelector('#async-status')?.textContent === 'error');
		const errorAt = await page.evaluate(() => performance.now());
		const retryStarted = errorAt;
		await page.locator('#async-resolve').click();
		await page.waitForFunction(() => document.querySelector('#async-status')?.textContent === 'resolved');
		const recoveredAt = await page.evaluate(() => performance.now());
		await page.locator('#async-slow').click();
		await page.waitForFunction(() => document.querySelector('#async-status')?.textContent === 'pending');
		const cancelStarted = await page.evaluate(() => performance.now());
		await page.locator('#async-resolve').click();
		await page.waitForFunction(
			() =>
				document.querySelector('#async-status')?.textContent === 'resolved' &&
				window.runtimeStress.stats.async.cancelled === 1,
		);
		const completed = await page.evaluate(() => performance.now());
		const state = await page.evaluate(() => window.runtimeStress.stats.async);
		if (state.rejections !== 1 || state.resolutions !== 2 || state.cancelled !== 1) {
			throw new Error('async recovery state is incorrect');
		}
		return {
			ops: {
				error_reveal: errorAt - errorStarted,
				retry_recovery: recoveredAt - retryStarted,
				cancel_recovery: completed - cancelStarted,
			},
			meta: state,
		};
	},
});

const eventDelegation = makeSuite({
	fixture: 'event-delegation',
	name: 'event-delegation',
	ops: ['delegated_input_burst'],
	async sample(page) {
		const result = await page.evaluate((count) => {
			let bubbled = 0;
			let captured = 0;
			const onBubble = () => bubbled++;
			const onCapture = () => captured++;
			document.addEventListener('input', onBubble);
			document.addEventListener('input', onCapture, true);
			const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
			const started = performance.now();
			for (let index = 0; index < count; index++) {
				const input = document.querySelector(`input[data-field-index="${index}"]`);
				valueDescriptor.set.call(input, `event-${index}`);
				input.dispatchEvent(new InputEvent('input', { bubbles: true }));
			}
			const dispatchedAt = performance.now();
			document.removeEventListener('input', onBubble);
			document.removeEventListener('input', onCapture, true);
			return { bubbled, captured, dispatchedAt, started };
		}, EVENT_DISPATCH_COUNT);
		if (result.bubbled !== EVENT_DISPATCH_COUNT || result.captured !== EVENT_DISPATCH_COUNT) {
			throw new Error('delegated input burst lost events');
		}
		await page.waitForFunction(
			(count) =>
				Array.from({ length: count }, (_, index) => index).every(
					(index) =>
						document.querySelector(`[data-field-output="${index}"]`)?.textContent === `event-${index}`,
				),
			EVENT_DISPATCH_COUNT,
		);
		const completedAt = await page.evaluate(() => performance.now());
		return { ops: { delegated_input_burst: completedAt - result.started }, meta: { ...result, completedAt } };
	},
});

const applicationComposition = makeSuite({
	fixture: 'application-composition',
	name: 'application-composition',
	ops: ['mount_dashboard', 'interact_and_recover', 'teardown_dashboard'],
	async sample(page) {
		const started = await page.evaluate(() => performance.now());
		await page.locator('#lifecycle-toggle').click();
		await page.locator('#store-toggle').click();
		await page.waitForFunction(
			({ rows, subscribers }) =>
				document.querySelectorAll('[data-lifecycle-row]').length === rows &&
				document.querySelectorAll('[data-subscriber-index]').length === subscribers,
			{ rows: LIFECYCLE_ROWS, subscribers: STORE_SUBSCRIBERS },
		);
		const mounted = await page.evaluate(() => performance.now());
		const input = page.locator('input[data-field-index="37"]');
		await Promise.all([
			page.evaluate(() => window.runtimeStress.store.writeAll(7)),
			input.pressSequentially('composed dashboard'),
		]);
		await page.locator('#async-reject').click();
		await page.waitForFunction(() => document.querySelector('#async-status')?.textContent === 'error');
		await page.locator('#async-resolve').click();
		await page.waitForFunction(() => document.querySelector('#async-status')?.textContent === 'resolved');
		await page.locator('#form-submit').click();
		const composed = await page.evaluate(() => performance.now());
		await page.locator('#store-toggle').click();
		await page.locator('#lifecycle-toggle').click();
		await page.waitForFunction(
			() =>
				window.runtimeStress.store.size === 0 &&
				document.querySelectorAll('[data-lifecycle-row]').length === 0,
		);
		const completed = await page.evaluate(() => performance.now());
		const state = await page.evaluate(() => ({
			form: window.runtimeStress.stats.form.lastSubmission?.['field-37'],
			lifecycle: window.runtimeStress.stats.lifecycle,
			storeSize: window.runtimeStress.store.size,
		}));
		if (
			state.form !== 'composed dashboard' ||
			state.lifecycle.mounts !== state.lifecycle.cleanups ||
			state.storeSize !== 0
		) {
			throw new Error('application composition retained stale state');
		}
		return {
			ops: {
				mount_dashboard: mounted - started,
				interact_and_recover: composed - mounted,
				teardown_dashboard: completed - composed,
			},
			meta: state,
		};
	},
});

const scalingCurves = makeSuite({
	fixture: 'scaling-curves',
	name: 'scaling-curves',
	ops: SCALE_LEVELS.map((count) => `update_${count}`),
	async sample(page) {
		const ops = {};
		for (const count of SCALE_LEVELS) {
			const started = await page.evaluate((size) => {
				const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
				const timestamp = performance.now();
				for (let index = 0; index < size; index++) {
					const input = document.querySelector(`input[data-field-index="${index}"]`);
					valueDescriptor.set.call(input, `scale-${size}-${index}`);
					input.dispatchEvent(new InputEvent('input', { bubbles: true }));
				}
				return timestamp;
			}, count);
			await page.waitForFunction(
				(size) =>
					Array.from({ length: size }, (_, index) => index).every(
						(index) =>
							document.querySelector(`[data-field-output="${index}"]`)?.textContent ===
							`scale-${size}-${index}`,
					),
				count,
			);
			ops[`update_${count}`] = (await page.evaluate(() => performance.now())) - started;
		}
		return { ops, meta: { fields: FORM_FIELDS, levels: SCALE_LEVELS } };
	},
});

export const runtimeSuites = [
	applicationComposition,
	controlledForm,
	eventDelegation,
	externalStore,
	lifecycle,
	scalingCurves,
	scheduler,
	suspenseRecovery,
];
