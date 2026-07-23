import { describe, expect, test } from "bun:test";
import {
	getEffectiveWatermarkOpacity,
	MINIMUM_EFFECTIVE_WATERMARK_OPACITY,
} from "./watermark-visibility";

describe("terminal watermark visibility", () => {
	test("remains visible through the translucent XTerm background", () => {
		expect(getEffectiveWatermarkOpacity()).toBeGreaterThanOrEqual(
			MINIMUM_EFFECTIVE_WATERMARK_OPACITY,
		);
	});
});
