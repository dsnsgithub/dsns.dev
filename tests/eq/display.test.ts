import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GRAPH, displayCurve, graphBounds, smoothDisplay } from "../../src/lib/eq/display";
import { DEFAULT_SESSION, validateSession } from "../../src/lib/eq/session";
import { interpolate, logFrequencies, type Band } from "../../src/lib/eq/dsp";

const frequency = logFrequencies(695);
const noisy = { frequency, raw: frequency.map((f, i) => 80 + 2 * Math.log2(f / 1000) + (i % 2 ? 4 : -4)) };

describe("graph display", () => {
	it("defaults to a full 40 dB span with a 60 dB reference at 1000 Hz and Smooth 5", () => {
		assert.deepEqual(DEFAULT_GRAPH, { range: 40, normalizeDb: 60, normalizeAt: 1000, smoothing: 5, offset: 0 });
		assert.deepEqual(graphBounds(DEFAULT_GRAPH), { min: 40, max: 80 });
		assert.ok(Math.abs(interpolate(displayCurve(noisy, DEFAULT_GRAPH), 1000) - 60) < 1e-10);
		const custom = { ...DEFAULT_GRAPH, range: 50, normalizeDb: 75, normalizeAt: 500, offset: 5 };
		assert.deepEqual(graphBounds(custom), { min: 45, max: 95 });
		assert.ok(Math.abs(interpolate(displayCurve(noisy, custom), 500) - 75) < 1e-10);
	});
	it("smooths narrow variation while retaining a flat response and log-frequency tilt", () => {
		const flat = { frequency, raw: frequency.map(() => 60) };
		const tilt = { frequency, raw: frequency.map((f) => 60 + 3 * Math.log2(f / 1000)) };
		for (const c of [flat, tilt]) {
			const displayed = smoothDisplay(c, 5);
			assert.ok(displayed.raw.every((v, i) => Math.abs(v - c.raw[i]) < 1e-8));
		}
		assert.deepEqual(smoothDisplay(noisy, 0), noisy);
		const smooth = smoothDisplay(noisy, 5);
		const difference = (values: number[]) => values.slice(1).reduce((sum, v, i) => sum + (v - values[i]) ** 2, 0);
		assert.ok(smooth.raw.every(Number.isFinite));
		assert.ok(difference(smooth.raw) < difference(noisy.raw) * 0.5);
	});
	it("matches Hangout's Smooth 5 spline on a synthetic response", () => {
		// Reference outputs from the public headphone graph's smoothing routine.
		const frequency = logFrequencies(64);
		const raw = frequency.map((_, i) => 60 + 3 * Math.sin(i * 0.6) + (i % 2 ? 2 : -2));
		const expected = [58.50940379513283, 62.3420119718439, 56.55922284918572, 58.83768910204532, 59.607023771236285, 56.54598197688352, 56.56522814314372, 62.3018704169093];
		const smoothed = smoothDisplay({ frequency, raw }, 5);
		[0, 1, 8, 16, 32, 48, 62, 63].forEach((index, i) => assert.ok(Math.abs(smoothed.raw[index] - expected[i]) < 1e-9));
	});
	it("handles sparse imports, is linear, and leaves original measurement levels intact", () => {
		const source = { frequency: [20, 100, 1000, 8000, 20000], raw: [84, 90, 80, 83, 70] };
		const before = structuredClone(source);
		const a = smoothDisplay(source, 5);
		const b = smoothDisplay({ frequency: source.frequency, raw: source.raw.map((v) => v + 12) }, 5);
		assert.ok(a.raw.every((v, i) => Math.abs(b.raw[i] - v - 12) < 1e-9));
		assert.deepEqual(source, before);
		assert.deepEqual(smoothDisplay({ frequency: [20, 20000], raw: [60, 70] }, 5).raw, [60, 70]);
	});
});

describe("saved graph settings", () => {
	it("migrates v1 setups without changing headphones, bands, preamp or fitting", () => {
		const band: Band = { type: "peaking", freq: 1000, gain: -3, q: 1.3, enabled: true };
		const legacy = {
			...DEFAULT_SESSION,
			version: 1,
			graph: undefined,
			rigPreference: undefined,
			graphRange: 30,
			graphOffset: -10,
			bands: [band],
			headphone: { id: "example", source: "Imported", form: "unknown", rig: "", name: "My headphones", curve: noisy },
			fit: { ...DEFAULT_SESSION.fit, normalizeAt: 500, smoothing: 1 / 3 },
			audio: { ...DEFAULT_SESSION.audio, enabled: false, preamp: -5 }
		};
		const restored = validateSession(JSON.parse(JSON.stringify(legacy)));
		assert.equal(restored.version, 2);
		assert.deepEqual(restored.graph, DEFAULT_GRAPH);
		assert.equal(restored.rigPreference, "prefer");
		assert.deepEqual(restored.bands, legacy.bands);
		assert.deepEqual(restored.headphone, legacy.headphone);
		assert.deepEqual(restored.fit, legacy.fit);
		assert.deepEqual(restored.audio, legacy.audio);
	});
	it("persists later customizations and rejects broken display settings", () => {
		const session = { ...DEFAULT_SESSION, graph: { ...DEFAULT_GRAPH, smoothing: 8, normalizeAt: 500, range: 50 }, rigPreference: "only" };
		assert.deepEqual(validateSession(JSON.parse(JSON.stringify(session))), session);
		for (const graph of [null, { ...DEFAULT_GRAPH, range: 0 }, { ...DEFAULT_GRAPH, normalizeAt: NaN }, { ...DEFAULT_GRAPH, normalizeDb: Infinity }, { ...DEFAULT_GRAPH, smoothing: -1 }])
			assert.throws(() => validateSession({ ...DEFAULT_SESSION, graph }));
		assert.throws(() => validateSession({ ...DEFAULT_SESSION, rigPreference: "guess" }));
	});
});
