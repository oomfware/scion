import { censusDomNodes, deterministicCount } from '../lib/dom-nodes.mjs';
import { summarizeSamples } from '../lib/stats.mjs';

const TODO_COUNT = 100;
const TIMED_OPS = [
	{ name: 'add100', pre: 'empty' },
	{ name: 'toggleAllOn', pre: 'items' },
	{ name: 'toggleAllOff', pre: 'items-completed' },
	{ name: 'complete25', pre: 'items' },
	{ name: 'filterCycle', pre: 'items-quarter' },
	{ name: 'edit10', pre: 'items' },
	{ name: 'clearCompleted', pre: 'items-quarter' },
	{ name: 'destroy25', pre: 'items' },
];
const OBSERVATION_OPS = [
	'row_class_writes_complete25',
	'nodes_100',
	'elements_100',
	'text_100',
	'comments_100',
	'empty_text_100',
	'whitespace_text_100',
];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const runTodoMvcAction = (input) => {
	const query = (selector) => {
		const element = document.querySelector(selector);
		if (element === null) {
			throw new Error(`TodoMVC selector not found: ${selector}`);
		}
		return element;
	};
	const queryAll = (selector) => Array.from(document.querySelectorAll(selector));
	const key = (element, value) => {
		element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value }));
	};
	const doubleClick = (element) => {
		element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
	};
	const addTodo = (element, title) => {
		element.value = title;
		key(element, 'Enter');
	};
	const count = (selector) => document.querySelectorAll(selector).length;
	const expect = (condition, message) => {
		if (!condition) {
			throw new Error(`TodoMVC verification failed: ${message}`);
		}
	};
	const quarterCount = input.todoCount / 4;
	const remainingAfterQuarter = input.todoCount - quarterCount;
	const completeQuarter = (toggles) => {
		for (let index = 0; index < input.todoCount; index += 4) {
			toggles[index].click();
		}
	};
	const verifyQuarter = (context) => {
		expect(count('.todo-list li.completed') === quarterCount, `${context} completed count`);
		expect(
			query('.todo-count strong').textContent === String(remainingAfterQuarter),
			`${context} remaining count`,
		);
	};

	if (input.kind === 'prepare') {
		const allFilter = () => {
			const all = document.querySelector('.filters a[data-filter="all"]');
			if (all !== null && !all.classList.contains('selected')) {
				all.click();
			}
		};
		const reset = () => {
			if (document.querySelector('.main') === null) {
				return;
			}
			const toggleAll = query('.toggle-all');
			if (!toggleAll.checked) {
				toggleAll.click();
			}
			query('.clear-completed').click();
			expect(document.querySelector('.main') === null, 'reset left items');
		};
		const fill = () => {
			const newTodo = query('.new-todo');
			for (let index = 0; index < input.todoCount; index++) {
				addTodo(newTodo, `Something to do ${index}`);
			}
			expect(count('.todo-list li') === input.todoCount, 'fill failed');
		};

		allFilter();
		reset();
		switch (input.state) {
			case 'empty': {
				break;
			}
			case 'items': {
				fill();
				break;
			}
			case 'items-completed': {
				fill();
				query('.toggle-all').click();
				expect(count('.todo-list li.completed') === input.todoCount, 'pre items-completed');
				break;
			}
			case 'items-quarter': {
				fill();
				completeQuarter(queryAll('.todo-list li .toggle'));
				verifyQuarter('pre items-quarter');
				break;
			}
			default: {
				throw new Error(`unknown TodoMVC state: ${input.state}`);
			}
		}
		return 0;
	}

	if (input.kind === 'class-writes') {
		let writes = 0;
		const countWrites = (records) => {
			for (const record of records) {
				if (record.target.localName === 'li') {
					writes++;
				}
			}
		};
		const observer = new MutationObserver(countWrites);
		observer.observe(query('.todo-list'), {
			attributeFilter: ['class'],
			attributes: true,
			subtree: true,
		});
		try {
			completeQuarter(queryAll('.todo-list li .toggle'));
			countWrites(observer.takeRecords());
		} finally {
			observer.disconnect();
		}
		verifyQuarter('class-write sample');
		return writes;
	}

	let action;
	switch (input.operation) {
		case 'add100': {
			const newTodo = query('.new-todo');
			action = () => {
				for (let index = 0; index < input.todoCount; index++) {
					addTodo(newTodo, `Something to do ${index}`);
				}
			};
			break;
		}
		case 'toggleAllOn':
		case 'toggleAllOff': {
			const toggleAll = query('.toggle-all');
			action = () => {
				toggleAll.click();
			};
			break;
		}
		case 'complete25': {
			const toggles = queryAll('.todo-list li .toggle');
			action = () => {
				completeQuarter(toggles);
			};
			break;
		}
		case 'filterCycle': {
			const active = query('.filters a[data-filter="active"]');
			const all = query('.filters a[data-filter="all"]');
			const completed = query('.filters a[data-filter="completed"]');
			action = () => {
				active.click();
				completed.click();
				all.click();
			};
			break;
		}
		case 'edit10': {
			const rows = queryAll('.todo-list li').slice(0, 10);
			action = () => {
				for (let index = 0; index < rows.length; index++) {
					const row = rows[index];
					doubleClick(row.querySelector('label'));
					const edit = row.querySelector('.edit');
					edit.value = `edited ${index}`;
					key(edit, 'Enter');
				}
			};
			break;
		}
		case 'clearCompleted': {
			const clearCompleted = query('.clear-completed');
			action = () => {
				clearCompleted.click();
			};
			break;
		}
		case 'destroy25': {
			const destroyButtons = queryAll('.todo-list li .destroy').slice(0, quarterCount);
			action = () => {
				for (const destroy of destroyButtons) {
					destroy.click();
				}
			};
			break;
		}
		default: {
			throw new Error(`unknown TodoMVC operation: ${input.operation}`);
		}
	}

	(window.gc ?? (() => {}))();
	const started = performance.now();
	action();
	const elapsed = performance.now() - started;

	switch (input.operation) {
		case 'add100': {
			expect(count('.todo-list li') === input.todoCount, `add100 rendered ${count('.todo-list li')}`);
			expect(query('.todo-count strong').textContent === String(input.todoCount), 'count after add100');
			break;
		}
		case 'toggleAllOn': {
			expect(count('.todo-list li.completed') === input.todoCount, 'toggleAllOn completed count');
			expect(query('.todo-count strong').textContent === '0', 'count after toggleAllOn');
			break;
		}
		case 'toggleAllOff': {
			expect(count('.todo-list li.completed') === 0, 'toggleAllOff completed count');
			expect(query('.todo-count strong').textContent === String(input.todoCount), 'count after toggleAllOff');
			break;
		}
		case 'complete25': {
			verifyQuarter('complete25');
			break;
		}
		case 'filterCycle': {
			expect(count('.todo-list li') === input.todoCount, 'filterCycle back to all');
			expect(query('.filters a[data-filter="all"]').classList.contains('selected'), 'all selected');
			break;
		}
		case 'edit10': {
			expect(count('.todo-list li .edit') === 0, 'edit10 left an editor open');
			const labels = queryAll('.todo-list li label')
				.slice(0, 10)
				.map((label) => label.textContent);
			for (let index = 0; index < labels.length; index++) {
				expect(labels[index] === `edited ${index}`, `edit10 label ${index} = ${labels[index]}`);
			}
			break;
		}
		case 'clearCompleted': {
			expect(
				count('.todo-list li') === remainingAfterQuarter,
				`clearCompleted left ${count('.todo-list li')}`,
			);
			expect(document.querySelector('.clear-completed') === null, 'clear-completed still visible');
			break;
		}
		case 'destroy25': {
			expect(count('.todo-list li') === remainingAfterQuarter, `destroy25 left ${count('.todo-list li')}`);
			break;
		}
	}
	return elapsed;
};

const ensureState = async (page, state) => {
	await page.evaluate(runTodoMvcAction, { kind: 'prepare', state, todoCount: TODO_COUNT });
	await sleep(15);
};

const timeOp = (page, operation) =>
	page.evaluate(runTodoMvcAction, {
		kind: 'time',
		operation: operation.name,
		todoCount: TODO_COUNT,
	});

const countRowClassWritesDuringComplete25 = async (page) => {
	await ensureState(page, 'items');
	return page.evaluate(runTodoMvcAction, {
		kind: 'class-writes',
		todoCount: TODO_COUNT,
	});
};

export const suite = {
	fixture: 'todomvc',
	name: 'todomvc',
	ops: [...TIMED_OPS.map((operation) => operation.name), ...OBSERVATION_OPS],

	waitForReady(page) {
		return page.waitForSelector('.new-todo', { timeout: 10_000 });
	},

	async measure({ page, iterations }) {
		for (const operation of TIMED_OPS) {
			await ensureState(page, operation.pre);
			await timeOp(page, operation);
		}
		await ensureState(page, 'empty');

		const ops = {};
		for (const operation of TIMED_OPS) {
			const samples = [];
			for (let index = 0; index < iterations; index++) {
				await ensureState(page, operation.pre);
				samples.push(await timeOp(page, operation));
				await sleep(40);
			}
			ops[operation.name] = summarizeSamples(samples);
		}

		ops.row_class_writes_complete25 = deterministicCount(await countRowClassWritesDuringComplete25(page));
		await ensureState(page, 'items');
		const census = await page.evaluate(censusDomNodes, '#main');
		ops.nodes_100 = deterministicCount(census.total);
		ops.elements_100 = deterministicCount(census.elements);
		ops.text_100 = deterministicCount(census.text);
		ops.comments_100 = deterministicCount(census.comments);
		ops.empty_text_100 = deterministicCount(census.emptyText);
		ops.whitespace_text_100 = deterministicCount(census.whitespaceText);

		return { meta: { dom: census }, ops };
	},
};
