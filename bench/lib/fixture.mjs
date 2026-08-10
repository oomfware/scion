import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const BENCH_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const COLUMNS = ['scion', 'react', 'preact', 'redact'];

const JSX_RUNTIME = {
	scion: '@oomfware/scion/jsx-runtime',
	preact: 'preact/compat/jsx-runtime',
	redact: '@tanstack/redact/jsx-runtime',
};

const CONTENT_TYPES = {
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.map': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
};

// prevent reference columns from silently loading React.
const forbidReact = (column) => ({
	name: 'bench:forbid-react',
	resolveId(source, importer) {
		if (/^react(-dom)?(\/|$)/.test(source)) {
			throw new Error(
				`the ${column} column resolved '${source}'` +
					(importer ? ` from ${importer}` : '') +
					': the fixture must reach its runtime through that package’s own exports',
			);
		}
		return null;
	},
});

/**
 * builds one fixture column.
 *
 * @param options build options
 * @param options.column runtime from `COLUMNS`
 * @param options.fixtureDir absolute path to the fixture root
 * @param options.outDir output directory
 * @returns nothing
 * @throws if a non-react column imports React
 */
export const buildFixture = async ({ column, fixtureDir, outDir }) => {
	const alias = {
		'runtime-under-test': path.join(BENCH_ROOT, 'runtimes', `${column}.ts`),
	};
	if (column in JSX_RUNTIME) {
		alias['react/jsx-runtime'] = JSX_RUNTIME[column];
	}

	await build({
		root: fixtureDir,
		mode: 'production',
		logLevel: 'warn',
		configFile: false,
		plugins: column === 'react' ? [] : [forbidReact(column)],
		resolve: { alias },
		define: { 'process.env.NODE_ENV': JSON.stringify('production') },
		build: {
			outDir,
			emptyOutDir: true,
			target: 'esnext',
			modulePreload: { polyfill: false },
		},
	});
};

/**
 * serves a fixture on loopback.
 *
 * @param directory build output
 * @returns the server origin and close function
 * @throws if no TCP port is available
 */
export const serveFixture = async (directory) => {
	const indexHtml = path.join(directory, 'index.html');
	const server = createServer((request, response) => {
		try {
			const url = new URL(request.url ?? '/', 'http://127.0.0.1');
			const file =
				url.pathname === '/' ? indexHtml : path.resolve(directory, `.${decodeURIComponent(url.pathname)}`);
			if (
				(file === indexHtml || file.startsWith(`${directory}${path.sep}`)) &&
				fs.existsSync(file) &&
				fs.statSync(file).isFile()
			) {
				response.setHeader('content-type', CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream');
				response.end(fs.readFileSync(file));
				return;
			}
			response.statusCode = 404;
			response.end('not found');
		} catch (error) {
			response.statusCode = 500;
			response.end(error instanceof Error ? error.message : String(error));
		}
	});

	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});

	const address = server.address();
	if (address === null || typeof address === 'string') {
		throw new Error('the fixture server did not expose a TCP port');
	}
	return {
		origin: `http://127.0.0.1:${address.port}`,
		close: () => new Promise((resolve) => server.close(resolve)),
	};
};
