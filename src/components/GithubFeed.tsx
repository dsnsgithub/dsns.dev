import { useState, useEffect } from "react";
import { Octokit } from "@octokit/rest";

type DisplayEvent = {
	id: string;
	actor: { login: string; avatar_url: string };
	verb: string;
	object: string;
	description?: string;
	repo: string;
	url: string;
	timestamp: string;
};

const octokit = new Octokit();
const detailCache = new Map<string, { title: string; body: string; merged?: boolean; url: string }>();

const cleanDescription = (text: string | null) => {
	if (!text) return "";
	return text.replace(/[#*`_]/g, "").trim();
};

const formatDate = (isoString: string) => {
	return new Date(isoString).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "numeric"
	});
};

const fetchDetails = async (apiUrl: string) => {
	if (detailCache.has(apiUrl)) return detailCache.get(apiUrl)!;
	try {
		const res = await octokit.request(`GET ${apiUrl}`);
		const data = {
			title: res.data.title || "Untitled",
			body: cleanDescription(res.data.body),
			merged: res.data.merged,
			url: res.data.html_url
		};
		detailCache.set(apiUrl, data);
		return data;
	} catch {
		return { title: "Private or Deleted Content", body: "", url: "#" };
	}
};

export default function GitHubActivity() {
	const [loading, setLoading] = useState(true);
	const [events, setEvents] = useState<DisplayEvent[]>([]);

	useEffect(() => {
		async function fetchGitHubActivity() {
			try {
				const res = await octokit.rest.activity.listPublicEventsForUser({
					username: "dsnsgithub",
					per_page: 30,
					headers: { "X-GitHub-Api-Version": "2022-11-28" }
				});

				const allowedActions = ["opened", "closed", "reopened"];
				const ignoredTypes = ["PushEvent", "IssueCommentEvent", "PullRequestReviewCommentEvent", "CommitCommentEvent"];

				const rawEvents = res.data.filter((e) => !ignoredTypes.includes(e.type!));

				const processedPRs = new Set<string>();
				const tempEvents: DisplayEvent[] = [];

				for (const event of rawEvents) {
					const { payload, actor, repo, created_at, id, type } = event;
					if (!created_at || !id) continue;

					const base = {
						id,
						actor: { login: actor.login, avatar_url: actor.avatar_url },
						repo: repo.name,
						timestamp: formatDate(created_at)
					};

					if (type === "PullRequestEvent" || type === "PullRequestReviewEvent") {
						const pr = (payload as any).pull_request;
						const prKey = `${repo.name}#${pr.number}`;

						if (processedPRs.has(prKey)) continue;

						let verb = "";
						if (type === "PullRequestEvent" && (payload as any).action === "closed" && pr.merged) {
							verb = "merged";
						} else if (type === "PullRequestReviewEvent") {
							const state = (payload as any).review.state.toLowerCase();
							if (state === "commented") continue;
							verb = state.replace("_", " ");
						} else if (type === "PullRequestEvent" && allowedActions.includes((payload as any).action)) {
							verb = (payload as any).action;
						} else {
							continue;
						}

						const details = await fetchDetails(pr.url);
						processedPRs.add(prKey);

						tempEvents.push({
							...base,
							verb: verb + " pull request",
							object: `${details.title} (#${pr.number})`,
							description: details.body,
							url: details.url
						});
					} else if (type === "IssuesEvent") {
						const issue = (payload as any).issue;
						const details = await fetchDetails(issue.url);
						tempEvents.push({
							...base,
							verb: (payload as any).action + " issue",
							object: `${details.title} (#${issue.number})`,
							description: details.body,
							url: details.url
						});
					} else if (type === "WatchEvent") {
						tempEvents.push({
							...base,
							verb: "starred",
							object: repo.name,
							url: `https://github.com/${repo.name}`
						});
					} else if (type === "ForkEvent") {
						const forkee = (payload as any).forkee;
						tempEvents.push({
							...base,
							verb: "forked",
							object: repo.name,
							description: `Original repository created by ${forkee.full_name}`,
							url: forkee.html_url
						});
					}
				}
				setEvents(tempEvents);
			} catch (e) {
				console.error("Error fetching GitHub events:", e);
			} finally {
				setLoading(false);
			}
		}

		fetchGitHubActivity();
	}, []);

	if (loading) {
		return (
			<div className="flex flex-col space-y-3">
				{[...Array(8)].map((_, i) => (
					<div key={i} className="mx-2 animate-pulse rounded-xl bg-viola-50 p-4 sm:mx-4 sm:p-5">
						<div className="flex items-start space-x-3 sm:space-x-4">
							<div className="h-8 w-8 shrink-0 rounded-full bg-viola-200 sm:h-10 sm:w-10" />
							<div className="min-w-0 flex-1">
								<div className="mb-1 flex flex-col sm:mb-0 sm:flex-row sm:items-center sm:justify-between">
									<div className="h-4 w-3/4 rounded bg-viola-200 sm:w-1/2" />
									<div className="mt-2 h-3 w-16 rounded bg-viola-100 sm:mt-0" />
								</div>
								<div className="mt-3 space-y-2">
									<div className="h-3 w-full rounded bg-viola-100/70" />
									<div className="h-3 w-5/6 rounded bg-viola-100/70" />
								</div>
								<div className="mt-4 h-3 w-24 rounded bg-viola-200/60" />
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
				<div
					key={item.id}
					className="group mx-2 rounded-xl border border-transparent bg-viola-50 p-4 transition-all duration-500 hover:scale-[1.01] hover:transition hover:duration-500 sm:mx-4 sm:p-5"
				>
					<a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-start space-x-3 sm:space-x-4">
						<img src={item.actor.avatar_url} alt={item.actor.login} className="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow-sm sm:h-10 sm:w-10" />

						<div className="min-w-0 flex-1">
							<div className="mb-1 flex flex-col sm:mb-0 sm:flex-row sm:items-center sm:justify-between">
								<p className="text-sm font-bold leading-tight text-gray-900">
									{item.actor.login}
									<span className="mx-0.5 font-normal text-gray-500"> {item.verb} </span>
									<span className="break-words text-viola-700">{item.object}</span>
								</p>
								<span className="mt-1 shrink-0 text-[10px] text-gray-400 sm:mt-0 sm:text-xs">{item.timestamp}</span>
							</div>

							{item.description && (
								<div
									className="mt-2"
									style={{
										maskImage: "linear-gradient(to bottom, black 70%, transparent 100%)",
										WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent 100%)"
									}}
								>
									<p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">{item.description}</p>
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
