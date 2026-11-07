import { correctionPreamp, type Band } from "./dsp";

export interface AudioSettings {
	enabled: boolean;
	autoGain: boolean;
	matchBypass: boolean;
	preamp: number;
}

/** A fixed graph keeps playback and FFT taps alive while EQ is edited or bypassed. */
export class EqualizerAudio {
	readonly context: AudioContext;
	readonly input: AnalyserNode;
	readonly output: AnalyserNode;
	readonly limiter: DynamicsCompressorNode;
	readonly filters: BiquadFilterNode[];
	private source: MediaElementAudioSourceNode;
	private eqWet: GainNode;
	private eqDry: GainNode;
	private selectionWet: GainNode;
	private selectionDry: GainNode;
	private highpass: BiquadFilterNode[] = [];
	private lowpass: BiquadFilterNode[] = [];
	private trim: GainNode;
	private timer?: ReturnType<typeof setTimeout>;
	private settings: AudioSettings = { enabled: true, autoGain: true, matchBypass: true, preamp: 0 };
	private bands: Band[] = [];
	private transition = false;
	trimDb = 0;

	constructor(player: HTMLAudioElement) {
		this.context = new AudioContext();
		const c = this.context;
		this.source = c.createMediaElementSource(player);
		this.input = c.createAnalyser();
		this.output = c.createAnalyser();
		for (const analyser of [this.input, this.output]) {
			analyser.fftSize = 8192;
			analyser.minDecibels = -100;
			analyser.maxDecibels = 0;
			analyser.smoothingTimeConstant = 0.8;
		}
		this.eqWet = c.createGain();
		this.eqDry = c.createGain();
		this.eqDry.gain.value = 0;
		this.selectionWet = c.createGain();
		this.selectionDry = c.createGain();
		this.selectionWet.gain.value = 0;
		this.trim = c.createGain();
		const eqBus = c.createGain();
		this.filters = Array.from({ length: 24 }, () => {
			const filter = c.createBiquadFilter();
			filter.type = "peaking";
			filter.gain.value = 0;
			return filter;
		});
		this.source.connect(this.input);
		this.input.connect(this.eqDry).connect(eqBus);
		let node: AudioNode = this.input;
		for (const filter of this.filters) {
			node.connect(filter);
			node = filter;
		}
		node.connect(this.eqWet).connect(eqBus);
		eqBus.connect(this.selectionDry).connect(this.trim);
		node = eqBus;
		// Sixteen-pole Butterworth per edge, preserving the original range-isolation feature.
		for (const type of ["highpass", "lowpass"] as const) {
			for (let k = 0; k < 8; k++) {
				const filter = c.createBiquadFilter();
				filter.type = type;
				filter.frequency.value = type === "highpass" ? 20 : Math.min(20000, c.sampleRate * 0.49);
				filter.Q.value = 20 * Math.log10(1 / (2 * Math.cos((Math.PI * (2 * k + 1)) / 32)));
				(type === "highpass" ? this.highpass : this.lowpass).push(filter);
				node.connect(filter);
				node = filter;
			}
		}
		node.connect(this.selectionWet).connect(this.trim);
		this.limiter = c.createDynamicsCompressor();
		this.limiter.threshold.value = -1;
		this.limiter.knee.value = 0;
		this.limiter.ratio.value = 20;
		this.limiter.attack.value = 0.003;
		this.limiter.release.value = 0.25;
		const clipInput = c.createGain();
		clipInput.gain.value = 0.5;
		const clip = c.createWaveShaper();
		const curve = new Float32Array(8193);
		for (let i = 0; i < curve.length; i++) {
			const x = ((i / (curve.length - 1)) * 2 - 1) * 2,
				a = Math.abs(x);
			curve[i] = a <= 0.98 ? x : Math.sign(x) * (0.98 + 0.02 * Math.tanh((a - 0.98) / 0.02));
		}
		clip.curve = curve;
		clip.oversample = "4x";
		this.trim.connect(this.limiter).connect(clipInput).connect(clip).connect(this.output).connect(c.destination);
	}

	private ramp(param: AudioParam, value: number, tc = 0.015) {
		const now = this.context.currentTime;
		// Hold the current ramp before replacing it; rapid knob moves cannot queue stale changes.
		param.cancelAndHoldAtTime(now);
		param.setTargetAtTime(value, now, tc);
	}

	setBands(bands: Band[]) {
		this.bands = bands;
		clearTimeout(this.timer);
		const typeChange = this.filters.some((node, i) => node.type !== (bands[i]?.enabled ? bands[i].type : "peaking"));
		const apply = () => {
			this.filters.forEach((node, i) => {
				const band = this.bands[i],
					active = band?.enabled;
				node.type = active ? band.type : "peaking";
				this.ramp(node.frequency, Math.min(band?.freq ?? 1000, this.context.sampleRate * 0.49));
				this.ramp(node.gain, active ? band.gain : 0);
				const q = band?.q ?? 1;
				this.ramp(node.Q, node.type === "highpass" || node.type === "lowpass" ? 20 * Math.log10(q) : q);
			});
			this.transition = false;
			this.setSettings(this.settings);
		};
		if (typeChange && this.context.state === "running") {
			this.transition = true;
			this.ramp(this.eqWet.gain, 0, 0.005);
			this.ramp(this.eqDry.gain, 1, 0.005);
			this.timer = setTimeout(apply, 40);
		} else apply();
	}

	setSettings(settings: AudioSettings) {
		this.settings = settings;
		if (!this.transition) {
			this.ramp(this.eqWet.gain, settings.enabled ? 1 : 0);
			this.ramp(this.eqDry.gain, settings.enabled ? 0 : 1);
		}
		// Headroom is held in bypass by default: comparison does not jump up by the EQ's boost.
		const compensate = settings.autoGain && (settings.enabled || settings.matchBypass);
		this.trimDb = correctionPreamp(this.bands, settings.preamp, compensate, this.context.sampleRate);
		this.ramp(this.trim.gain, 10 ** (this.trimDb / 20), 0.04);
	}

	setSelection(range: [number, number] | null) {
		if (range) {
			const max = Math.min(20000, this.context.sampleRate * 0.49);
			const lo = Math.max(20, Math.min(range[0], max / 1.05));
			const hi = Math.min(max, Math.max(range[1], lo * 1.05));
			this.highpass.forEach((f) => this.ramp(f.frequency, lo));
			this.lowpass.forEach((f) => this.ramp(f.frequency, hi));
		}
		this.ramp(this.selectionWet.gain, range ? 1 : 0);
		this.ramp(this.selectionDry.gain, range ? 0 : 1);
	}

	setDetail(power: number) {
		this.input.fftSize = this.output.fftSize = 2 ** power;
	}
	async resume() {
		if (this.context.state === "suspended") await this.context.resume();
	}
	dispose() {
		clearTimeout(this.timer);
		this.source.disconnect();
		void this.context.close();
	}
}
