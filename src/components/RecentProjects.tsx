import { useEffect, useState } from "react";

interface GithubAPIResponse {
	name: string;
	fork: boolean;
	description: string;
	language: string;
	html_url: string;
	pushed_at: string;
}

export default function RecentProjects() {
	const [result, setResult] = useState<GithubAPIResponse[]>([]);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		fetch("https://cors.dsns.dev/api.github.com/users/dsnsgithub/repos")
			.then((res) => res.json())
			.then((res) => {
				const result = (res as GithubAPIResponse[])
					.filter((repo) => repo.fork === false)
					.sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime())
					.splice(0, 8);

				setResult(result);
			});

		setTimeout(() => setVisible(!visible), 500);
	}, []);

	if (result.length === 0 || !visible) {
		return (
			<ul>
				{Array.from({ length: 8 }).map((_, i) => (
					<li className="m-4 p-8 bg-viola-50 rounded-xl h-32" key={i}>
						<div className="flex flex-row flex-wrap justify-between">
							<div className="bg-viola-200 w-32 h-6 rounded-xl animate-pulse" />
							<div className="bg-viola-200 w-16 h-6 rounded-xl animate-pulse" />
						</div>

						<div className="bg-viola-100 h-10 mt-4 rounded-xl animate-pulse" />
					</li>
				))}
			</ul>
		);
	}

	return (
		<ul>
			{result.map((repo) => (
				<li className="m-4 p-8 bg-viola-50 rounded-xl hover:transition duration-500 hover:duration-500 hover:scale-[1.01]" key={repo.html_url}>
					<a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="block">
						<div className="flex flex-row flex-wrap justify-between">
							<p className="text-xl font-bold">{repo.name}</p>
							{repo.language ? <div className="rounded-xl bg-viola-200 p-2">{repo.language}</div> : null}
						</div>
						<p>{repo.description}</p>
						<p title={new Date(repo.pushed_at).toLocaleDateString() + " " + new Date(repo.pushed_at).toLocaleTimeString()}>Last updated: {new Date(repo.pushed_at).toLocaleDateString()}</p>
					</a>
				</li>
			))}
		</ul>
	);
}
