import { useEffect, useMemo, useRef, useState } from "react";
import { clamp, combinedResponse, interpolate, logFrequencies, type Band, type Curve } from "../../lib/eq/dsp";
import type { EqualizerAudio } from "../../lib/eq/audio";
import type { Session } from "../../lib/eq/session";
import { displayCurve, graphBounds, smoothDisplay } from "../../lib/eq/display";

interface Props {
	session: Session;
	target: Curve | null;
	engine: EqualizerAudio | null;
	selection: [number, number] | null;
	onSelection: (range: [number, number] | null) => void;
	onBand: (index: number, change: Partial<Band>) => void;
}

const COLORS = { measured: "#1d4ed8", target: "#a15c00", predicted: "#047857", eq: "#7e22ce" };
const formatFrequency = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(1)} kHz` : `${Math.round(f)} Hz`);

export default function ResponseGraph({ session, target, engine, selection, onSelection, onBand }: Props) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const [size, setSize] = useState({ width: 800, height: 380 });
	const [hover, setHover] = useState<number | null>(null);
	const [dragRange, setDragRange] = useState<[number, number] | null>(null);
	const drag = useRef<{ band: number | null; start: number } | null>(null);
	const maxFrequency = Math.min(20000, (engine?.context.sampleRate ?? 48000) * 0.49);
	const left = 44,
		right = size.width - 44,
		top = 24,
		bottom = size.height - 30;
	const toX = (f: number) => left + (Math.log(f / 20) / Math.log(maxFrequency / 20)) * (right - left);
	const toF = (x: number) => 20 * (maxFrequency / 20) ** clamp((x - left) / (right - left), 0, 1);
	const bounds = graphBounds(session.graph);
	const toY = (db: number) => top + ((bounds.max - db) / session.graph.range) * (bottom - top);
	const toEqY = (gain: number) => toY(session.graph.normalizeDb + gain);
	const frequencies = useMemo(() => logFrequencies(512, maxFrequency), [maxFrequency]);
	const curves = useMemo(() => {
		const sr = engine?.context.sampleRate ?? 48000;
		const sample = (c: Curve | null) => {
			if (!c) return null;
			const displayed = displayCurve(c, session.graph);
			return frequencies.map((f) => interpolate(displayed, f));
		};
		const source = session.headphone?.curve;
		const measured = sample(source ?? null);
		const eq = combinedResponse(session.bands, frequencies, sr);
		const displayedCorrection =
			source && session.audio.enabled ? smoothDisplay({ frequency: source.frequency, raw: combinedResponse(session.bands, source.frequency, sr) }, session.graph.smoothing) : null;
		return {
			measured,
			target: sample(target),
			eq,
			predicted: measured?.map((db, i) => db + (displayedCorrection ? interpolate(displayedCorrection, frequencies[i]) : 0)) ?? null
		};
	}, [session.headphone, target, session.bands, session.graph, session.audio.enabled, engine, frequencies]);

	useEffect(() => {
		if (!canvas.current) return;
		const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
		observer.observe(canvas.current);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const el = canvas.current,
			ctx = el?.getContext("2d");
		if (!el || !ctx || size.width <= 88) return;
		const dpr = window.devicePixelRatio || 1;
		el.width = Math.round(size.width * dpr);
		el.height = Math.round(size.height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		const analyser = engine?.[session.spectrum];
		const spectrum = analyser ? new Float32Array(analyser.frequencyBinCount) : null;
		const binWidth = analyser && engine ? engine.context.sampleRate / analyser.fftSize : 1;
		const columns = Array.from({ length: Math.max(1, Math.floor((right - left) / 2)) }, (_, i) => {
			const x = left + i * 2;
			return { x, lo: Math.ceil(toF(x) / binWidth), hi: Math.floor(toF(x + 2) / binWidth), mid: toF(x + 1) / binWidth };
		});
		let frame = 0;
		const draw = () => {
			ctx.clearRect(0, 0, size.width, size.height);
			ctx.save();
			ctx.beginPath();
			ctx.rect(left, top, right - left, bottom - top);
			ctx.clip();
			if (analyser && spectrum && session.overlays.spectrum) {
				analyser.getFloatFrequencyData(spectrum);
				ctx.fillStyle = "rgba(189, 119, 144, 0.38)";
				for (const col of columns) {
					let db = -100;
					if (col.hi >= col.lo) for (let i = col.lo; i <= Math.min(col.hi, spectrum.length - 1); i++) db = Math.max(db, spectrum[i]);
					else {
						const i = clamp(Math.floor(col.mid), 0, spectrum.length - 2),
							t = clamp(col.mid - i, 0, 1);
						db = Math.max(-100, spectrum[i]) * (1 - t) + Math.max(-100, spectrum[i + 1]) * t;
					}
					const y = top + (1 - clamp((db + 100) / 100, 0, 1)) * (bottom - top);
					ctx.fillRect(col.x, y, 2, bottom - y);
				}
			}
			ctx.strokeStyle = "rgba(119, 61, 76, 0.12)";
			ctx.lineWidth = 1;
			for (let i = 0; i <= 4; i++) {
				const y = top + (i / 4) * (bottom - top);
				ctx.beginPath();
				ctx.moveTo(left, y);
				ctx.lineTo(right, y);
				ctx.stroke();
			}
			for (const f of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) {
				ctx.beginPath();
				ctx.moveTo(toX(f), top);
				ctx.lineTo(toX(f), bottom);
				ctx.stroke();
			}
			ctx.strokeStyle = "rgba(119, 61, 76, 0.3)";
			ctx.beginPath();
			ctx.moveTo(left, toEqY(0));
			ctx.lineTo(right, toEqY(0));
			ctx.stroke();
			for (const key of ["measured", "target", "predicted", "eq"] as const) {
				const curve = curves[key];
				if (!curve || !session.overlays[key]) continue;
				const coverage = key === "target" ? target : key === "eq" ? null : session.headphone?.curve;
				ctx.beginPath();
				let started = false;
				curve.forEach((db, i) => {
					if (coverage && (frequencies[i] < coverage.frequency[0] || frequencies[i] > coverage.frequency.at(-1)!)) return;
					const x = toX(frequencies[i]),
						y = key === "eq" ? toEqY(db) : toY(db);
					started ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
					started = true;
				});
				ctx.strokeStyle = COLORS[key];
				ctx.lineWidth = key === "predicted" ? 2.5 : 2;
				ctx.setLineDash(key === "target" ? [6, 4] : key === "eq" ? [3, 3] : []);
				if (key === "eq" && !session.audio.enabled) ctx.globalAlpha = 0.4;
				ctx.stroke();
				ctx.setLineDash([]);
				ctx.globalAlpha = 1;
			}
			const range = dragRange ?? selection;
			if (range) {
				const start = Math.min(...range),
					end = Math.max(...range);
				ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
				ctx.fillRect(toX(start), top, toX(end) - toX(start), bottom - top);
				ctx.strokeStyle = "rgba(37, 99, 235, 0.6)";
				ctx.strokeRect(toX(start), top, toX(end) - toX(start), bottom - top);
			}
			if (session.overlays.eq)
				session.bands.forEach((b, i) => {
					if (!b.enabled || b.freq > maxFrequency) return;
					const gain = b.type.endsWith("pass") ? 0 : b.gain;
					const x = toX(b.freq),
						y = toEqY(gain);
					ctx.beginPath();
					ctx.arc(x, y, 7, 0, Math.PI * 2);
					ctx.fillStyle = session.audio.enabled ? COLORS.eq : "#8b7d8e";
					ctx.fill();
					ctx.strokeStyle = "white";
					ctx.lineWidth = 1.5;
					ctx.stroke();
					ctx.font = "9px sans-serif";
					ctx.fillStyle = "white";
					ctx.textAlign = "center";
					ctx.fillText(`${i + 1}`, x, y + 3);
				});
			if (hover !== null) {
				ctx.strokeStyle = "rgba(59, 28, 36, 0.4)";
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(toX(hover), top);
				ctx.lineTo(toX(hover), bottom);
				ctx.stroke();
			}
			ctx.restore();
			ctx.fillStyle = "#653642";
			ctx.font = "10px sans-serif";
			for (let i = 0; i <= 4; i++) {
				const y = top + (i / 4) * (bottom - top);
				ctx.textAlign = "right";
				ctx.fillText(`${-i * 25}`, left - 8, y + 3);
				const db = bounds.max - (i / 4) * session.graph.range;
				ctx.textAlign = "left";
				ctx.fillText(`${Math.round(db * 10) / 10}`, right + 8, y + 3);
			}
			ctx.textAlign = "left";
			ctx.fillText("dBFS", 8, 12);
			ctx.textAlign = "right";
			ctx.fillText("dB ref.", size.width - 3, 12);
			ctx.textAlign = "center";
			const labels = size.width < 500 ? [20, 100, 1000, 10000, 20000] : [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
			labels.forEach((f) => {
				if (f <= maxFrequency) ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, toX(f), bottom + 18);
			});
			frame = requestAnimationFrame(draw);
		};
		draw();
		return () => cancelAnimationFrame(frame);
	}, [size, curves, frequencies, engine, session.spectrum, session.detail, session.overlays, session.graph, session.audio.enabled, session.bands, selection, dragRange, hover]);

	const coordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		return { x: e.clientX - rect.left, y: e.clientY - rect.top };
	};

	return (
		<figure className="eq-graph">
			<canvas
				ref={canvas}
				aria-label="Live music spectrum and headphone frequency response curves. Edit EQ bands using the controls below."
				onPointerDown={(e) => {
					if (e.button !== 0) return;
					const { x, y } = coordinates(e);
					if (x < left || x > right || y < top || y > bottom) return;
					const index = session.overlays.eq ? session.bands.findIndex((b) => b.enabled && Math.hypot(toX(b.freq) - x, toEqY(b.type.endsWith("pass") ? 0 : b.gain) - y) < 12) : -1;
					drag.current = { band: index >= 0 ? index : null, start: toF(x) };
					if (index < 0) setDragRange([toF(x), toF(x)]);
					e.currentTarget.setPointerCapture(e.pointerId);
				}}
				onPointerMove={(e) => {
					const { x, y } = coordinates(e),
						f = toF(x);
					setHover(f);
					if (!drag.current) return;
					if (drag.current.band !== null) {
						const gain = clamp(bounds.max - ((y - top) / (bottom - top)) * session.graph.range - session.graph.normalizeDb, -24, 24);
						onBand(drag.current.band, { freq: Math.round(f), gain: Math.round(gain * 10) / 10 });
					} else setDragRange([drag.current.start, f]);
				}}
				onPointerUp={(e) => {
					if (drag.current?.band === null) {
						const f = toF(coordinates(e).x),
							start = drag.current.start;
						onSelection(Math.abs(toX(f) - toX(start)) < 5 ? null : [Math.min(f, start), Math.max(f, start)]);
					}
					drag.current = null;
					setDragRange(null);
					if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
				}}
				onPointerCancel={() => {
					drag.current = null;
					setDragRange(null);
				}}
				onPointerLeave={() => {
					if (!drag.current) setHover(null);
				}}
			/>
			<figcaption className="eq-graph-readout">
				{hover === null
					? "Hover for response values. Drag a range to isolate it; drag numbered EQ points to adjust them."
					: `${formatFrequency(hover)} · ${(["measured", "target", "predicted", "eq"] as const)
							.filter((k) => curves[k] && session.overlays[k])
							.map((k) => {
								const coverage = k === "target" ? target : k === "eq" ? null : session.headphone?.curve;
								const inRange = !coverage || (hover >= coverage.frequency[0] && hover <= coverage.frequency.at(-1)!);
								return `${k === "eq" ? "EQ" : k} ${inRange ? `${interpolate({ frequency: frequencies, raw: curves[k]! }, hover).toFixed(1)} dB` : "no data"}`;
							})
							.join(" · ")}`}
			</figcaption>
		</figure>
	);
}
