import { summarizeSamples } from '../lib/stats.mjs';

const OPS = ['stream_fine', 'stream_coarse', 'append_history', 'switch_conversation', 'type_160'];

const run = (page, operation) =>
	page.evaluate((name) => {
		const drain = (batch) => {
			let guard = 0;
			while (window.benchChatStream.pump(batch) > 0) {
				guard++;
				if (guard > 10_000) {
					throw new Error('chat stream did not settle');
				}
			}
		};
		const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
		window.benchChatStream.reset();
		if (name === 'append_history') {
			window.benchChatStream.select(1);
		}
		(window.gc || (() => {}))();
		const started = performance.now();
		switch (name) {
			case 'stream_fine': {
				for (let index = 0; index < 4; index++) {
					window.benchChatStream.send(`benchmark stream ${index}`);
					drain(8);
				}
				break;
			}
			case 'stream_coarse': {
				for (let index = 0; index < 4; index++) {
					window.benchChatStream.send(`benchmark stream ${index}`);
					drain(64);
				}
				break;
			}
			case 'append_history': {
				for (let index = 0; index < 2; index++) {
					window.benchChatStream.send(`append history ${index}`);
					drain(16);
				}
				break;
			}
			case 'switch_conversation': {
				for (let index = 0; index < 5; index++) {
					window.benchChatStream.select(1);
					window.benchChatStream.select(0);
				}
				break;
			}
			case 'type_160': {
				const input = document.querySelector('.prompt');
				const text = 'the quick brown fox jumps over the lazy dog';
				for (let pass = 0; pass < 4; pass++) {
					for (let index = 1; index <= 40; index++) {
						valueDescriptor.set.call(input, text.slice(0, index));
						input.dispatchEvent(new InputEvent('input', { bubbles: true }));
					}
				}
				break;
			}
		}
		const elapsed = performance.now() - started;
		return {
			active: document.querySelector('.conv-tab.active')?.getAttribute('data-conv'),
			elapsed,
			messages: document.querySelectorAll('.message').length,
			streaming: document.querySelectorAll('.streaming').length,
			value: document.querySelector('.prompt')?.value,
		};
	}, operation);

export const suite = {
	name: 'chat-stream',
	fixture: 'chat-stream',
	ops: OPS,

	waitForReady(page) {
		return page.waitForFunction(() => Boolean(window.benchChatStream));
	},

	async measure({ page, iterations }) {
		const ops = {};
		for (const operation of OPS) {
			const samples = [];
			for (let index = 0; index < iterations; index++) {
				const result = await run(page, operation);
				const expected = operation === 'append_history' ? 204 : operation.startsWith('stream_') ? 18 : 10;
				if (result.messages !== expected || result.streaming !== 0) {
					throw new Error(`${operation} left ${result.messages} messages and ${result.streaming} streams`);
				}
				if (operation === 'switch_conversation' && result.active !== '0') {
					throw new Error('conversation switch did not return to the short history');
				}
				if (
					operation === 'type_160' &&
					result.value !== 'the quick brown fox jumps over the lazy '.slice(0, 40)
				) {
					throw new Error('controlled composer lost input');
				}
				samples.push(result.elapsed);
			}
			ops[operation] = summarizeSamples(samples);
		}
		return { ops, meta: { longHistoryMessages: 200, scriptedReplies: 8 } };
	},
};
