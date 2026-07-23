import lucasAlignLogo from "renderer/assets/branding/lucas-align-logo.png";

export function TerminalWatermark() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
		>
			<img
				src={lucasAlignLogo}
				alt=""
				className="max-h-[62%] w-[min(42%,28rem)] object-contain opacity-35 mix-blend-screen"
				style={{
					filter:
						"blur(1.25px) drop-shadow(0 0 1px rgba(255,255,255,0.95)) drop-shadow(0 0 7px rgba(255,255,255,0.55))",
				}}
			/>
		</div>
	);
}
