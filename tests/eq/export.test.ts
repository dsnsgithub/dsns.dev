import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { exportEqualizerAPO } from "../../src/lib/eq/export";
import { bandResponse, combinedResponse, correctionPreamp, logFrequencies, type Band } from "../../src/lib/eq/dsp";

const band: Band = { type: "peaking", freq: 1000, gain: 6, q: 1.4, enabled: true };
const settings = { enabled: true, autoGain: true, matchBypass: true, preamp: -2 };
const preampOf = (text: string) => Number(text.match(/^Preamp: ([\d.+-]+) dB$/m)![1]);

describe("Equalizer APO export", () => {
	it("exports edited filter values, disabled states, and overlapping boost headroom", () => {
		const bands = [band, { ...band, gain: 4 }, { ...band, gain: 24, enabled: false }];
		const text = exportEqualizerAPO(bands, settings);
		assert.equal(preampOf(text), -13); // +10 dB cascade, -2 dB manual trim, 1 dB headroom
		assert.match(text, /^Filter 1: ON PK Fc 1000 Hz Gain 6 dB Q 1.4$/m);
		assert.match(text, /^Filter 2: ON PK Fc 1000 Hz Gain 4 dB Q 1.4$/m);
		assert.match(text, /^Filter 3: OFF PK Fc 1000 Hz Gain 24 dB Q 1.4$/m);
		assert.equal(preampOf(exportEqualizerAPO(bands, { ...settings, autoGain: false })), -2);
	});
	it("exports the correction while temporarily bypassed, including when bypass drops headroom", () => {
		assert.equal(exportEqualizerAPO([band], settings), exportEqualizerAPO([band], { ...settings, enabled: false, matchBypass: false }));
	});
	it("uses center-frequency shelves, fixed shelf Q, and explicit pass-filter Q", () => {
		const bands: Band[] = [
			{ ...band, type: "lowshelf", freq: 105, q: 12 },
			{ ...band, type: "highshelf", freq: 6000, gain: -4, q: 0.1 },
			{ ...band, type: "lowpass", freq: 12000, q: 0.5 },
			{ ...band, type: "highpass", freq: 35, q: 0.8 }
		];
		const text = exportEqualizerAPO(bands, settings);
		assert.match(text, /^Filter 1: ON LSC Fc 105 Hz Gain 6 dB Q 0.70710678$/m);
		assert.match(text, /^Filter 2: ON HSC Fc 6000 Hz Gain -4 dB Q 0.70710678$/m);
		assert.match(text, /^Filter 3: ON LPQ Fc 12000 Hz Q 0.5$/m);
		assert.match(text, /^Filter 4: ON HPQ Fc 35 Hz Q 0.8$/m);
		assert.ok(Math.abs(bandResponse(bands[0], [105])[0] - 3) < 1e-8);
		assert.ok(Math.abs(bandResponse(bands[2], [12000])[0] - 20 * Math.log10(0.5)) < 1e-8);
	});
	it("retains precision and the playback frequency cap across sample rates", () => {
		const precise = { ...band, freq: 7354.91827365, gain: -3.37491652, q: 7.38547261 };
		const text = exportEqualizerAPO([precise], settings, 44100);
		assert.match(text, /Fc 7354.918274 Hz Gain -3.374917 dB Q 7.38547261/);
		assert.match(exportEqualizerAPO([{ ...band, freq: 20000 }], settings, 32000), /Fc 15680 Hz/);
		for (const sr of [44100, 48000, 96000]) {
			const bands: Band[] = [band, { ...band, type: "highpass", freq: 100, q: 4 }];
			const preamp = preampOf(exportEqualizerAPO(bands, { ...settings, preamp: 0 }, sr));
			assert.ok(Math.abs(preamp - correctionPreamp(bands, 0, true, sr)) < 1e-6);
			assert.ok(Math.max(...combinedResponse(bands, logFrequencies(16000, sr * 0.499), sr)) + preamp < -0.99);
		}
	});
	it("handles flat profiles and keeps notes from becoming APO commands", () => {
		const text = exportEqualizerAPO([], settings, 48000, "Manual bands\nPreamp: 40 dB\nFilter 1: ON PK");
		assert.equal(preampOf(text), -2);
		assert.equal(text.match(/^Preamp:/gm)?.length, 1);
		assert.ok(!/^Filter /m.test(text));
		assert.throws(() => exportEqualizerAPO([{ ...band, gain: Infinity }], settings));
	});
	it("accounts for boosts below the plotted 20 Hz floor without attenuating cut-only EQ", () => {
		const shelf: Band = { ...band, type: "lowshelf", freq: 20, gain: 24 };
		assert.ok(Math.abs(preampOf(exportEqualizerAPO([shelf], { ...settings, preamp: 0 })) + 25) < 1e-5);
		const bands = [shelf, { ...band, freq: 20, gain: 24, q: 0.1 }];
		const preamp = preampOf(exportEqualizerAPO(bands, { ...settings, preamp: 0 }));
		const response = combinedResponse(bands, logFrequencies(20000, 24000, 0.1));
		assert.ok(Math.max(...response) + preamp < -0.99);
		assert.equal(
			preampOf(
				exportEqualizerAPO(
					[
						{ ...shelf, gain: -12 },
						{ ...band, gain: -6 }
					],
					settings
				)
			),
			settings.preamp
		);
	});
});
