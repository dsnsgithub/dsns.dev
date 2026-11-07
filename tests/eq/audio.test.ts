import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EqualizerAudio } from "../../src/lib/eq/audio";
import { coefficients, type Band } from "../../src/lib/eq/dsp";
import { exportEqualizerAPO } from "../../src/lib/eq/export";

// A control-graph harness: retains edges and AudioParam targets so routing is tested
// independently of the UI. Limiter/clipper transfer is intentionally excluded here.
class Param {
	value = 0;
	cancelAndHoldAtTime() {}
	setTargetAtTime(value: number) {
		this.value = value;
	}
}
class AudioNodeMock {
	outputs: AudioNodeMock[] = [];
	gain = new Param();
	frequency = new Param();
	Q = new Param();
	threshold = new Param();
	knee = new Param();
	ratio = new Param();
	attack = new Param();
	release = new Param();
	type = "peaking";
	fftSize = 8192;
	minDecibels = -100;
	maxDecibels = 0;
	smoothingTimeConstant = 0;
	reduction = 0;
	curve?: Float32Array;
	oversample = "none";
	constructor(readonly kind: string) {
		this.gain.value = 1;
		this.frequency.value = 350;
		this.Q.value = 1;
	}
	connect(node: AudioNodeMock) {
		assert.ok(!this.outputs.includes(node), "no duplicate edges");
		this.outputs.push(node);
		return node;
	}
	disconnect() {
		this.outputs = [];
	}
}
class ContextMock {
	sampleRate = 48000;
	currentTime = 0;
	state = "suspended";
	nodes: AudioNodeMock[] = [];
	destination = new AudioNodeMock("destination");
	make(kind: string) {
		const node = new AudioNodeMock(kind);
		this.nodes.push(node);
		return node;
	}
	createMediaElementSource() {
		return this.make("source");
	}
	createAnalyser() {
		return this.make("analyser");
	}
	createGain() {
		return this.make("gain");
	}
	createBiquadFilter() {
		return this.make("filter");
	}
	createDynamicsCompressor() {
		return this.make("limiter");
	}
	createWaveShaper() {
		return this.make("clipper");
	}
	async resume() {
		this.state = "running";
	}
	async close() {
		this.state = "closed";
	}
}
type Complex = [number, number];
const add = (a: Complex, b: Complex): Complex => [a[0] + b[0], a[1] + b[1]];
const multiply = (a: Complex, b: Complex): Complex => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
function transfer(context: ContextMock, f: number) {
	function walk(node: AudioNodeMock): Complex {
		if (node.kind === "destination") return [1, 0];
		let own: Complex = [1, 0];
		if (node.kind === "gain") own = [node.gain.value, 0];
		if (node.kind === "clipper") own = [2, 0]; // clip input is halved, linear-region output restores it
		if (node.kind === "filter") {
			const q = node.type.endsWith("pass") ? 10 ** (node.Q.value / 20) : node.Q.value;
			const [b0, b1, b2, a0, a1, a2] = coefficients({ type: node.type as Band["type"], freq: node.frequency.value, gain: node.gain.value, q, enabled: true }, context.sampleRate);
			const w = (2 * Math.PI * f) / context.sampleRate;
			const br = b0 + b1 * Math.cos(w) + b2 * Math.cos(2 * w),
				bi = -b1 * Math.sin(w) - b2 * Math.sin(2 * w);
			const ar = a0 + a1 * Math.cos(w) + a2 * Math.cos(2 * w),
				ai = -a1 * Math.sin(w) - a2 * Math.sin(2 * w);
			const denom = ar * ar + ai * ai;
			own = [(br * ar + bi * ai) / denom, (bi * ar - br * ai) / denom];
		}
		return multiply(
			own,
			node.outputs.reduce<Complex>((sum, child) => add(sum, walk(child)), [0, 0])
		);
	}
	const [re, im] = walk(context.nodes.find((n) => n.kind === "source")!);
	return 20 * Math.log10(Math.hypot(re, im));
}
function withAudio(run: (engine: EqualizerAudio, context: ContextMock) => void) {
	const original = globalThis.AudioContext;
	globalThis.AudioContext = ContextMock as unknown as typeof AudioContext;
	let engine: EqualizerAudio | undefined;
	try {
		engine = new EqualizerAudio({} as HTMLAudioElement);
		run(engine, engine.context as unknown as ContextMock);
	} finally {
		engine?.dispose();
		globalThis.AudioContext = original;
	}
}
const band: Band = { type: "peaking", freq: 1000, gain: 6, q: 1, enabled: true };
const settings = { enabled: true, autoGain: true, matchBypass: true, preamp: 0 };

describe("audio routing and A/B", () => {
	it("exports the same preamp used by enabled playback, even when exported during bypass", () =>
		withAudio((engine) => {
			const bands: Band[] = [band, { ...band, type: "highpass", freq: 90, q: 2 }, { ...band, gain: 15, enabled: false }];
			engine.setBands(bands);
			engine.setSettings({ ...settings, preamp: -3 });
			const enabledTrim = engine.trimDb;
			const bypass = { ...settings, enabled: false, matchBypass: false, preamp: -3 };
			engine.setSettings(bypass);
			assert.equal(engine.trimDb, -3);
			const exported = exportEqualizerAPO(bands, bypass, engine.context.sampleRate);
			const exportedTrim = Number(exported.match(/^Preamp: ([\d.+-]+) dB$/m)![1]);
			assert.ok(Math.abs(exportedTrim - enabledTrim) < 1e-6);
		}));
	it("passes unchanged audio with an empty EQ and no isolation", () =>
		withAudio((engine, context) => {
			engine.setBands([]);
			engine.setSettings(settings);
			for (const f of [30, 100, 1000, 10000, 20000]) assert.ok(Math.abs(transfer(context, f)) < 1e-7);
		}));
	it("bypasses every EQ filter while retaining comparison headroom and the graph", () =>
		withAudio((engine, context) => {
			engine.setBands([band]);
			engine.setSettings(settings);
			const nodes = context.nodes.length,
				edges = context.nodes.reduce((sum, n) => sum + n.outputs.length, 0);
			const wet = transfer(context, 1000);
			engine.setSettings({ ...settings, enabled: false });
			const dry = transfer(context, 1000);
			assert.ok(Math.abs(wet - dry - 6) < 1e-6);
			assert.ok(Math.abs(engine.trimDb + 7) < 1e-5);
			assert.ok(Math.abs(transfer(context, 40) - dry) < 1e-6);
			assert.equal(context.nodes.length, nodes);
			assert.equal(
				context.nodes.reduce((sum, n) => sum + n.outputs.length, 0),
				edges
			);
			engine.setSettings({ ...settings, enabled: false, matchBypass: false });
			assert.equal(engine.trimDb, 0);
			assert.ok(Math.abs(transfer(context, 1000)) < 1e-7);
		}));
	it("fully bypasses lowpass and highpass bands, not just gain knobs", () =>
		withAudio((engine, context) => {
			engine.setBands([{ ...band, type: "lowpass", q: Math.SQRT1_2 }]);
			engine.setSettings({ ...settings, autoGain: false });
			assert.ok(transfer(context, 10000) < -40);
			engine.setSettings({ ...settings, enabled: false, autoGain: false });
			assert.ok(Math.abs(transfer(context, 10000)) < 1e-7);
			engine.setBands([{ ...band, type: "highpass", enabled: false }]);
			engine.setSettings({ ...settings, autoGain: false });
			assert.ok(Math.abs(transfer(context, 100)) < 1e-7);
		}));
	it("updates many times without parallel paths and compensates overlapping boosts", () =>
		withAudio((engine, context) => {
			const count = context.nodes.length;
			for (let i = 0; i < 20; i++) engine.setBands([band, { ...band, gain: 3 }]);
			engine.setSettings(settings);
			assert.equal(context.nodes.length, count);
			assert.ok(Math.abs(engine.trimDb + 10) < 1e-5);
			assert.ok(Math.abs(transfer(context, 1000) + 1) < 1e-5);
			engine.setBands([]);
			assert.ok(Math.abs(transfer(context, 1000)) < 1e-7);
		}));
	it("preserves range isolation through an EQ toggle and removes it on reset", () =>
		withAudio((engine, context) => {
			engine.setSettings(settings);
			engine.setSelection([400, 4000]);
			assert.ok(transfer(context, 1000) > -0.1);
			assert.ok(transfer(context, 10000) < -90);
			engine.setSettings({ ...settings, enabled: false });
			assert.ok(transfer(context, 10000) < -90);
			engine.setSelection(null);
			assert.ok(Math.abs(transfer(context, 10000)) < 1e-7);
		}));
	it("releases the source and closes the AudioContext on disposal", () =>
		withAudio((engine, context) => {
			engine.dispose();
			assert.equal(context.state, "closed");
			assert.equal(context.nodes.find((n) => n.kind === "source")!.outputs.length, 0);
		}));
});
