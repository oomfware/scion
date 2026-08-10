import { createRoot, flushSync } from 'runtime-under-test';

import { LifecycleBench, runtimeStress } from '../../runtime-shared/src/runtime.tsx';

const container = document.getElementById('main');
if (container === null) {
	throw new Error('missing #main root');
}
flushSync(() => createRoot(container).render(<LifecycleBench />));
runtimeStress.ready = true;
