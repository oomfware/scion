import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { deterministicStatForJson } from './lib/dom-nodes.mjs';
import { COLUMNS, buildFixture, serveFixture } from './lib/fixture.mjs';
import { scoreOf, timingStatForJson } from './lib/stats.mjs';
import { suite as chatStream } from './suites/chat-stream.mjs';
import { suite as dbmon } from './suites/dbmon.mjs';
import { suite as effectfulList } from './suites/effectful-list.mjs';
import { suite as externalStoreIntegrations } from './suites/external-store-integrations.mjs';
import { suite as jsFramework } from './suites/js-framework.mjs';
import { suite as listClear } from './suites/list-clear.mjs';
import { suite as memoWall } from './suites/memo-wall.mjs';
import { suite as portalSwarm } from './suites/portal-swarm.mjs';
import { suite as recursiveContext } from './suites/recursive-context.mjs';
import { runtimeSuites } from './suites/runtime-stress.mjs';
import { suite as todoMvc } from './suites/todomvc.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUITES = [
	jsFramework,
	todoMvc,
	dbmon,
	memoWall,
	effectfulList,
	listClear,
	portalSwarm,
	recursiveContext,
	chatStream,
	externalStoreIntegrations,
	...runtimeSuites,
];
const ITERATIONS = { normal: 8, quick: 3 };

const args = process.argv.slice(2);
const flags = new Set(args.filter((value) => value.startsWith('--')));
const named = args.filter((value) => !value.startsWith('--'));

if (flags.has('--list')) {
	for (const suite of SUITES) {
		console.log(suite.name);
	}
	process.exit(0);
}

const iterationsFlag = args.find((value) => value.startsWith('--iterations='));
const iterations = iterationsFlag
	? Number.parseInt(iterationsFlag.slice('--iterations='.length), 10)
	: flags.has('--quick')
		? ITERATIONS.quick
		: ITERATIONS.normal;
if (!Number.isSafeInteger(iterations) || iterations < 1) {
	throw new Error('iterations must be a positive integer');
}

const runtimesFlag = args.find((value) => value.startsWith('--runtimes='));
const selectedColumns = runtimesFlag ? runtimesFlag.slice('--runtimes='.length).split(',') : COLUMNS;
if (
	selectedColumns.length === 0 ||
	new Set(selectedColumns).size !== selectedColumns.length ||
	selectedColumns.some((column) => !COLUMNS.includes(column))
) {
	throw new Error(`runtimes must be a comma-separated subset of: ${COLUMNS.join(', ')}`);
}

const selected = named.length === 0 ? SUITES : SUITES.filter((suite) => named.includes(suite.name));
for (const name of named) {
	if (!SUITES.some((suite) => suite.name === name)) {
		throw new Error(`unknown suite: ${name}`);
	}
}

// #region driving

const runColumn = async ({ column, suite }) => {
	const fixtureDir = path.join(HERE, 'fixtures', suite.fixture);
	const outDir = path.join(HERE, 'dist', suite.fixture, column);
	await buildFixture({ column, fixtureDir, outDir });

	const server = await serveFixture(outDir);
	const browser = await chromium.launch({
		headless: true,
		args: ['--disable-extensions', '--js-flags=--expose-gc'],
	});
	try {
		const context = await browser.newContext();
		const page = await context.newPage();
		const failures = [];
		page.on('pageerror', (error) => failures.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') {
				failures.push(message.text());
			}
		});

		await page.goto(server.origin, { waitUntil: 'load' });
		await suite.waitForReady(page);
		const result = await suite.measure({ page, iterations });
		if (failures.length > 0) {
			throw new Error(`${column} reported browser errors: ${failures.join('; ')}`);
		}
		return result;
	} finally {
		await browser.close();
		await server.close();
	}
};

// #endregion

// #region reporting

const format = (stat) =>
	stat.score == null ? String(stat.median) : `${stat.score.toFixed(2)} (min ${stat.min.toFixed(2)})`;

const report = ({ columns, results, suite }) => {
	const width = 24;
	const label = Math.max(...suite.ops.map((op) => op.length), 14);
	const opNames = Object.keys(results[columns[0]].ops);

	console.log();
	console.log('op'.padEnd(label) + ' | ' + columns.map((name) => name.padEnd(width)).join('| '));
	console.log('-'.repeat(label) + '-+-' + columns.map(() => '-'.repeat(width)).join('+-'));
	for (const op of opNames) {
		const row = [op.padEnd(label)];
		for (const column of columns) {
			row.push(format(results[column].ops[op]).padEnd(width));
		}
		console.log(row.join(' | '));
	}

	const [subject, ...references] = columns;
	for (const reference of references) {
		console.log();
		console.log(`${subject} / ${reference}, by score:`);
		for (const op of opNames) {
			const subjectScore = scoreOf(results[subject].ops[op]);
			const referenceScore = scoreOf(results[reference].ops[op]);
			if (subjectScore === null || referenceScore === null || referenceScore === 0) {
				continue;
			}
			const ratio = subjectScore / referenceScore;
			const verdict = ratio < 0.95 ? 'faster' : ratio > 1.05 ? 'slower' : 'about equal';
			console.log(`  ${op.padEnd(label)} ${ratio.toFixed(2)}x  ${verdict}`);
		}
	}
};

const writeResults = ({ columns, results, suite }) => {
	const directory = path.join(HERE, 'results');
	fs.mkdirSync(directory, { recursive: true });
	const file = path.join(directory, `${suite.name}.json`);
	const payload = {
		suite: suite.name,
		iterations,
		targets: columns.map((column) => ({
			name: column,
			ops: Object.fromEntries(
				Object.entries(results[column].ops).map(([name, stat]) => [
					name,
					stat.score == null ? deterministicStatForJson(stat) : timingStatForJson(stat),
				]),
			),
			meta: results[column].meta ?? {},
		})),
	};
	fs.writeFileSync(file, JSON.stringify(payload, null, '\t') + '\n');
	console.log();
	console.log(`results written to ${path.relative(process.cwd(), file)}`);
};

// #endregion

for (const suite of selected) {
	const columns = selectedColumns.filter((column) => suite.runtimes?.includes(column) ?? true);
	if (columns.length === 0) {
		throw new Error(`${suite.name} supports none of the selected runtimes`);
	}
	const results = {};
	for (const column of columns) {
		console.error(`building and running ${suite.name} on ${column} × ${iterations}…`);
		results[column] = await runColumn({ column, suite });
	}
	report({ columns, results, suite });
	writeResults({ columns, results, suite });
}
