import {
	createRoot,
	flushSync,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'runtime-under-test';

interface Item {
	id: number;
	label: string;
	probe: boolean;
	value: number;
}

interface Counters {
	cleanups: number;
	height: number;
	layouts: number;
	mounts: number;
	refCleanups: number;
	refs: number;
}

const counters: Counters = {
	cleanups: 0,
	height: 0,
	layouts: 0,
	mounts: 0,
	refCleanups: 0,
	refs: 0,
};

let idBase = 0;
let current: Item[] = [];
let setItems: ((items: Item[]) => void) | null = null;
let setTick: ((update: (tick: number) => number) => void) | null = null;

const buildItems = (count: number, base: number): Item[] =>
	Array.from({ length: count }, (_, index) => ({
		id: base + index,
		label: `row ${base + index}`,
		probe: index % 10 === 0,
		value: (base + index * 17) % 100,
	}));

const resetCounters = () => {
	counters.cleanups = 0;
	counters.height = 0;
	counters.layouts = 0;
	counters.mounts = 0;
	counters.refCleanups = 0;
	counters.refs = 0;
};

const Row = ({ item }: { item: Item }) => {
	const cell = useRef<HTMLTableCellElement>(null);
	const rowRef = useCallback((element: HTMLTableRowElement | null) => {
		if (element === null) {
			return undefined;
		}
		counters.refs++;
		return () => {
			counters.refCleanups++;
		};
	}, []);
	useEffect(() => {
		counters.mounts++;
		return () => {
			counters.cleanups++;
		};
	}, [item.id]);
	useLayoutEffect(() => {
		if (item.probe && cell.current !== null) {
			counters.height += cell.current.offsetHeight;
			counters.layouts++;
		}
	}, [item.value]);
	return (
		<tr ref={rowRef}>
			<td ref={cell}>{item.id}</td>
			<td>{item.label}</td>
			<td>{item.value}</td>
		</tr>
	);
};

const apply = (items: Item[]) => {
	current = items;
	setItems?.(items);
};

const fresh = () => {
	idBase += 1000;
	apply(buildItems(1000, idBase));
};

const App = () => {
	const [items, bindItems] = useState(current);
	const [tick, bindTick] = useState(0);
	setItems = bindItems;
	setTick = bindTick;
	return (
		<div>
			<span className="tick">{tick}</span>
			<table>
				<tbody>
					{items.map((item) => (
						<Row item={item} key={item.id} />
					))}
				</tbody>
			</table>
		</div>
	);
};

const container = document.getElementById('main');
if (container === null) {
	throw new Error('missing #main root');
}
const root = createRoot(container);
flushSync(() => root.render(<App />));

export const benchEffectfulList = {
	clear: () => flushSync(() => apply([])),
	fresh: () => flushSync(fresh),
	remove100: () => flushSync(() => apply(current.filter((_, index) => index % 10 !== 0))),
	updateDeps: () =>
		flushSync(() =>
			apply(
				current.map((item) => ({ id: item.id, label: item.label, probe: item.probe, value: item.value + 1 })),
			),
		),
	updateNoDeps: () => flushSync(() => setTick?.((tick) => tick + 1)),
	counters: () => ({ ...counters }),
	resetCounters,
};

declare global {
	interface Window {
		benchEffectfulList: typeof benchEffectfulList;
	}
}
window.benchEffectfulList = benchEffectfulList;
