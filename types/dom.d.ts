export type NativeAnimationEvent = AnimationEvent;
export type NativeClipboardEvent = ClipboardEvent;
export type NativeCompositionEvent = CompositionEvent;
export type NativeDragEvent = DragEvent;
export type NativeFocusEvent = FocusEvent;
export type NativeInputEvent = InputEvent;
export type NativeKeyboardEvent = KeyboardEvent;
export type NativeMouseEvent = MouseEvent;
export type NativePointerEvent = PointerEvent;
export type NativeSubmitEvent = SubmitEvent;
export type NativeToggleEvent = ToggleEvent;
export type NativeTouchEvent = TouchEvent;
export type NativeTransitionEvent = TransitionEvent;
export type NativeUIEvent = UIEvent;
export type NativeWheelEvent = WheelEvent;

export interface TrustedHTML {
	toJSON(): string;
}

export interface StyleMedia {
	type: string;
	matchMedium(mediaquery: string): boolean;
}

export interface HTMLWebViewElement extends HTMLElement {}
