export const TERMINAL_BACKGROUND_OPACITY = 0.42;
export const TERMINAL_WATERMARK_OPACITY = 0.62;
export const MINIMUM_EFFECTIVE_WATERMARK_OPACITY = 0.3;

export function getEffectiveWatermarkOpacity(): number {
	return (1 - TERMINAL_BACKGROUND_OPACITY) * TERMINAL_WATERMARK_OPACITY;
}
