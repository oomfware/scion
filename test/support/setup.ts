// react's `act` refuses to run unless the environment opts in.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (!Reflect.has(Element.prototype, 'moveBefore')) {
	Object.defineProperty(Element.prototype, 'moveBefore', {
		configurable: true,
		value(this: Element, node: Node, before: Node | null) {
			this.insertBefore(node, before);
		},
		writable: true,
	});
	Object.defineProperty(DocumentFragment.prototype, 'moveBefore', {
		configurable: true,
		value(this: DocumentFragment, node: Node, before: Node | null) {
			this.insertBefore(node, before);
		},
		writable: true,
	});
}
