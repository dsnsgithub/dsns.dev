# Headphone measurement data

The catalog and preference targets are derived from [AutoEq](https://github.com/jaakkopasanen/AutoEq), pinned to commit `7ae0f56d53074872b028649617a22bbb4232feb7` (2025-07-20), under its [MIT license](./LICENSE.txt).

- `catalog.json`: 6,814 result paths from `results/INDEX.md` verified against the pinned Git trees to have a raw CSV. The full index has 8,850 presets, but 2,036 Crinacle entries have no raw CSV and are excluded. Paths preserve the measurement source, rig/form, model, and variant. This snapshot is not a live catalog.
- `targets.json`: labels, compatibility/recommendation metadata, default bass shelf, and raw target responses from `webapp/data/targets.json`. Non-raw intermediate columns were omitted. The base responses exclude the supplied default bass boost; the UI adds that shelf before the user's bass/treble/tilt preferences.
- `sennheiser-hd-650.csv`: unmodified `results/oratory1990/over-ear/Sennheiser HD 650/Sennheiser HD 650.csv`, bundled as an offline example. Other measurement CSVs load on demand from the same pinned AutoEq revision on raw.githubusercontent.com. Their `raw` column is used, not a pre-equalized column or precomputed EQ preset.

Original measurements are credited to the source shown in each picker (including oratory1990, Super Review, Rtings, and other AutoEq contributors). AutoEq's Crinacle preset folders do not publish raw CSV responses in this snapshot, so the app connects separately to Crinacle's current [Hangout.Audio](https://graph.hangout.audio/) measurement catalogs. CSV/TXT/TSV imports also support user-supplied measurements and targets.

## Hangout.Audio / Crinacle

The **Crinacle (Hangout.Audio)** source loads these public catalogs at runtime:

- [Headphones](https://graph.hangout.audio/headphones/data/phone_book.json): GRAS 43AG-7, with L1–L3 and R1–R3 samples when available.
- [711 IEMs](https://graph.hangout.audio/iem/711/data/phone_book.json): 711 coupler, with L/R samples.
- [5128 IEMs](https://graph.hangout.audio/iem/5128/data/phone_book.json): B&K 4620 using the 5128 ear simulator, with L/R samples.

These are live catalogs, independent of the pinned AutoEq snapshot. Model variants preserve their upstream filenames, including pad condition, ANC modes, and samples. Counts change as Hangout updates its catalogs. The 4620 / 5128 collection is kept distinct from other sources' full 5128 fixtures when ranking headphone matches. Preference targets use AutoEq's compatibility metadata for Crinacle's respective rigs.

`/api/eq/hangout/catalog.json` caches catalogs for one hour. `/api/eq/hangout/measurement.json?id=…` loads only the selected model's raw channel measurements, using the request and response format of the public [Hangout EQ tool](https://eq.hangout.audio/). The server accepts only model IDs from those catalogs. Measurements are cached for 24 hours; the in-process curve cache holds up to 64 models. No account or API key is required. These routes require Astro's Node server runtime, supplied by the configured Vercel adapter.

Available channel curves are interpolated in log frequency over their common measured range and averaged using Hangout's amplitude convention: `20 × log10(mean(10^(dB / 20)))`. They are not pre-equalized. Missing samples explicitly reported by Hangout are omitted and the contributing channel labels are shown beside the selection; network or decoding failures produce an error instead of silently changing the average. Original graph links are preserved in saved setups, along with the raw averaged curve. Graph smoothing and normalization are applied separately for display.

Catalog failures keep any previously cached entries, identify the unavailable collection, and allow a retry after one minute. AutoEq loads independently. This integration depends on Hangout's current public interface; upstream changes or outages can temporarily affect it. It is not an official or complete offline mirror. Hangout measurements are credited to Crinacle / Hangout.Audio and are **not covered by the bundled AutoEq MIT license**.

## EQ and updates

The browser fits a bounded approximation with editable parametric filters. It does not run the upstream Python AutoEq optimizer. Responses are aligned at the chosen reference frequency; FFT levels use a separate dBFS axis. Predicted headphone response is measurement plus active filter response, excluding overall gain, limiter action, and optional frequency-isolation filters.

Match source, rig, and headphone variant when possible. A headphone match approximates tonal balance; it cannot reproduce another headphone's physical fit, distortion, or spatial qualities. A flat measured response is not a perceptually neutral headphone target.

To refresh the pinned AutoEq data, run `bun scripts/update-autoeq-data.ts <full-upstream-commit-sha>` and review the generated changes. The script also preserves the upstream license and example CSV. Hangout catalogs refresh automatically through the server cache.
