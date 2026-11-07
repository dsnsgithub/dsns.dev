# dsns.dev
![image](https://github.com/user-attachments/assets/6b21a6a3-961e-4bb1-b09f-68e440649566)



Check out what I do, and explore some of my projects. (remade in Astro)

## Local Development

Install [Bun](https://bun.com/).

```
bun install
bun run dev
```

Open [http://localhost:4321](http://localhost:4321) with your browser to see the result.

## Headphone EQ (`/eq`)

Select your headphone measurement, choose a preference target or a second headphone,
then generate editable parametric EQ. The music spectrum, measured response, target,
predicted response, and EQ correction share a logarithmic frequency axis. Music level
uses dBFS; headphone curves default to a 40 dB span, normalized to 60 dB at 1 kHz,
with Smooth 5. These are display references, not listening SPL. The EQ switch crossfades between the
original and filtered signal without restarting playback.

Tone, fitting limits, individual filters, preamp, headroom, graph layers, alignment,
and smoothing are adjustable. CSV/TXT/TSV imports support measurements and custom
targets; JSON setups preserve the complete setup. Settings also save locally.
EQ processes audio played on this page, not system audio.

Search accepts compact model names (HD650, WH1000XM5), punctuation, and small brand
typos. Results show source, rig, and fit type, with source/type filters and keyboard
selection. Target searches prefer the same rig and source by default; a matching-only
filter is available. When rig metadata is absent, same-source / same-fit sets are
labeled as an unverified fallback, rather than claiming all unknown rigs match.

**Download EQ .txt** exports the edited bands as an Equalizer APO / Peace parametric
profile, including disabled bands and the same preamp/headroom calculation as playback.
The export contains the configured correction even during A/B bypass. It excludes the
player's volume, limiter, and temporary range isolation. A preview shows the exact file;
changed targets are flagged when the current bands have not been regenerated. Use
**Save setup JSON** separately to back up measurements, targets, and display settings.

Graph smoothing uses a natural cubic spline with the numeric scale from
[Hangout.Audio's headphone graph](https://graph.hangout.audio/headphones/), independent
of the fractional-octave smoothing used for EQ fitting. Normalization aligns the graph
at a selected frequency; it does not reproduce Hangout's separate loudness-based dB
normalization mode. Older saved setups receive the new display defaults while keeping
their measurements, fitting settings, filters, and audio settings.

Measurement search combines a pinned AutoEq snapshot (6,814 raw responses and 11
targets) with Crinacle's live [Hangout.Audio](https://graph.hangout.audio/) catalogs:
GRAS 43AG-7 headphones, 711 IEMs, and B&K 4620 / 5128 IEMs. Select
**Crinacle (Hangout.Audio)** in the source filter to browse those measurements.
Pads, modes, and sample variants remain separate; available channel measurements
are averaged in amplitude, with the contributing samples and original graph linked
beside the selection. These curves support the same overlays, target matching,
editable EQ, and profile exports. Saved JSON setups include the measured curves.

Hangout catalogs and selected measurements load through cached Astro API routes.
Use `bun run dev` locally and the configured Vercel adapter in production; this
connection needs a Node server runtime, not static-only hosting. No API key is
required. AutoEq remains available if Hangout is temporarily unreachable.
See [data provenance and refresh instructions](public/autoeq/README.md).
Run the DSP, routing, search, provider, export, display, and setup checks with
`bun run test:eq` and the production checks with `bun run build`.
