import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	bandResponse,
	combinedResponse,
	correctionCurve,
	DEFAULT_FIT,
	fitEQ,
	interpolate,
	logFrequencies,
	normalize,
	parseCurve,
	preferenceCurve,
	validateCurve,
	type Band
} from "../../src/lib/eq/dsp";
import { compatible, measurementInfo, measurementUrl, recommendedTarget, type Catalog, type Target } from "../../src/lib/eq/data";
import { DEFAULT_SESSION, validateSession } from "../../src/lib/eq/session";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const source = parseCurve(read("public/autoeq/sennheiser-hd-650.csv"));
const targets: Target[] = JSON.parse(read("public/autoeq/targets.json"));
const catalog: Catalog = JSON.parse(read("public/autoeq/catalog.json"));
const flat = { frequency: [20, 1000, 20000], raw: [0, 0, 0] };
const rms = (values: number[]) => Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length);
const peakBand = (freq: number, gain: number, q = 1): Band => ({ type: "peaking", freq, gain, q, enabled: true });

describe("measurement imports", () => {
	it("reads the measured raw column, not the pre-equalized response", () => {
		assert.equal(source.frequency[0], 20);
		assert.equal(source.raw[0], -6.91);
		assert.equal(source.frequency.length, source.raw.length);
		assert.equal(parseCurve("frequency,equalized,raw\n20,50,1\n1000,50,2\n20000,50,3").raw[0], 1);
	});
	it("accepts REW comments, whitespace, scientific notation, and unsorted rows", () => {
		const curve = parseCurve("\uFEFF* REW export\n# frequency / SPL\n20000\t75\t0\n2e1 80 0\n1000 85 0");
		assert.deepEqual(curve, { frequency: [20, 1000, 20000], raw: [80, 85, 75] });
	});
	it("rejects malformed, duplicate, non-finite, and insufficient curves", () => {
		for (const text of ["20,0\n20,1\n20000,0", "20,NaN\n20000,0", "20,0\n20000,Infinity", "20,0\n1000,2", "2000,0\n20000,0", "-20,0\n20000,0", "20,0\n20000"]) {
			assert.throws(() => parseCurve(text));
		}
		assert.throws(() => validateCurve({ frequency: [20, 20000], raw: [0] }));
		assert.throws(() => validateCurve({ frequency: ["20", 20000], raw: [0, 0] }));
	});
	it("interpolates in log frequency and normalizes away absolute measurement level", () => {
		assert.ok(Math.abs(interpolate({ frequency: [20, 20000], raw: [0, 30] }, 200) - 10) < 1e-9);
		const curve = normalize({ frequency: [20, 1000, 20000], raw: [80, 85, 78] });
		assert.deepEqual(curve.raw, [-5, 0, -7]);
	});
});

describe("filter transfer functions", () => {
	it("has the specified peaking gain at its center, including 44.1 kHz playback", () => {
		for (const sr of [44100, 48000, 96000]) {
			assert.ok(Math.abs(bandResponse(peakBand(1000, 6), [1000], sr)[0] - 6) < 1e-8);
			assert.ok(Math.abs(bandResponse(peakBand(6000, -12, 4), [6000], sr)[0] + 12) < 1e-8);
		}
	});
	it("uses correct shelf endpoints and Butterworth pass-filter Q", () => {
		const base = peakBand(1000, 6, Math.SQRT1_2);
		assert.ok(Math.abs(bandResponse({ ...base, type: "lowshelf" }, [20])[0] - 6) < 0.01);
		assert.ok(Math.abs(bandResponse({ ...base, type: "highshelf" }, [20000])[0] - 6) < 0.01);
		for (const type of ["lowpass", "highpass"] as const) {
			assert.ok(Math.abs(bandResponse({ ...base, type }, [1000])[0] + 3.0103) < 0.0001);
		}
	});
	it("adds cascaded responses in dB and completely excludes disabled bands", () => {
		const bands = [peakBand(1000, 6), peakBand(1000, 3)];
		assert.ok(Math.abs(combinedResponse(bands, [1000])[0] - 9) < 1e-8);
		assert.ok(Math.abs(combinedResponse([bands[0], { ...bands[1], enabled: false }], [1000])[0] - 6) < 1e-8);
	});
});

describe("automatic headphone matching", () => {
	it("produces no filters when matching the same headphone or using zero strength", () => {
		assert.deepEqual(fitEQ(source, source, DEFAULT_FIT), []);
		assert.deepEqual(fitEQ(source, flat, { ...DEFAULT_FIT, strength: 0 }), []);
		const offset = { frequency: source.frequency, raw: source.raw.map((v) => v + 90) };
		assert.deepEqual(fitEQ(source, offset, DEFAULT_FIT), []);
	});
	it("improves a real HD 650 target fit while respecting the combined boost/cut limits", () => {
		const t = targets.find((t) => t.label === "Harman over-ear 2018")!;
		const target = preferenceCurve(t.fr, t.bassBoost.gain, 0, 0);
		const bands = fitEQ(source, target, DEFAULT_FIT);
		const f = logFrequencies(4096),
			desired = correctionCurve(source, target, DEFAULT_FIT, f),
			response = combinedResponse(bands, f);
		assert.ok(bands.length > 0 && bands.length <= DEFAULT_FIT.count);
		assert.ok(rms(desired.map((v, i) => v - response[i])) < rms(desired) * 0.2);
		assert.ok(Math.max(...response) <= DEFAULT_FIT.maxBoost + 0.02);
		assert.ok(Math.min(...response) >= -DEFAULT_FIT.maxCut - 0.02);
	});
	it("fits a second headphone's response with the correct sign", () => {
		const f = logFrequencies(512),
			target = { frequency: f, raw: bandResponse(peakBand(250, 5, 1.5), f) };
		const options = { ...DEFAULT_FIT, smoothing: 0, maxFreq: 20000, count: 5 };
		const bands = fitEQ(flat, target, options);
		const response = combinedResponse(bands, f),
			desired = correctionCurve(flat, target, options, f);
		assert.ok(rms(response.map((v, i) => v - desired[i])) < 0.2);
		assert.ok(interpolate({ frequency: f, raw: response }, 250) > 4);
	});
	it("honors cut-only, boost-only, and finite sample-rate limits", () => {
		for (const options of [
			{ ...DEFAULT_FIT, maxBoost: 0 },
			{ ...DEFAULT_FIT, maxCut: 0 }
		]) {
			const bands = fitEQ(source, flat, options, 44100);
			const response = combinedResponse(bands, logFrequencies(4096), 44100);
			assert.ok(response.every(Number.isFinite));
			assert.ok(Math.max(...response) <= options.maxBoost + 0.02);
			assert.ok(Math.min(...response) >= -options.maxCut - 0.02);
		}
	});
	it("does not ask for correction outside measured coverage or the chosen range", () => {
		const limited = { frequency: [100, 1000, 10000], raw: [-10, 0, 5] };
		const desired = correctionCurve(limited, flat, { ...DEFAULT_FIT, minFreq: 200, maxFreq: 6000 }, [20, 100, 200, 1000, 5999, 6000, 10000]);
		assert.ok(desired[0] === 0 && desired[1] === 0 && desired[5] === 0 && desired[6] === 0);
		assert.ok(Math.abs(desired[4]) < 0.01);
	});
});

describe("catalog, targets, and presets", () => {
	it("keeps complete source and rig metadata and safely encodes measurement URLs", () => {
		assert.equal(catalog.paths.length, 6814);
		assert.equal(new Set(catalog.paths).size, catalog.paths.length);
		assert.ok(!catalog.paths.some((path) => path.startsWith("crinacle/")), "preset-only entries without raw CSVs must not appear in the picker");
		const id = "oratory1990/over-ear/Sennheiser HD 650";
		assert.deepEqual(measurementInfo(id), { source: "oratory1990", form: "over-ear", rig: "", name: "Sennheiser HD 650" });
		assert.equal(
			measurementUrl(catalog, id),
			`https://raw.githubusercontent.com/jaakkopasanen/AutoEq/${catalog.revision}/results/oratory1990/over-ear/Sennheiser%20HD%20650/Sennheiser%20HD%20650.csv`
		);
		assert.throws(() => measurementUrl(catalog, "../../untrusted"));
	});
	it("selects compatible targets by source, form, and rig", () => {
		const headphone = { id: "example", name: "example", source: "crinacle", form: "in-ear", rig: "711", curve: source };
		assert.equal(recommendedTarget(targets, headphone)?.label, "AutoEq in-ear");
		assert.ok(compatible(targets.find((t) => t.label === "Harman in-ear 2019")!, headphone));
		assert.ok(!compatible(targets.find((t) => t.label === "Harman over-ear 2018")!, headphone));
		targets.forEach((t) => validateCurve(t.fr));
	});
	it("round-trips full presets without requiring external measurement downloads", () => {
		const session = { ...DEFAULT_SESSION, headphone: { ...measurementInfo(catalog.paths[0]), id: catalog.paths[0], curve: source }, bands: [peakBand(1000, 4)] };
		assert.deepEqual(validateSession(JSON.parse(JSON.stringify(session))), session);
	});
	it("rejects non-finite, out-of-range, and structurally invalid saved settings", () => {
		for (const change of [
			{ version: 3 },
			{ fit: { ...DEFAULT_FIT, strength: Infinity } },
			{ fit: { ...DEFAULT_FIT, minFreq: 5000, maxFreq: 2000 } },
			{ bands: [peakBand(1000, 100)] },
			{ bands: [peakBand(1000, 1, NaN)] },
			{ bands: Array(25).fill(peakBand(1000, 1)) },
			{ audio: { ...DEFAULT_SESSION.audio, enabled: "false" } }
		]) {
			assert.throws(() => validateSession({ ...DEFAULT_SESSION, ...change }));
		}
	});
});
