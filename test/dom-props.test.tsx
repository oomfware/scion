import { expect, test } from 'vitest';

import { expectAgreement, runBoth, transition } from './support/differential.ts';
import type { Scenario } from './support/harness.ts';

test('style objects: values, numbers, unitless properties and removal', async () => {
	await expectAgreement(
		transition(
			<div style={{ color: 'red', width: 10, opacity: 0.5, zIndex: 3, lineHeight: 2, margin: 0 }} />,
			<div style={{ color: 'blue', width: 20 }} />,
		),
	);
});

test('style custom properties are set and removed', async () => {
	await expectAgreement(
		transition(
			<div style={{ '--a': '1px', '--b': '2px', color: 'red' } as any} />,
			<div style={{ '--a': '9px', color: 'red' } as any} />,
		),
	);
});

test('style is cleared entirely when the prop goes away', async () => {
	await expectAgreement(transition(<div style={{ color: 'red', width: 10 }} />, <div />));
});

test('svg camelCase attributes map to their hyphenated names', async () => {
	await expectAgreement(
		transition(
			<svg viewBox="0 0 10 10">
				<path strokeWidth={2} strokeLinecap="round" strokeLinejoin="bevel" clipRule="evenodd" d="M0 0" />
			</svg>,
			<svg viewBox="0 0 20 20">
				<path strokeWidth={3} d="M1 1" />
			</svg>,
		),
	);
});

const hyphenatedProps = [
	'alignmentBaseline',
	'baselineShift',
	'clipPath',
	'clipRule',
	'colorInterpolation',
	'colorInterpolationFilters',
	'colorRendering',
	'dominantBaseline',
	'fillOpacity',
	'fillRule',
	'floodColor',
	'floodOpacity',
	'fontFamily',
	'fontSize',
	'fontSizeAdjust',
	'fontStretch',
	'fontStyle',
	'fontVariant',
	'fontWeight',
	'glyphOrientationVertical',
	'imageRendering',
	'letterSpacing',
	'lightingColor',
	'markerEnd',
	'markerMid',
	'markerStart',
	'paintOrder',
	// react does not hyphenate this name.
	'panose1',
	'pointerEvents',
	'shapeRendering',
	'stopColor',
	'stopOpacity',
	'strokeDasharray',
	'strokeDashoffset',
	'strokeLinecap',
	'strokeLinejoin',
	'strokeMiterlimit',
	'strokeOpacity',
	'strokeWidth',
	'textAnchor',
	'textDecoration',
	'textRendering',
	'transformOrigin',
	'unicodeBidi',
	'vectorEffect',
	'wordSpacing',
	'writingMode',
];

test('every hyphenated attribute name react writes is written the same way', async () => {
	const props = Object.fromEntries(hyphenatedProps.map((name, index) => [name, String(index)]));
	const cleared = Object.fromEntries(hyphenatedProps.map((name) => [name, undefined]));
	await expectAgreement(
		transition(
			<svg>
				<path {...props} />
			</svg>,
			<svg>
				<path {...cleared} />
			</svg>,
		),
	);
});

const droppedProps = [
	'accentHeight',
	'arabicForm',
	'capHeight',
	'colorProfile',
	'enableBackground',
	'glyphName',
	'glyphOrientationHorizontal',
	'horizAdvX',
	'horizOriginX',
	'overlinePosition',
	'overlineThickness',
	'renderingIntent',
	'strikethroughPosition',
	'strikethroughThickness',
	'underlinePosition',
	'underlineThickness',
	'unicodeRange',
	'unitsPerEm',
	'vAlphabetic',
	'vHanging',
	'vIdeographic',
	'vMathematical',
	'vertAdvY',
	'vertOriginX',
	'vertOriginY',
	'xHeight',
];

test('a removed svg font attribute keeps its prop name instead of hyphenating', async () => {
	const props = Object.fromEntries(droppedProps.map((name, index) => [name, String(index)]));
	const { react, scion } = await runBoth(async (scenario) => {
		await scenario.render(
			<svg>
				<path {...props} />
			</svg>,
		);
	});
	expect(scion.dom).toContain('accentHeight="0"');
	expect(react.dom).toContain('accent-height="0"');
	expect(scion.dom).not.toContain('accent-height');
	expect(react.dom).not.toContain('accentHeight');
});

test('a hyphenated name is written on an html element too, not only in svg', async () => {
	await expectAgreement(
		transition(
			<div {...({ clipPath: 'url(#a)', fontSize: '1' } as any)} />,
			<div {...({ fontSize: '2' } as any)} />,
		),
	);
});

test('accept-charset and http-equiv are hyphenated, not lowercased', async () => {
	await expectAgreement(transition(<form acceptCharset="utf-8" />, <form acceptCharset={undefined} />));
});

test('xlink and xml attributes are written into their namespaces', async () => {
	await expectAgreement(
		transition(
			<svg>
				<use xlinkHref="#a" xlinkTitle="t" xmlLang="en" xmlSpace="preserve" />
			</svg>,
			<svg>
				<use xlinkHref="#b" xlinkTitle={undefined} xmlLang={undefined} />
			</svg>,
		),
	);
});

test('a namespaced attribute is reachable through its namespace, not only by name', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(
			<svg>
				<use xlinkHref="#a" xmlLang="en" />
			</svg>,
		);
		const node = scenario.container.querySelector('use')!;
		scenario.log('xlink:href', String(node.getAttributeNS('http://www.w3.org/1999/xlink', 'href')));
		scenario.log('xml:lang', String(node.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang')));
	});
});

test('props react consumes itself never reach the markup', async () => {
	await expectAgreement(
		transition(
			<div suppressContentEditableWarning suppressHydrationWarning contentEditable>
				x
			</div>,
			<div suppressContentEditableWarning={false} contentEditable>
				y
			</div>,
		),
	);
});

test('autoFocus focuses the element instead of rendering an attribute', async () => {
	await expectAgreement(async (scenario) => {
		await scenario.render(<input autoFocus />);
		scenario.log('focused', String(document.activeElement === scenario.container.querySelector('input')));
	});
});

test('a value react refuses to stringify removes the attribute rather than writing its source', async () => {
	await expectAgreement(
		transition(
			<div title="t" aria-label="a" data-x="d" lang="en" />,
			<div
				title={(() => {}) as any}
				aria-label={(() => {}) as any}
				data-x={(() => {}) as any}
				lang={Symbol('s') as any}
			/>,
		),
	);
});

test('svg children stay in the svg namespace and foreignObject returns to html', async () => {
	await expectAgreement(
		transition(
			<svg>
				<g>
					<circle cx={1} cy={2} r={3} />
				</g>
				<foreignObject>
					<div className="inside" />
				</foreignObject>
			</svg>,
			<svg />,
		),
	);
});

test('aria and data attributes are set, updated and removed', async () => {
	await expectAgreement(
		transition(
			<div aria-label="x" aria-hidden data-count={2} data-name="n" />,
			<div aria-label={undefined} data-count={3} data-name={null as any} />,
		),
	);
});

test('booleanish attributes serialise as strings, not as presence', async () => {
	await expectAgreement(
		transition(
			<div contentEditable spellCheck={false} draggable />,
			<div contentEditable={false} spellCheck draggable={false} />,
		),
	);
});

test('boolean and nullish attributes are added and removed', async () => {
	await expectAgreement(
		transition(
			<div hidden id="a" title="t" tabIndex={-1} />,
			<div hidden={false} id={undefined} title={null as any} tabIndex={0} />,
		),
	);
});

test('dangerouslySetInnerHTML replaces content and updates', async () => {
	await expectAgreement(
		transition(
			<div dangerouslySetInnerHTML={{ __html: '<b>hi</b>' }} />,
			<div dangerouslySetInnerHTML={{ __html: '<i>bye</i>' }} />,
		),
	);
});

test('event handlers do not leak into the markup', async () => {
	await expectAgreement(
		transition(<button onClick={() => {}}>a</button>, <button onClick={() => {}}>b</button>),
	);
});

test('className is removed, not blanked, when the prop goes away', async () => {
	await expectAgreement(transition(<div className="a" />, <div className={undefined} />));
});

test('htmlFor is removed, not blanked, when the prop goes away', async () => {
	await expectAgreement(transition(<label htmlFor="a" />, <label htmlFor={undefined} />));
});

test('className and htmlFor are removed for a value react refuses to stringify', async () => {
	await expectAgreement(
		transition(<label className="a" htmlFor="a" />, <label className={false as any} htmlFor={true as any} />),
	);
});

test('react hoists document metadata into head and scion renders it in place', async () => {
	const scenario = async (helper: Scenario) => {
		await helper.render(
			<div>
				<title>page</title>
				<meta name="description" content="d" />
			</div>,
		);
		helper.log('container', helper.html());
		helper.log('head title', String(document.head.querySelector('title')?.textContent));
		for (const node of document.head.querySelectorAll('title,meta')) {
			node.remove();
		}
	};

	const { react, scion } = await runBoth(scenario);
	expect(scion.entries).toEqual([
		'container <div><title>page</title><meta name="description" content="d"></div>',
		'head title undefined',
	]);
	expect(react.entries).toEqual(['container <div></div>', 'head title page']);
});

test('a string style is rejected on the render that passes it', async () => {
	const { react, scion } = await runBoth(async (scenario) => {
		try {
			await scenario.render(<div style={'color: red' as any} />);
		} catch {
			scenario.log('render threw');
		}
		scenario.log('dom', scenario.html());
	});
	expect(scion.entries).toEqual(['dom ']);
	expect(react.entries).toEqual(['render threw', 'dom ']);
});
