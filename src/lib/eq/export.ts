import { clamp, correctionPreamp, sanitizeBand, type Band } from "./dsp";
import type { AudioSettings } from "./audio";

const number = (value: number, precision = 6) => String(Number(value.toFixed(precision)));
const TYPES = { peaking: "PK", lowshelf: "LSC", highshelf: "HSC", lowpass: "LPQ", highpass: "HPQ" } as const;

/** Equalizer APO center-frequency shelf types match Web Audio's S=1 shelves. */
export function exportEqualizerAPO(bands: Band[], audio: AudioSettings, sampleRate = 48000, note = ""): string {
	if (!Number.isFinite(sampleRate) || sampleRate < 8000 || !Number.isFinite(audio.preamp)) throw new Error("Invalid export settings.");
	const filters = bands.map(sanitizeBand).map((band) => ({ ...band, freq: clamp(band.freq, 1, sampleRate * 0.49) }));
	// Export the configured correction, even during a temporary listening bypass.
	const preamp = correctionPreamp(filters, audio.preamp, audio.autoGain, sampleRate);
	const lines = [
		"# Headphone EQ · dsns.dev/eq",
		"# Current edited bands; temporary EQ bypass is ignored. OFF bands stay disabled.",
		`# Designed at ${sampleRate} Hz. Shelf Q is fixed at 1/sqrt(2) (slope 1).`,
		"# Player volume, limiter, spectrum, graph normalization and range isolation are not included.",
		...(note ? [`# ${note.replace(/[\r\n]+/g, " ")}`] : []),
		`Preamp: ${number(preamp)} dB`,
		...filters.map((band, i) => {
			const gain = band.type.endsWith("pass") ? "" : ` Gain ${number(band.gain)} dB`;
			const q = band.type.endsWith("shelf") ? Math.SQRT1_2 : band.q;
			return `Filter ${i + 1}: ${band.enabled ? "ON" : "OFF"} ${TYPES[band.type]} Fc ${number(band.freq)} Hz${gain} Q ${number(q, 8)}`;
		})
	];
	return `${lines.join("\n")}\n`;
}
