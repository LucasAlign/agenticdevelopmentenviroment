import lucasAlignLogo from "renderer/assets/branding/lucas-align-logo.png";
import { TERMINAL_WATERMARK_OPACITY } from "../../watermark-visibility";

export function TerminalWatermark() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
		>
			<img
				src={lucasAlignLogo}
				alt=""
				className="max-h-[62%] w-[min(42%,28rem)] object-contain mix-blend-screen"
				style={{
					opacity: TERMINAL_WATERMARK_OPACITY,
					filter:
						"blur(1.25px) drop-shadow(0 0 1px rgba(255,255,255,0.95)) drop-shadow(0 0 7px rgba(255,255,255,0.55))",
				}}
			/>
		</div>
	);
}
