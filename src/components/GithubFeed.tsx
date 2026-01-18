import { useEffect, useState } from "react";
import { type DisplayEvent } from "../pages/api/github";

export default function GitHubFeed() {
	const [events, setEvents] = useState<DisplayEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const res = await fetch("/api/github");

				if (!res.ok) {
					throw new Error(`GitHub feed failed (${res.status})`);
				}

				const data: DisplayEvent[] = await res.json();

				if (!cancelled) {
					setEvents(data);
				}
			} catch (err) {
				if (!cancelled) {
					setError("Failed to load GitHub activity");
					console.error(err);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		load();
		return () => {
			cancelled = true;
		};
	}, []);

	if (loading || error) {
		return (
			<div className="flex flex-col space-y-3">
				{Array.from({ length: 8 }).map((_, i) => (
					<div key={i} className="mx-2 animate-pulse rounded-xl bg-viola-50 p-4 sm:mx-4 sm:p-5">
						<div className="flex items-start space-x-3 sm:space-x-4">
							<div className="h-8 w-8 shrink-0 rounded-full bg-viola-200 sm:h-10 sm:w-10" />
							<div className="flex-1 space-y-2">
								<div className="h-4 w-3/4 rounded bg-viola-200" />
								<div className="h-3 w-full rounded bg-viola-100/70" />
								<div className="h-3 w-5/6 rounded bg-viola-100/70" />
								<div className="h-3 w-24 rounded bg-viola-200/60" />
							</div>
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="flex flex-col space-y-3">
			{events.map((item) => (
				<div key={item.id} className="group mx-2 rounded-xl bg-viola-50 p-4 transition-transform hover:scale-[1.01] sm:mx-4 sm:p-5">
					<a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-start space-x-3 sm:space-x-4">
						<img src={item.actor.avatar_url} alt={item.actor.login} className="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow-sm sm:h-10 sm:w-10" />

						<div className="min-w-0 flex-1">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
								<p className="text-sm font-bold text-gray-900">
									{item.actor.login}
									<span className="mx-0.5 font-normal text-gray-500"> {item.verb} </span>
									<span className="text-viola-700">{item.object}</span>
								</p>

								<span className="mt-1 text-[10px] text-gray-400 sm:mt-0 sm:text-xs">{item.timestamp}</span>
							</div>

							{item.description && (
								<div
									className="mt-2"
									style={{
										maskImage: "linear-gradient(to bottom, black 70%, transparent)",
										WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent)"
									}}
								>
									<p className="line-clamp-3 whitespace-pre-wrap text-xs text-gray-600">{item.description}</p>
								</div>
							)}

							<p className="mt-2 truncate text-[10px] font-semibold tracking-wide text-viola-700/80 sm:text-[11px]">{item.repo}</p>
						</div>
					</a>
				</div>
			))}
		</div>
	);
}
