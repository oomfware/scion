export const unstable_ImmediatePriority = 1;
export const unstable_UserBlockingPriority = 2;
export const unstable_NormalPriority = 3;
export const unstable_LowPriority = 4;
export const unstable_IdlePriority = 5;

export const unstable_now = () => performance.now();
export const unstable_shouldYield = () => false;
export const unstable_getCurrentPriorityLevel = () => unstable_NormalPriority;
export const unstable_runWithPriority = <Value>(_priority: number, callback: () => Value): Value =>
	callback();
export const unstable_cancelCallback = (handle: number) => clearTimeout(handle);
export const unstable_scheduleCallback = (_priority: number, callback: () => void) => setTimeout(callback, 0);
