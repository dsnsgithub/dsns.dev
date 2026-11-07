import { useEffect, useMemo, useRef, useState } from "react";
import { EqualizerAudio, type AudioSettings } from "../../lib/eq/audio";
import { compatible, fetchText, loadMeasurement, mergeCatalogs, recommendedTarget, type Catalog, type Measurement, type Target } from "../../lib/eq/data";
import { validateHangoutCatalog, type HangoutCatalog } from "../../lib/eq/hangout";
import { DEFAULT_FIT, correctionPreamp, fitEQ, parseCurve, preferenceCurve, validateCurve, type Band, type Curve, type FitOptions } from "../../lib/eq/dsp";
import { DEFAULT_SESSION, validateSession, type Session } from "../../lib/eq/session";
import ResponseGraph from "./ResponseGraph";
import MeasurementPicker from "./MeasurementPicker";
import { DEFAULT_GRAPH, type GraphSettings } from "../../lib/eq/display";
import { rigMatch } from "../../lib/eq/search";
import { exportEqualizerAPO } from "../../lib/eq/export";
import "./equalizer.css";

const STORAGE_KEY = "dsns-headphone-eq-v1";
const fmt = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(1)} kHz` : `${Math.round(f)} Hz`);
const curveText = (c: Curve) => `frequency,raw\n${c.frequency.map((f, i) => `${f},${c.raw[i]}`).join("\n")}`;
const errorText = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong. Please try again.");

function NumberControl({
	label,
	value,
	min,
	max,
	step = 1,
	unit = "",
	onChange
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	unit?: string;
	onChange: (value: number) => void;
}) {
	const [draft, setDraft] = useState(String(Math.round(value * 100) / 100));
	useEffect(() => setDraft(String(Math.round(value * 100) / 100)), [value]);
	return (
		<label className="eq-number">
			<span>
				{label}
				{unit && <small> {unit}</small>}
			</span>
			<input
				type="number"
				min={min}
				max={max}
				step={step}
				value={draft}
				onChange={(e) => {
					setDraft(e.currentTarget.value);
					const n = e.currentTarget.valueAsNumber;
					if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
				}}
				onBlur={() => {
					const n = draft === "" ? value : Number(draft);
					const next = Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : value;
					setDraft(String(Math.round(next * 100) / 100));
					onChange(next);
				}}
			/>
		</label>
	);
}

function Slider({
	label,
	value,
	min,
	max,
	step = 1,
	unit = "dB",
	onChange
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	unit?: string;
	onChange: (value: number) => void;
}) {
	return (
		<label className="eq-slider">
			<span>
				{label}
				<output>
					{value > 0 && unit !== "%" ? "+" : ""}
					{Math.round(value * 100) / 100} {unit}
				</output>
			</span>
			<input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.currentTarget.value))} />
		</label>
	);
}

export default function HeadphoneEqualizer() {
	const [session, setSession] = useState<Session>(DEFAULT_SESSION);
	const [hydrated, setHydrated] = useState(false);
	const [autoeqCatalog, setAutoeqCatalog] = useState<Catalog | null>(null);
	const [hangoutCatalog, setHangoutCatalog] = useState<HangoutCatalog | null>(null);
	const [hangoutLoading, setHangoutLoading] = useState(true);
	const [hangoutError, setHangoutError] = useState("");
	const catalog = useMemo(() => mergeCatalogs(autoeqCatalog, hangoutCatalog), [autoeqCatalog, hangoutCatalog]);
	const [targets, setTargets] = useState<Target[]>([]);
	const [dataAttempt, setDataAttempt] = useState(0);
	const [dataError, setDataError] = useState("");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [saving, setSaving] = useState("Settings save in this browser.");
	const [loading, setLoading] = useState({ headphone: false, target: false });
	const [fitting, setFitting] = useState(false);
	const [engine, setEngine] = useState<EqualizerAudio | null>(null);
	const [selection, setSelection] = useState<[number, number] | null>(null);
	const [track, setTrack] = useState("");
	const [customText, setCustomText] = useState(curveText(DEFAULT_SESSION.customTarget));
	const [generatedFor, setGeneratedFor] = useState("");
	const [manual, setManual] = useState(false);
	const [level, setLevel] = useState({ trim: 0, limiting: false });
	const player = useRef<HTMLAudioElement>(null);
	const engineRef = useRef<EqualizerAudio | null>(null);
	const objectUrl = useRef<string | null>(null);
	const currentSession = useRef(session);
	currentSession.current = session;
	const requests = useRef<{ headphone?: AbortController; target?: AbortController }>({});
	const mounted = useRef(true);

	useEffect(() => {
		mounted.current = true;
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const restored = validateSession(JSON.parse(saved));
				setSession(restored);
				setCustomText(curveText(restored.customTarget));
				setNotice("Restored your headphone measurements, EQ bands, and settings.");
				setManual(restored.bands.length > 0);
			}
		} catch {
			setNotice("Saved settings could not be restored. Starting with the defaults.");
		}
		setHydrated(true);
		return () => {
			mounted.current = false;
			requests.current.headphone?.abort();
			requests.current.target?.abort();
			player.current?.pause();
			engineRef.current?.dispose();
			engineRef.current = null;
			if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
		};
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		const timer = setTimeout(() => {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
				setSaving("Saved in this browser");
			} catch {
				setSaving("Browser storage is unavailable. Save a setup JSON to keep your settings.");
			}
		}, 350);
		return () => clearTimeout(timer);
	}, [session, hydrated]);

	useEffect(() => {
		const controller = new AbortController();
		setDataError("");
		void Promise.all([fetchText("/autoeq/catalog.json", controller.signal), fetchText("/autoeq/targets.json", controller.signal)])
			.then(([catalogText, targetsText]) => {
				if (controller.signal.aborted) return;
				const data = JSON.parse(catalogText) as Catalog;
				const targetData = JSON.parse(targetsText) as Target[];
				if (!Array.isArray(data.paths) || !/^[a-f0-9]{40}$/.test(data.revision)) throw new Error("Invalid measurement catalog.");
				targetData.forEach((t) => validateCurve(t.fr));
				setAutoeqCatalog(data);
				setTargets(targetData);
			})
			.catch((e) => {
				if (!controller.signal.aborted) setDataError(`Could not load the AutoEq catalog and targets. ${errorText(e)}`);
			});
		return () => controller.abort();
	}, [dataAttempt]);

	useEffect(() => {
		const controller = new AbortController();
		setHangoutError("");
		setHangoutLoading(true);
		void fetchText("/api/eq/hangout/catalog.json", controller.signal, 20000)
			.then((text) => {
				if (!controller.signal.aborted) setHangoutCatalog(validateHangoutCatalog(JSON.parse(text)));
			})
			.catch((error) => {
				if (!controller.signal.aborted) setHangoutError(errorText(error));
			})
			.finally(() => {
				if (!controller.signal.aborted) setHangoutLoading(false);
			});
		return () => controller.abort();
	}, [dataAttempt]);

	useEffect(() => {
		engine?.setBands(session.bands);
	}, [engine, session.bands]);
	useEffect(() => {
		engine?.setSettings(session.audio);
	}, [engine, session.audio]);
	useEffect(() => {
		engine?.setSelection(selection);
	}, [engine, selection]);
	useEffect(() => {
		engine?.setDetail(session.detail);
	}, [engine, session.detail]);
	useEffect(() => {
		if (!engine) return;
		const timer = setInterval(() => setLevel({ trim: engine.trimDb, limiting: engine.limiter.reduction < -3 }), 250);
		return () => clearInterval(timer);
	}, [engine]);

	const ensureAudio = () => {
		if (engineRef.current) return engineRef.current;
		if (!player.current) throw new Error("The audio player is not ready.");
		const audio = new EqualizerAudio(player.current);
		const s = currentSession.current;
		audio.setBands(s.bands);
		audio.setSettings(s.audio);
		audio.setSelection(selection);
		audio.setDetail(s.detail);
		engineRef.current = audio;
		setEngine(audio);
		return audio;
	};

	const update = (change: Partial<Session>) => setSession((s) => ({ ...s, ...change }));
	const updateAudio = (change: Partial<AudioSettings>) => setSession((s) => ({ ...s, audio: { ...s.audio, ...change } }));
	const updateGraph = (change: Partial<GraphSettings>) => setSession((s) => ({ ...s, graph: { ...s.graph, ...change } }));
	const updateFit = (change: Partial<FitOptions>) => setSession((s) => ({ ...s, fit: { ...s.fit, ...change } }));
	const updateBand = (index: number, change: Partial<Band>) => {
		setManual(true);
		setSession((s) => ({ ...s, bands: s.bands.map((band, i) => (i === index ? { ...band, ...change } : band)) }));
	};

	const builtin = targets.find((t) => t.label === session.targetName);
	const sampleRate = engine?.context.sampleRate ?? 48000;
	const targetCurve = useMemo(() => {
		let base: Curve | null = null;
		if (session.targetMode === "headphone") base = session.targetHeadphone?.curve ?? null;
		else if (session.targetMode === "custom") base = session.customTarget;
		else if (builtin) base = preferenceCurve(builtin.fr, builtin.bassBoost.gain, 0, 0, sampleRate);
		return base ? preferenceCurve(base, session.bass, session.treble, session.tilt, sampleRate) : null;
	}, [session.targetMode, session.targetHeadphone, session.customTarget, builtin, session.bass, session.treble, session.tilt, sampleRate]);
	const fitSignature = JSON.stringify([session.headphone, targetCurve, session.fit, sampleRate]);
	const stale = generatedFor !== "" && generatedFor !== fitSignature;

	const chooseMeasurement = async (id: string, which: "headphone" | "target") => {
		requests.current[which]?.abort();
		const controller = new AbortController();
		requests.current[which] = controller;
		setError("");
		if (!id) {
			setLoading((l) => ({ ...l, [which]: false }));
			setSession((s) => ({ ...s, [which === "headphone" ? "headphone" : "targetHeadphone"]: null }));
			return;
		}
		if (!catalog) return;
		setLoading((l) => ({ ...l, [which]: true }));
		try {
			const measurement = await loadMeasurement(catalog, id, controller.signal);
			if (controller.signal.aborted || !mounted.current) return;
			setSession((s) => ({
				...s,
				[which === "headphone" ? "headphone" : "targetHeadphone"]: measurement,
				...(which === "headphone" && s.targetMode === "preference" ? { targetName: recommendedTarget(targets, measurement)?.label ?? s.targetName } : {})
			}));
			setNotice(`Loaded ${measurement.name}. Choose a target, then generate EQ when ready.`);
		} catch (e) {
			if (!controller.signal.aborted && mounted.current) setError(`Could not load this measurement. ${errorText(e)}`);
		} finally {
			if (!controller.signal.aborted && mounted.current) setLoading((l) => ({ ...l, [which]: false }));
		}
	};

	const importCurve = async (file: File | undefined, which: "headphone" | "target" | "custom") => {
		if (!file) return;
		setError("");
		try {
			if (file.size > 2_000_000) throw new Error("Curve files must be smaller than 2 MB.");
			const curve = parseCurve(await file.text());
			if (!mounted.current) return;
			if (which === "custom") {
				update({ customTarget: curve, targetMode: "custom" });
				setCustomText(curveText(curve));
			} else {
				requests.current[which]?.abort();
				setLoading((l) => ({ ...l, [which]: false }));
				const measurement: Measurement = { id: `import:${file.name}`, name: file.name.replace(/\.(csv|txt|tsv)$/i, ""), curve, source: "Imported", rig: "", form: "unknown" };
				update(which === "headphone" ? { headphone: measurement } : { targetHeadphone: measurement });
			}
			setNotice(`Imported ${file.name}. Curves are displayed at ${session.graph.normalizeDb} dB at ${fmt(session.graph.normalizeAt)}.`);
		} catch (e) {
			setError(errorText(e));
		}
	};

	const generate = async () => {
		setError("");
		if (!session.headphone || !targetCurve) return;
		if (session.fit.minFreq >= session.fit.maxFreq) {
			setError("The correction start frequency must be lower than the end frequency.");
			return;
		}
		const sharedMin = Math.max(session.headphone.curve.frequency[0], targetCurve.frequency[0]);
		const sharedMax = Math.min(session.headphone.curve.frequency.at(-1)!, targetCurve.frequency.at(-1)!);
		if (session.fit.normalizeAt < sharedMin || session.fit.normalizeAt > sharedMax) {
			setError(`Choose an alignment frequency inside both curves (${fmt(sharedMin)}–${fmt(sharedMax)}) under Correction limits & fitting.`);
			return;
		}
		setFitting(true);
		try {
			const audio = ensureAudio();
			// Yield once to paint the busy state before the bounded local fit.
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			if (!mounted.current) return;
			if (currentSession.current !== session) {
				setNotice("Settings changed during the fit. Generate EQ again to use the latest settings.");
				return;
			}
			const actualTarget =
				session.targetMode === "preference" && builtin
					? preferenceCurve(preferenceCurve(builtin.fr, builtin.bassBoost.gain, 0, 0, audio.context.sampleRate), session.bass, session.treble, session.tilt, audio.context.sampleRate)
					: preferenceCurve(session.targetMode === "headphone" ? session.targetHeadphone!.curve : session.customTarget, session.bass, session.treble, session.tilt, audio.context.sampleRate);
			const bands = fitEQ(session.headphone.curve, actualTarget, session.fit, audio.context.sampleRate);
			setSession((s) => ({ ...s, bands, audio: { ...s.audio, enabled: true } }));
			setGeneratedFor(JSON.stringify([session.headphone, actualTarget, session.fit, audio.context.sampleRate]));
			setManual(false);
			setNotice(bands.length ? `Generated and enabled ${bands.length} editable bands. Use the EQ switch to compare.` : "The requested correction is flat. No EQ bands are needed.");
		} catch (e) {
			setError(errorText(e));
		} finally {
			if (mounted.current) setFitting(false);
		}
	};

	const useTrack = (url: string, name: string, local = false) => {
		if (!player.current) return;
		player.current.pause();
		if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
		objectUrl.current = local ? url : null;
		player.current.src = url;
		player.current.load();
		setTrack(name);
		setError("");
	};

	const saveFile = (content: string, filename: string, type: string) => {
		const url = URL.createObjectURL(new Blob([content], { type }));
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	};
	const exportNote = stale
		? "Headphone / target settings changed after generation. This file contains the current bands, not a new fit."
		: manual
			? "Manual / restored bands. Export uses exactly the current filter controls."
			: "Export uses the current filter controls.";
	const eqProfile = useMemo(() => exportEqualizerAPO(session.bands, session.audio, sampleRate, exportNote), [session.bands, session.audio, sampleRate, exportNote]);
	const exportPreamp = useMemo(
		() => correctionPreamp(session.bands, session.audio.preamp, session.audio.autoGain, sampleRate),
		[session.bands, session.audio.preamp, session.audio.autoGain, sampleRate]
	);
	const downloadEQ = () => {
		saveFile(eqProfile, "headphone-eq-equalizer-apo.txt", "text/plain;charset=utf-8");
		setNotice("Exported the current EQ bands and preamp as an Equalizer APO / Peace profile.");
	};
	const downloadPreset = () => saveFile(JSON.stringify(session, null, 2), "headphone-eq-setup.json", "application/json");

	const importPreset = async (file: File | undefined) => {
		if (!file) return;
		setError("");
		try {
			if (file.size > 2_000_000) throw new Error("Preset files must be smaller than 2 MB.");
			const imported = validateSession(JSON.parse(await file.text()));
			if (!mounted.current) return;
			requests.current.headphone?.abort();
			requests.current.target?.abort();
			setLoading({ headphone: false, target: false });
			setSession(imported);
			setCustomText(curveText(imported.customTarget));
			setSelection(null);
			setGeneratedFor("");
			setManual(imported.bands.length > 0);
			setNotice("Preset imported, including measurements, target, bands, and display settings.");
		} catch (e) {
			setError(`Could not import preset. ${errorText(e)}`);
		}
	};

	let compatibilityNote = "";
	if (session.headphone) {
		if (session.targetMode === "preference" && builtin && !compatible(builtin, session.headphone)) {
			compatibilityNote =
				builtin.label === "Flat"
					? "Flat is a flat measured response, not a perceptually neutral headphone target."
					: "This target is not marked compatible with your measurement rig. Treat the result as an experiment; use a recommended target for a closer match.";
		} else if (session.targetMode === "headphone" && session.targetHeadphone) {
			const match = rigMatch(session.headphone, session.targetHeadphone);
			if (match === "different") compatibilityNote = "These measurements use different rigs or fit types. Choose a matching target measurement for a more meaningful comparison.";
			else if (match === "unknown") compatibilityNote = "Rig compatibility is unverified. Matching rigs are ranked first in the target search when available.";
			else if (match === "same-set") compatibilityNote = "Both measurements are from the same source and fit type, but the catalog does not specify their rigs.";
			else if (match === "same-rig") compatibilityNote = "The rig and fit type match, but measurement methods may vary between sources.";
		} else if (session.targetMode === "custom" || session.headphone.source === "Imported") {
			compatibilityNote = "Use a raw target measured on the same rig as your headphone curve. Imported curves have no verified rig compatibility.";
		}
	}

	return (
		<div className="headphone-eq">
			<header className="eq-title">
				<div>
					<p className="eq-eyebrow">LISTEN · MEASURE · SHAPE</p>
					<h1>Audio Frequency Analyzer</h1>
					<p>Your music, through your headphones. Overlay a measured response, find your target, and make it your own.</p>
				</div>
				<span className="eq-badge">Headphone AutoEQ</span>
			</header>

			<section className="eq-player-panel" aria-label="Music playback">
				<div className="eq-player-upload">
					<label className="eq-upload">
						<span>Open an audio file</span>
						<input
							type="file"
							accept="audio/*,.flac,.m4a,.ogg"
							onChange={(e) => {
								const file = e.currentTarget.files?.[0];
								if (file) useTrack(URL.createObjectURL(file), file.name, true);
								e.currentTarget.value = "";
							}}
						/>
					</label>
					<p className="eq-hint">Audio stays on your device. EQ applies to this player.</p>
				</div>
				<div className="eq-player">
					<p className="eq-track">{track || "Load your music or choose a sample below"}</p>
					<audio
						ref={player}
						controls
						preload="metadata"
						onPlay={() => {
							try {
								void ensureAudio()
									.resume()
									.catch((e) => {
										player.current?.pause();
										setError(errorText(e));
									});
							} catch (e) {
								player.current?.pause();
								setError(`Audio could not start. ${errorText(e)}`);
							}
						}}
						onError={() => {
							if (track) setError("This audio file could not be played. Try a browser-supported MP3, WAV, or FLAC file.");
						}}
					/>
					<div className="eq-samples">
						<span>Try a track</span>
						{["Symbolism", "Invincible", "Mortals"].map((name) => (
							<button key={name} onClick={() => useTrack(`/${name.toLowerCase()}.mp3`, name)}>
								{name}
							</button>
						))}
					</div>
				</div>
			</section>

			<section className="eq-visualization" aria-label="Frequency visualization">
				<div className="eq-plot-heading">
					<div>
						<h2>What you hear</h2>
						<p className="eq-hint">
							Music level on the left · Response normalized to {session.graph.normalizeDb} dB at {fmt(session.graph.normalizeAt)} on the right
						</p>
					</div>
					<button
						className={`eq-bypass ${session.audio.enabled ? "is-on" : ""}`}
						role="switch"
						aria-checked={session.audio.enabled}
						onClick={() => updateAudio({ enabled: !session.audio.enabled })}
					>
						<span className="eq-switch-dot" />
						{session.audio.enabled ? "EQ on" : "EQ bypassed"}
					</button>
				</div>
				<ResponseGraph session={session} target={targetCurve} engine={engine} selection={selection} onSelection={setSelection} onBand={updateBand} />
				<div className="eq-legend">
					{(
						[
							["spectrum", "Music spectrum"],
							["measured", "Your headphones"],
							["target", "Target"],
							["predicted", "Predicted response"],
							["eq", "EQ correction"]
						] as const
					).map(([key, label]) => (
						<label key={key} className={`eq-legend-${key}`}>
							<input type="checkbox" checked={session.overlays[key]} onChange={(e) => update({ overlays: { ...session.overlays, [key]: e.currentTarget.checked } })} />
							<span />
							{label}
						</label>
					))}
				</div>
				{selection && (
					<p className="eq-isolation" role="status">
						Isolating {fmt(selection[0])}–{fmt(selection[1])} <button onClick={() => setSelection(null)}>Clear isolation</button>
						<span>Range isolation remains active during EQ comparisons.</span>
					</p>
				)}
				<p className="eq-hint">
					Response dB is a visual reference, not your listening SPL. EQ correction is drawn around the {session.graph.normalizeDb} dB reference line (0 dB gain). Predicted response includes
					active filters; preamp and range isolation are excluded.
				</p>
				<details className="eq-display-settings">
					<summary>Customize the graph</summary>
					<div className="eq-controls-grid">
						<label>
							<span>Music spectrum</span>
							<select value={session.spectrum} onChange={(e) => update({ spectrum: e.currentTarget.value as Session["spectrum"] })}>
								<option value="output">After EQ / output</option>
								<option value="input">Before EQ / input</option>
							</select>
						</label>
						<label>
							<span>FFT detail</span>
							<select value={session.detail} onChange={(e) => update({ detail: Number(e.currentTarget.value) })}>
								{[8, 9, 10, 11, 12, 13, 14, 15].map((n) => (
									<option key={n} value={n}>
										{2 ** n} samples
									</option>
								))}
							</select>
						</label>
						<NumberControl label="Y-axis scale" value={session.graph.range} min={10} max={120} unit="dB span" onChange={(range) => updateGraph({ range })} />
						<NumberControl label="Normalize to" value={session.graph.normalizeDb} min={-100} max={150} unit="dB" onChange={(normalizeDb) => updateGraph({ normalizeDb })} />
						<NumberControl label="Normalize at" value={session.graph.normalizeAt} min={20} max={10000} unit="Hz" onChange={(normalizeAt) => updateGraph({ normalizeAt })} />
						<NumberControl label="Smooth" value={session.graph.smoothing} min={0} max={20} step={0.1} onChange={(smoothing) => updateGraph({ smoothing })} />
						<NumberControl label="Vertical offset" value={session.graph.offset} min={-60} max={60} unit="dB" onChange={(offset) => updateGraph({ offset })} />
					</div>
					<p className="eq-hint">
						Smooth uses Hangout.Audio’s numeric spline scale. Display normalization aligns each curve at the chosen frequency; these display controls do not change your EQ.
					</p>
					<button onClick={() => update({ graph: { ...DEFAULT_GRAPH } })}>Reset graph: 40 dB · 60 dB at 1 kHz · Smooth 5</button>
				</details>
			</section>

			{dataError && (
				<div className="eq-error" role="alert">
					{dataError} <button onClick={() => setDataAttempt((n) => n + 1)}>Retry catalog</button>
				</div>
			)}
			{hangoutLoading && (
				<p className="eq-status" role="status">
					Loading Crinacle’s Hangout.Audio measurements…
				</p>
			)}
			{(hangoutError || !!hangoutCatalog?.warnings.length) && (
				<div className="eq-advisory" role="status">
					{hangoutError || hangoutCatalog?.warnings.join(" ")} <button onClick={() => setDataAttempt((n) => n + 1)}>Retry Hangout.Audio</button>
				</div>
			)}
			{error && (
				<div className="eq-error" role="alert">
					{error}{" "}
					<button aria-label="Dismiss error" onClick={() => setError("")}>
						Dismiss
					</button>
				</div>
			)}

			<div className="eq-profile-grid">
				<section className="eq-card">
					<h2>
						<span className="eq-step">1</span>Your headphones
					</h2>
					<MeasurementPicker
						label="Headphone measurement"
						catalog={catalog}
						selected={session.headphone}
						loading={loading.headphone}
						onSelect={(id) => void chooseMeasurement(id, "headphone")}
					/>
					<div className="eq-import-row">
						<label className="eq-file-button">
							Import measurement
							<input
								type="file"
								accept=".csv,.txt,.tsv"
								onChange={(e) => {
									void importCurve(e.currentTarget.files?.[0], "headphone");
									e.currentTarget.value = "";
								}}
							/>
						</label>
						<button disabled={!autoeqCatalog} onClick={() => void chooseMeasurement("oratory1990/over-ear/Sennheiser HD 650", "headphone")}>
							Try HD 650 example
						</button>
					</div>
					<p className="eq-hint">Choose the exact variant, pads, and ANC mode you use. CSV / TXT imports accept frequency (Hz) and raw level (dB).</p>
				</section>

				<section className="eq-card">
					<h2>
						<span className="eq-step">2</span>Your target sound
					</h2>
					<label>
						<span>Match to</span>
						<select value={session.targetMode} onChange={(e) => update({ targetMode: e.currentTarget.value as Session["targetMode"] })}>
							<option value="preference">Preference / neutral target</option>
							<option value="headphone">Another headphone</option>
							<option value="custom">Custom response curve</option>
						</select>
					</label>
					{session.targetMode === "preference" && (
						<>
							<label>
								<span>Target curve</span>
								<select value={session.targetName} disabled={!targets.length} onChange={(e) => update({ targetName: e.currentTarget.value })}>
									{!targets.length && <option>Loading target curves…</option>}
									{targets.length > 0 && !builtin && <option value={session.targetName}>Unavailable target: {session.targetName}</option>}
									{[...targets]
										.sort((a, b) => Number(!!session.headphone && compatible(b, session.headphone)) - Number(!!session.headphone && compatible(a, session.headphone)))
										.map((t) => (
											<option key={t.label} value={t.label}>
												{t.label === "Flat" ? "Flat measured response (not perceptual neutral)" : t.label}
												{session.headphone && compatible(t, session.headphone) ? " · compatible" : ""}
											</option>
										))}
								</select>
							</label>
							<p className="eq-hint">Harman, AutoEq, diffuse-field, and JM-1 targets include their published bass defaults. Tone controls below add your preferences.</p>
						</>
					)}
					{session.targetMode === "headphone" && (
						<>
							<MeasurementPicker
								label="Target headphone"
								catalog={catalog}
								selected={session.targetHeadphone}
								reference={session.headphone}
								rigPreference={session.rigPreference}
								onRigPreference={(rigPreference) => update({ rigPreference })}
								loading={loading.target}
								onSelect={(id) => void chooseMeasurement(id, "target")}
							/>
							<label className="eq-file-button">
								Import target headphone
								<input
									type="file"
									accept=".csv,.txt,.tsv"
									onChange={(e) => {
										void importCurve(e.currentTarget.files?.[0], "target");
										e.currentTarget.value = "";
									}}
								/>
							</label>
						</>
					)}
					{session.targetMode === "custom" && (
						<>
							<label className="eq-file-button">
								Import target CSV / TXT
								<input
									type="file"
									accept=".csv,.txt,.tsv"
									onChange={(e) => {
										void importCurve(e.currentTarget.files?.[0], "custom");
										e.currentTarget.value = "";
									}}
								/>
							</label>
							<label>
								<span>Edit target points · Hz, dB</span>
								<textarea rows={5} spellCheck={false} value={customText} onChange={(e) => setCustomText(e.currentTarget.value)} />
							</label>
							<button
								onClick={() => {
									try {
										update({ customTarget: parseCurve(customText) });
										setError("");
										setNotice("Custom target updated. Generate EQ to apply it to the bands.");
									} catch (e) {
										setError(errorText(e));
									}
								}}
							>
								Update target curve
							</button>
							<p className="eq-hint">Points are interpolated on a logarithmic frequency axis. The initial custom curve is flat measured response.</p>
						</>
					)}
					{compatibilityNote && <p className="eq-advisory">{compatibilityNote}</p>}
				</section>
			</div>

			<section className="eq-card eq-generation">
				<div className="eq-section-heading">
					<h2>
						<span className="eq-step">3</span>Make it yours
					</h2>
					<span className="eq-hint">Adjust the target, then generate editable EQ bands.</span>
				</div>
				<div className="eq-tone-controls">
					<Slider label="Bass" value={session.bass} min={-12} max={12} step={0.5} onChange={(bass) => update({ bass })} />
					<Slider label="Treble" value={session.treble} min={-12} max={12} step={0.5} onChange={(treble) => update({ treble })} />
					<Slider label="Tilt" value={session.tilt} min={-2} max={2} step={0.1} unit="dB/oct" onChange={(tilt) => update({ tilt })} />
					<Slider label="Correction strength" value={session.fit.strength} min={0} max={100} unit="%" onChange={(strength) => updateFit({ strength })} />
				</div>
				<details>
					<summary>Correction limits &amp; fitting</summary>
					<div className="eq-controls-grid">
						<NumberControl label="Fit alignment" value={session.fit.normalizeAt} min={20} max={10000} unit="Hz" onChange={(normalizeAt) => updateFit({ normalizeAt })} />
						<label>
							<span>Fit smoothing</span>
							<select value={session.fit.smoothing} onChange={(e) => updateFit({ smoothing: Number(e.currentTarget.value) })}>
								{![0, 1 / 12, 1 / 6, 1 / 3, 1].includes(session.fit.smoothing) && <option value={session.fit.smoothing}>{session.fit.smoothing.toFixed(3)} octave</option>}
								<option value={0}>None</option>
								<option value={1 / 12}>1/12 octave</option>
								<option value={1 / 6}>1/6 octave</option>
								<option value={1 / 3}>1/3 octave</option>
								<option value={1}>1 octave</option>
							</select>
						</label>
						<NumberControl label="Maximum bands" value={session.fit.count} min={3} max={20} onChange={(count) => updateFit({ count: Math.round(count) })} />
						<NumberControl label="Maximum boost" value={session.fit.maxBoost} min={0} max={12} step={0.5} unit="dB" onChange={(maxBoost) => updateFit({ maxBoost })} />
						<NumberControl label="Maximum cut" value={session.fit.maxCut} min={0} max={24} step={0.5} unit="dB" onChange={(maxCut) => updateFit({ maxCut })} />
						<NumberControl label="Correct from" value={session.fit.minFreq} min={20} max={10000} unit="Hz" onChange={(minFreq) => updateFit({ minFreq })} />
						<NumberControl label="Correct up to" value={session.fit.maxFreq} min={100} max={20000} unit="Hz" onChange={(maxFreq) => updateFit({ maxFreq })} />
					</div>
					<p className="eq-hint">
						Fit alignment and smoothing are independent of the graph display. Correction tapers near the upper limit; filter tails may extend beyond the selected range. Manual edits can
						exceed the automatic boost/cut limits.
					</p>
				</details>
				<div className="eq-generate-row">
					<button className="eq-primary" disabled={!session.headphone || !targetCurve || loading.headphone || loading.target || fitting} onClick={() => void generate()}>
						{fitting ? "Fitting EQ…" : "Generate & apply EQ"}
					</button>
					<span className="eq-hint">
						{!session.headphone
							? "Select your headphones to get started."
							: !targetCurve
								? "Select or import a target curve."
								: "Replaces the bands below. You can edit every band afterward."}
					</span>
					<button className="eq-text-button" onClick={() => update({ bass: 0, treble: 0, tilt: 0, fit: { ...DEFAULT_FIT } })}>
						Reset tuning
					</button>
				</div>
				<p className="eq-status" role="status">
					{stale
						? "Your headphone, target, or fitting settings changed. Generate EQ again to update the active bands."
						: manual
							? "Manual / restored EQ bands are loaded. Generate EQ to fit the current target."
							: notice || "Your measurements and tuning stay editable."}
				</p>
			</section>

			<section className="eq-card eq-parametric">
				<div className="eq-section-heading">
					<div>
						<h2>Parametric EQ</h2>
						<p className="eq-hint">
							{session.bands.length} / 24 bands · {session.audio.enabled ? "Enabled" : "Bypassed — edits are kept"}
						</p>
					</div>
					<div className="eq-actions">
						<button
							disabled={session.bands.length >= 24}
							onClick={() => {
								update({ bands: [...session.bands, { type: "peaking", freq: 1000, gain: 0, q: 1.41, enabled: true }] });
								setManual(true);
							}}
						>
							+ Add band
						</button>
						<button
							disabled={!session.bands.length}
							onClick={() => {
								update({ bands: [] });
								setGeneratedFor("");
								setManual(false);
								setNotice("EQ bands cleared. Your measurement and target are kept.");
							}}
						>
							Clear EQ
						</button>
					</div>
				</div>
				<div className="eq-output-controls">
					<label className="eq-check">
						<input type="checkbox" checked={session.audio.autoGain} onChange={(e) => updateAudio({ autoGain: e.currentTarget.checked })} />
						Auto headroom
					</label>
					<label className="eq-check" title="Keep the same EQ headroom attenuation in bypass. This is not a perceptual loudness match.">
						<input type="checkbox" checked={session.audio.matchBypass} onChange={(e) => updateAudio({ matchBypass: e.currentTarget.checked })} />
						Keep headroom in bypass
					</label>
					<NumberControl label="Preamp" value={session.audio.preamp} min={-24} max={12} step={0.5} unit="dB" onChange={(preamp) => updateAudio({ preamp })} />
					<output className="eq-headroom">{engine ? `Output gain ${level.trim.toFixed(1)} dB` : "Headroom calculated when audio starts"}</output>
					{level.limiting && (
						<span className="eq-limiting" role="status">
							Limiter active
						</span>
					)}
				</div>
				<p className="eq-hint">Auto headroom compensates for the combined filter boost. Keeping it in bypass reduces volume jumps; it does not guarantee equal perceived loudness.</p>
				{session.bands.length === 0 ? (
					<div className="eq-empty">Generate a headphone correction or add a band to shape the sound yourself.</div>
				) : (
					<div className="eq-band-list">
						{session.bands.map((band, i) => (
							<div key={i} className={`eq-band ${!band.enabled ? "eq-band-disabled" : ""}`}>
								<label className="eq-band-toggle">
									<input type="checkbox" checked={band.enabled} onChange={(e) => updateBand(i, { enabled: e.currentTarget.checked })} />
									<span>Band {i + 1}</span>
								</label>
								<label>
									<span>Filter type</span>
									<select value={band.type} onChange={(e) => updateBand(i, { type: e.currentTarget.value as Band["type"] })}>
										<option value="peaking">Peaking</option>
										<option value="lowshelf">Low shelf</option>
										<option value="highshelf">High shelf</option>
										<option value="lowpass">Low pass</option>
										<option value="highpass">High pass</option>
									</select>
								</label>
								<NumberControl label="Frequency" value={band.freq} min={20} max={Math.min(20000, sampleRate * 0.49)} unit="Hz" onChange={(freq) => updateBand(i, { freq })} />
								{band.type.endsWith("pass") ? (
									<div className="eq-inapplicable">Gain not used</div>
								) : (
									<NumberControl label="Gain" value={band.gain} min={-24} max={24} step={0.1} unit="dB" onChange={(gain) => updateBand(i, { gain })} />
								)}
								{band.type.endsWith("shelf") ? (
									<div className="eq-inapplicable">Shelf slope: 1</div>
								) : (
									<NumberControl label="Q" value={band.q} min={0.1} max={18} step={0.01} onChange={(q) => updateBand(i, { q })} />
								)}
								<button
									className="eq-remove"
									aria-label={`Remove band ${i + 1}`}
									onClick={() => {
										update({ bands: session.bands.filter((_, j) => i !== j) });
										setManual(true);
									}}
								>
									×
								</button>
							</div>
						))}
					</div>
				)}
				<div className="eq-export">
					<div className="eq-section-heading">
						<div>
							<h3>Export EQ profile</h3>
							<p className="eq-hint">
								Equalizer APO / Peace · {session.bands.filter((b) => b.enabled).length} enabled filters · Preamp {exportPreamp.toFixed(2)} dB
							</p>
						</div>
						<button className="eq-primary" onClick={downloadEQ}>
							Download EQ .txt
						</button>
					</div>
					<p className="eq-hint">
						Exports the current bands with your preamp and auto headroom settings, even while EQ is bypassed. Import this TXT into Equalizer APO or Peace. Save setup JSON below to keep
						your measurements and graph settings.
					</p>
					{stale && (
						<p className="eq-advisory" role="status">
							{exportNote} Generate EQ again first if you want the newly selected target.
						</p>
					)}
					{!session.bands.length && <p className="eq-hint">No filters are configured. This export contains only the preamp.</p>}
					<details>
						<summary>Preview exported filters</summary>
						<pre tabIndex={0}>{eqProfile}</pre>
					</details>
				</div>
			</section>

			<footer className="eq-footer">
				<div className="eq-preset-row">
					<span>{saving}</span>
					<div className="eq-actions">
						<button onClick={downloadPreset}>Save setup JSON</button>
						<label className="eq-file-button">
							Load setup JSON
							<input
								type="file"
								accept=".json"
								onChange={(e) => {
									void importPreset(e.currentTarget.files?.[0]);
									e.currentTarget.value = "";
								}}
							/>
						</label>
					</div>
				</div>
				<p>
					Measurements and targets from{" "}
					<a href="https://github.com/jaakkopasanen/AutoEq" target="_blank" rel="noreferrer">
						AutoEq
					</a>
					, including oratory1990, Super Review, Rtings, and other credited measurers.{" "}
					{autoeqCatalog ? `${autoeqCatalog.paths.length.toLocaleString()} profiles · snapshot ${autoeqCatalog.date}. ` : ""}
					<a href="/autoeq/README.md">Data notes</a> · <a href="/autoeq/LICENSE.txt">AutoEq MIT license</a>
				</p>
				<p>
					Crinacle measurements also load directly from{" "}
					<a href="https://graph.hangout.audio/" target="_blank" rel="noreferrer">
						Hangout.Audio
					</a>
					: GRAS 43AG-7 headphones, 711 IEMs, and B&amp;K 4620 / 5128 IEMs.
					{hangoutCatalog ? ` ${hangoutCatalog.entries.length.toLocaleString()} profiles · catalog refreshed ${hangoutCatalog.fetchedAt.slice(0, 10)}.` : ""} Available channel samples are
					averaged. Each selected measurement links to its original graph.
				</p>
				<p>
					Measurements load on demand and are cached; the AutoEq HD 650 example is bundled. Imports support additional measurements and targets. Matching another headphone approximates its
					tonal balance, not its fit, distortion, or spatial qualities.
				</p>
			</footer>
		</div>
	);
}
