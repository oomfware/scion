import {
	createContext,
	createElement,
	createRoot,
	flushSync,
	memo,
	useContext,
	useState,
} from 'runtime-under-test';

const ROW_COUNT = 1000;
const MID = ROW_COUNT >> 1;

interface Item {
	id: number;
	label: string;
	value: number;
}

interface WallBindings {
	setItems: (items: Item[]) => void;
	setTheme: (theme: string) => void;
	setTick: (tick: number) => void;
}

type Wall = 'A' | 'B';
type RenderKey = 'innerA' | 'innerB' | 'leafA' | 'leafB' | 'rowA' | 'rowB';
type RenderCounts = Record<RenderKey, number>;

const makeItems = (): Item[] =>
	Array.from({ length: ROW_COUNT }, (_, index) => ({
		id: index + 1,
		label: `item ${index + 1}`,
		value: (index * 7919) % 10_000,
	}));

let itemsA = makeItems();
let itemsB = makeItems();
let themeA = 0;
let themeB = 0;
let tickA = 0;
let tickB = 0;
let wallA: WallBindings | null = null;
let wallB: WallBindings | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const emptyRenders = (): RenderCounts => ({
	innerA: 0,
	innerB: 0,
	leafA: 0,
	leafB: 0,
	rowA: 0,
	rowB: 0,
});
let renders = emptyRenders();

const ThemeA = createContext('t0');
const ThemeB = createContext('t0');

const Leaf = ({ wall }: { wall: Wall }) => {
	renders[`leaf${wall}`]++;
	const theme = useContext(wall === 'A' ? ThemeA : ThemeB);
	return <span className="leaf">{theme}</span>;
};

const Inner = memo(({ value, wall }: { value: number; wall: Wall }) => {
	renders[`inner${wall}`]++;
	return (
		<span className="inner">
			{value}
			<Leaf wall={wall} />
		</span>
	);
});

const selectRow = () => {};

const Row = memo(({ id, label, value, wall }: Item & { wall: Wall }) => {
	renders[`row${wall}`]++;
	return (
		<div className="item">
			<span className="id" onClick={selectRow}>
				{id}
			</span>
			<span className="label">{label}</span>
			<Inner value={value} wall={wall} />
		</div>
	);
});

const RowsA = ({ items }: { items: Item[] }) => (
	<div className="rows">
		{items.map((item) => (
			<Row id={item.id} key={item.id} label={item.label} value={item.value} wall="A" />
		))}
	</div>
);

const buildRowsB = (items: Item[]) =>
	items.map((item) => createElement(Row, { ...item, key: item.id, wall: 'B' }));

const WallA = () => {
	const [items, setItems] = useState(itemsA);
	const [theme, setTheme] = useState('t0');
	const [tick, setTick] = useState(0);
	wallA = { setItems, setTheme, setTick };
	return (
		<section id="wall-a">
			<span className="tick">{tick}</span>
			<ThemeA.Provider value={theme}>
				<RowsA items={items} />
			</ThemeA.Provider>
		</section>
	);
};

const WallB = () => {
	const [items, setItems] = useState(itemsB);
	const [theme, setTheme] = useState('t0');
	const [tick, setTick] = useState(0);
	wallB = { setItems, setTheme, setTick };
	return (
		<section id="wall-b">
			<span className="tick">{tick}</span>
			<ThemeB.Provider value={theme}>
				<div className="rows">{buildRowsB(items)}</div>
			</ThemeB.Provider>
		</section>
	);
};

const App = () => (
	<div className="walls">
		<WallA />
		<WallB />
	</div>
);

const container = document.getElementById('main');
if (container === null) {
	throw new Error('missing #main root');
}

const changeOne = (wall: Wall) => {
	const current = wall === 'A' ? itemsA : itemsB;
	const next = current.slice();
	const item = next[MID];
	next[MID] = { ...item, value: item.value + 1 };
	if (wall === 'A') {
		itemsA = next;
		wallA?.setItems(next);
	} else {
		itemsB = next;
		wallB?.setItems(next);
	}
};

export const benchMemoWall = {
	mount: () => {
		root = createRoot(container);
		flushSync(() => root?.render(<App />));
	},
	unmount: () => {
		const mounted = root;
		root = null;
		wallA = null;
		wallB = null;
		flushSync(() => mounted?.unmount());
	},
	parentA: () => flushSync(() => wallA?.setTick(++tickA)),
	parentB: () => flushSync(() => wallB?.setTick(++tickB)),
	changeA: () => flushSync(() => changeOne('A')),
	changeB: () => flushSync(() => changeOne('B')),
	contextA: () => flushSync(() => wallA?.setTheme(`t${++themeA}`)),
	contextB: () => flushSync(() => wallB?.setTheme(`t${++themeB}`)),
	resetRenders: () => {
		renders = emptyRenders();
	},
	renders: () => ({ ...renders }),
	state: () => ({
		mid: MID,
		midValueA: itemsA[MID].value,
		midValueB: itemsB[MID].value,
		themeA: `t${themeA}`,
		themeB: `t${themeB}`,
	}),
};

declare global {
	interface Window {
		benchMemoWall: typeof benchMemoWall;
	}
}

window.benchMemoWall = benchMemoWall;
