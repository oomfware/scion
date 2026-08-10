import { createRoot, flushSync } from 'runtime-under-test';

import { AsyncRecoveryBench, runtimeStress } from '../../runtime-shared/src/runtime.tsx';

const container = document.getElementById('main');
if (container === null) {
	throw new Error('missing #main root');
}
flushSync(() => createRoot(container).render(<AsyncRecoveryBench />));
runtimeStress.ready = true;
