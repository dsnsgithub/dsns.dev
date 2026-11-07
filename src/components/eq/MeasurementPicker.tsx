import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Catalog, Measurement } from "../../lib/eq/data";
import { indexMeasurements, RIG_LABELS, rigMatch, searchMeasurements, type RigPreference } from "../../lib/eq/search";

interface Props {
	label: string;
	catalog: Catalog | null;
	selected: Measurement | null;
	loading: boolean;
	onSelect: (id: string) => void;
	reference?: Measurement | null;
	rigPreference?: RigPreference;
	onRigPreference?: (preference: RigPreference) => void;
}

export default function MeasurementPicker({ label, catalog, selected, loading, onSelect, reference, rigPreference = "prefer", onRigPreference }: Props) {
	const id = useId();
	const [query, setQuery] = useState(selected?.name ?? "");
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const [limit, setLimit] = useState(30);
	const [source, setSource] = useState("");
	const [form, setForm] = useState("");
	const list = useRef<HTMLDivElement>(null);
	const input = useRef<HTMLInputElement>(null);
	const index = useMemo(() => indexMeasurements(catalog?.paths ?? []), [catalog]);
	const sources = useMemo(() => [...new Set(index.map((m) => m.source))].sort(), [index]);
	const matches = useMemo(() => searchMeasurements(index, query, { reference, rigPreference, source, form }), [index, query, reference, rigPreference, source, form]);
	const visible = matches.slice(0, limit);
	const selectedMatch = selected && reference ? rigMatch(reference, selected) : null;
	useEffect(() => {
		setQuery(selected?.name ?? "");
	}, [selected?.id]);
	useEffect(() => {
		setActive(0);
		setLimit(30);
	}, [query, source, form, reference, rigPreference]);
	useEffect(() => {
		list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
	}, [active]);
	const choose = (path: string) => {
		onSelect(path);
		setOpen(false);
	};

	return (
		<div
			className="eq-picker"
			onBlur={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
			}}
		>
			<label htmlFor={id}>
				<span>{label}</span>
			</label>
			<div className="eq-search-box">
				<input
					ref={input}
					id={id}
					type="search"
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={open}
					aria-controls={`${id}-results`}
					aria-activedescendant={open && visible[active] ? `${id}-result-${active}` : undefined}
					aria-describedby={`${id}-status`}
					placeholder="Try HD650, WH-1000XM5, or a brand…"
					autoComplete="off"
					maxLength={200}
					value={query}
					disabled={!catalog}
					onFocus={(e) => {
						setOpen(true);
						e.currentTarget.select();
					}}
					onClick={() => setOpen(true)}
					onChange={(e) => {
						setQuery(e.currentTarget.value);
						setOpen(true);
						setActive(0);
					}}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							setOpen(false);
							e.preventDefault();
						}
						if (e.key === "ArrowDown" || e.key === "ArrowUp") {
							e.preventDefault();
							setOpen(true);
							if (!open) {
								setActive(0);
								return;
							}
							const next = Math.max(0, Math.min(matches.length - 1, active + (e.key === "ArrowDown" ? 1 : -1)));
							if (next >= limit) setLimit(limit + 30);
							setActive(next);
						}
						if (e.key === "Enter" && open) {
							e.preventDefault();
							if (visible[active]) choose(visible[active].id);
						}
					}}
				/>
				{open && (
					<div className="eq-search-popover">
						<div className="eq-search-filters">
							<label>
								<span>Measurement source</span>
								<select value={source} onChange={(e) => setSource(e.currentTarget.value)}>
									<option value="">All sources</option>
									{sources.map((s) => (
										<option key={s}>{s}</option>
									))}
								</select>
							</label>
							<label>
								<span>Fit type</span>
								<select value={form} onChange={(e) => setForm(e.currentTarget.value)}>
									<option value="">All types</option>
									<option value="over-ear">Over-ear</option>
									<option value="in-ear">In-ear</option>
									<option value="earbud">Earbud</option>
								</select>
							</label>
						</div>
						<div ref={list} id={`${id}-results`} role="listbox" aria-label={`${label} results`} className="eq-search-results">
							{visible.map((m, i) => (
								<button
									key={m.id}
									id={`${id}-result-${i}`}
									data-index={i}
									type="button"
									role="option"
									tabIndex={-1}
									aria-selected={selected?.id === m.id}
									className={`eq-search-result ${active === i ? "is-active" : ""}`}
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => choose(m.id)}
								>
									<strong>{m.name}</strong>
									<span>
										{m.source} · {m.rig || "Rig unspecified"} · {m.form}
									</span>
									{m.match && <small className={`eq-rig-match eq-rig-${m.match}`}>{RIG_LABELS[m.match]}</small>}
								</button>
							))}
						</div>
						{!matches.length && <p className="eq-search-empty">No matches. Try a shorter model name, widen the filters, or import a measurement.</p>}
						{matches.length > limit && (
							<button
								className="eq-search-more"
								onClick={() => {
									setLimit(limit + 30);
									input.current?.focus();
								}}
							>
								Show more ({matches.length - limit} remaining)
							</button>
						)}
					</div>
				)}
			</div>
			{onRigPreference && (
				<label className="eq-rig-preference">
					<span>Target measurement priority</span>
					<select value={rigPreference} onChange={(e) => onRigPreference(e.currentTarget.value as RigPreference)}>
						<option value="prefer">Prefer same rig / measurement set</option>
						<option value="only">Only same rig / measurement set</option>
						<option value="all">All measurements · no preference</option>
					</select>
				</label>
			)}
			<p id={`${id}-status`} className="eq-hint" role="status">
				{loading ? "Loading response…" : !catalog ? "Loading the measurement catalog…" : `${matches.length.toLocaleString()} matches · Type to search; use ↑ ↓ and Enter to select.`}
			</p>
			{onRigPreference && (
				<p className="eq-hint">
					{reference
						? `Matching ${reference.source} / ${reference.rig || "rig unspecified"} / ${reference.form}. Same-source sets are a fallback when rig details are missing.`
						: "Select your headphones first to prioritize matching measurements."}
				</p>
			)}
			{selected && (
				<div className="eq-measurement-meta">
					<strong>{selected.name}</strong>
					<span>
						{selected.source} / {selected.rig || "rig unspecified"} · {selected.form}
					</span>
					{selectedMatch && <span className={`eq-rig-match eq-rig-${selectedMatch}`}>{RIG_LABELS[selectedMatch]}</span>}
					{selected.channels && <span>Average of {selected.channels.join(", ")}</span>}
					{selected.sourceUrl && (
						<a href={selected.sourceUrl} target="_blank" rel="noreferrer">
							View original Hangout.Audio graph ↗
						</a>
					)}
					<button
						className="eq-text-button"
						onClick={() => {
							choose("");
							setQuery("");
						}}
					>
						Clear selection
					</button>
				</div>
			)}
		</div>
	);
}
