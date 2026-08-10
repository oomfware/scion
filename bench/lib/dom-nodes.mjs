// adapted from octane (MIT), copyright (c) 2026 Dominic Gannaway.

/**
 * counts DOM nodes by kind.
 *
 * @param rootSelector root selector
 * @returns node counts and comment histograms
 * @throws if the root does not exist
 */
export function censusDomNodes(rootSelector = '#main') {
	const root = rootSelector === 'body' ? document.body : document.querySelector(rootSelector);
	if (root === null) {
		throw new Error(`DOM census root not found: ${rootSelector}`);
	}

	let total = 0;
	let elements = 0;
	let text = 0;
	let comments = 0;
	let emptyText = 0;
	let whitespaceText = 0;
	const commentsByData = Object.create(null);
	const commentParents = Object.create(null);
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
	while (walker.nextNode()) {
		const node = walker.currentNode;
		total++;
		if (node.nodeType === Node.ELEMENT_NODE) {
			elements++;
		} else if (node.nodeType === Node.TEXT_NODE) {
			text++;
			const value = node.nodeValue || '';
			if (value.length === 0) {
				emptyText++;
			} else if (value.trim().length === 0) {
				whitespaceText++;
			}
		} else if (node.nodeType === Node.COMMENT_NODE) {
			comments++;
			const data = node.nodeValue || '';
			commentsByData[data] = (commentsByData[data] || 0) + 1;
			const parent = node.parentElement;
			const parentKey =
				parent === null
					? '(non-element)'
					: parent.localName +
						(parent.id ? '#' + parent.id : '') +
						(parent.classList.length ? '.' + [...parent.classList].join('.') : '');
			commentParents[parentKey] = (commentParents[parentKey] || 0) + 1;
		}
	}

	const sortedEntries = (record) =>
		Object.fromEntries(
			// oxlint-disable-next-line unicorn/no-array-sort
			Object.entries(record).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
		);
	return {
		root: root === document.body ? 'body' : root.id ? '#' + root.id : rootSelector,
		total,
		elements,
		text,
		comments,
		emptyText,
		whitespaceText,
		commentsByData: sortedEntries(commentsByData),
		commentParents: sortedEntries(commentParents),
	};
}

/**
 * wraps a deterministic count as a stat.
 *
 * @param value the counted value
 * @returns a zero-variance stat
 */
export function deterministicCount(value) {
	return { median: value, min: value, samples: [value] };
}

/**
 * serializes a deterministic stat.
 *
 * @param stat deterministic stat
 * @returns the serialized stat
 */
export function deterministicStatForJson(stat) {
	return {
		median: stat.median,
		min: stat.min,
		samples: Array.isArray(stat.samples) ? stat.samples.length : stat.samples,
	};
}
