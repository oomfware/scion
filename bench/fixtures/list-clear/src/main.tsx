import { createRoot, flushSync, useState } from 'runtime-under-test';

interface Item {
	id: number;
	label: string;
}

type Group = 'owned' | 'sharedLarge' | 'sharedSmall';
type Setter = (items: Item[]) => void;

const CONFIG = {
	owned: { groups: 3, items: 1000 },
	sharedLarge: { groups: 3, items: 1000 },
	sharedSmall: { groups: 150, items: 10 },
};
const setters: Record<Group, Setter[]> = { owned: [], sharedLarge: [], sharedSmall: [] };
let sequence = 0;

const buildItems = (count: number): Item[] =>
	Array.from({ length: count }, (_, index) => ({ id: ++sequence, label: `row-${index}` }));

const register = (group: Group, index: number, setter: Setter) => {
	if (setters[group][index] === undefined) {
		setters[group][index] = setter;
	}
};

const Rows = ({ items }: { items: Item[] }) =>
	items.map((item) => (
		<li className="row" key={item.id}>
			<span>{item.label}</span>
			<span>{item.label}</span>
		</li>
	));

const SharedList = ({ group, index }: { group: 'sharedLarge' | 'sharedSmall'; index: number }) => {
	const [items, setItems] = useState<Item[]>([]);
	register(group, index, setItems);
	return (
		<ul className="shared">
			<li className="lead">lead</li>
			<Rows items={items} />
			<li className="tail">tail</li>
		</ul>
	);
};

const OwnedList = ({ index }: { index: number }) => {
	const [items, setItems] = useState<Item[]>([]);
	register('owned', index, setItems);
	return (
		<ul className="owned">
			<Rows items={items} />
		</ul>
	);
};

const repeat = <Value,>(count: number, render: (index: number) => Value): Value[] =>
	Array.from({ length: count }, (_, index) => render(index));

const App = () => (
	<div>
		<div id="shared-small">
			{repeat(CONFIG.sharedSmall.groups, (index) => (
				<SharedList group="sharedSmall" index={index} key={index} />
			))}
		</div>
		<div id="shared-large">
			{repeat(CONFIG.sharedLarge.groups, (index) => (
				<SharedList group="sharedLarge" index={index} key={index} />
			))}
		</div>
		<div id="owned">
			{repeat(CONFIG.owned.groups, (index) => (
				<OwnedList index={index} key={index} />
			))}
		</div>
	</div>
);

const fill = (group: Group) => {
	const items = CONFIG[group].items;
	flushSync(() => {
		for (const setItems of setters[group]) {
			setItems(buildItems(items));
		}
	});
};

const clear = (group: Group) => {
	flushSync(() => {
		for (const setItems of setters[group]) {
			setItems([]);
		}
	});
};

const container = document.getElementById('main');
if (container === null) {
	throw new Error('missing #main root');
}
flushSync(() => createRoot(container).render(<App />));

export const benchListClear = {
	clearOwned: () => clear('owned'),
	clearSharedLarge: () => clear('sharedLarge'),
	clearSharedSmall: () => clear('sharedSmall'),
	fillOwned: () => fill('owned'),
	fillSharedLarge: () => fill('sharedLarge'),
	fillSharedSmall: () => fill('sharedSmall'),
};

declare global {
	interface Window {
		benchListClear: typeof benchListClear;
	}
}
window.benchListClear = benchListClear;
