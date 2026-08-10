declare module 'react-refresh/runtime' {
	interface Family {
		current: any;
	}

	interface RefreshUpdate {
		staleFamilies: Set<Family>;
		updatedFamilies: Set<Family>;
	}

	export const injectIntoGlobalHook: (globalObject: any) => void;
	export const register: (type: any, id: string) => void;
	export const createSignatureFunctionForTransform: () => (
		type?: any,
		key?: string,
		forceReset?: boolean,
		getCustomHooks?: () => any[],
	) => any;
	export const collectCustomHooksForSignature: (type: any) => void;
	export const performReactRefresh: () => RefreshUpdate | null;
	export const getFamilyByType: (type: any) => Family | undefined;
	export const isLikelyComponentType: (type: any) => boolean;
	export const _getMountedRootCount: () => number;
}
