export const DB_COUNT = 1000;
export const QUERIES_PER_DB = 5;

export interface Query {
	elapsed: string;
	className: string;
}

export interface Database {
	id: number;
	name: string;
	count: number;
	countClass: string;
	queries: Query[];
}

const rng = (seed: number) => {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
};

const elapsedClass = (elapsed: number) => {
	if (elapsed >= 10) {
		return 'elapsed warn_long';
	}
	if (elapsed >= 1) {
		return 'elapsed warn';
	}
	return 'elapsed short';
};

const countClass = (count: number) => {
	if (count >= 20) {
		return 'label label-important';
	}
	if (count >= 10) {
		return 'label label-warning';
	}
	return 'label label-success';
};

const queriesFor = (random: () => number): Query[] => {
	const queries: Query[] = [];
	for (let index = 0; index < QUERIES_PER_DB; index++) {
		const elapsed = random() * 15;
		queries.push({ elapsed: elapsed.toFixed(2), className: elapsedClass(elapsed) });
	}
	return queries;
};

/**
 * builds one dataset frame.
 *
 * @param count row count
 * @param idBase first row ID
 * @param seed random seed
 * @returns rows in ID order
 */
export const makeData = (count: number, idBase: number, seed: number): Database[] => {
	const random = rng(seed);
	const rows: Database[] = [];
	for (let index = 0; index < count; index++) {
		const id = idBase + index;
		const queryCount = (random() * 30) | 0;
		rows.push({
			id,
			name: `cluster-${id}`,
			count: queryCount,
			countClass: countClass(queryCount),
			queries: queriesFor(random),
		});
	}
	return rows;
};
