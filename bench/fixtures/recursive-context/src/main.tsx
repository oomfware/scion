import { createContext, createRoot, flushSync, memo, useContext, useState } from 'runtime-under-test';

const DEPTH = 10;
const MID_DEPTH = 5;
const MID_PATH = 'L'.repeat(MID_DEPTH);
const RootContext = createContext(0);
const LocalContext = createContext(0);

let setRoot: ((update: (value: number) => number) => void) | null = null;
let setLocal: ((update: (value: number) => number) => void) | null = null;
let setVisible: ((visible: boolean) => void) | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const Leaf = ({ path }: { path: string }) => {
	const rootValue = useContext(RootContext);
	const local = useContext(LocalContext);
	return <span className="leaf">{`${path}|${rootValue}:${local}`}</span>;
};

const Mid = ({ depth, path }: { depth: number; path: string }) => {
	const [local, bindLocal] = useState(0);
	const [visible, bindVisible] = useState(true);
	setLocal = bindLocal;
	setVisible = bindVisible;
	if (!visible) {
		return null;
	}
	return (
		<LocalContext.Provider value={local}>
			<div className="mid">
				<Node depth={depth - 1} path={`${path}L`} />
				<Node depth={depth - 1} path={`${path}R`} />
			</div>
		</LocalContext.Provider>
	);
};

const Node = memo(({ depth, path }: { depth: number; path: string }) => {
	if (depth === 0) {
		return <Leaf path={path} />;
	}
	if (path === MID_PATH) {
		return <Mid depth={depth} path={path} />;
	}
	return (
		<div className="n">
			<Node depth={depth - 1} path={`${path}L`} />
			<Node depth={depth - 1} path={`${path}R`} />
		</div>
	);
});

const App = () => {
	const [value, bindRoot] = useState(0);
	setRoot = bindRoot;
	return (
		<RootContext.Provider value={value}>
			<Node depth={DEPTH} path="" />
		</RootContext.Provider>
	);
};

const container = document.getElementById('main');
if (container === null) {
	throw new Error('missing #main root');
}

export const benchRecursiveContext = {
	mount: () => {
		root = createRoot(container);
		flushSync(() => root?.render(<App />));
	},
	partialRemount: () => flushSync(() => setVisible?.(true)),
	partialUnmount: () => flushSync(() => setVisible?.(false)),
	unmount: () => {
		const mounted = root;
		root = null;
		flushSync(() => mounted?.unmount());
	},
	updatePartial: () => flushSync(() => setLocal?.((value) => value + 1)),
	updateRoot: () => flushSync(() => setRoot?.((value) => value + 1)),
};

declare global {
	interface Window {
		benchRecursiveContext: typeof benchRecursiveContext;
	}
}
window.benchRecursiveContext = benchRecursiveContext;
