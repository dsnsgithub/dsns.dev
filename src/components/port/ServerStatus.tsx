import { useEffect, useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";

const servers = {
	"dsns.dev": [
		{ name: "Main Website", url: "dsns.dev", icon: "dsns.dev" },
		{ name: "Immich", url: "immich.dsns.dev", icon: "immich" },
		{ name: "V2Ray VPN", url: "vray.dsns.dev/dsns", icon: "v2ray vpn" },
		{ name: "Calopoly Server", url: "calopoly-server.dsns.dev", icon: "calopoly.dsns.dev" }
	],
	"onlyeggrolls.com": [{ name: "tetr.io Proxy", url: "tetr.onlyeggrolls.com", icon: "tetr.io" }],
	"orchardlakehouse.com": [{ name: "Main Website", url: "orchardlakehouse.com", icon: "orchardlakehouse.com" }],
	"mseung.dev": [{ name: "Main Website", url: "mseung.dev", icon: "mseung.dev" }]
};

export default function ServerStatus() {
	const [statusData, setStatusData] = useState<Record<string, boolean>>({});
	const [loading, setLoading] = useState(true);
	const [listRef] = useAutoAnimate();

	useEffect(() => {
		const checkServerStatus = async (url: string) => {
			try {
				const response = await fetch(`https://cors.dsns.dev/${url}`, {
					method: "GET"
				});
				if (url === "vray.dsns.dev/dsns") {
					return response.status === 400;
				}

				if (url === "calopoly-server.dsns.dev") {
					return response.status === 404;
				}
				return response.ok;
			} catch {
				return false;
			}
		};

		const checkAllServers = async () => {
			setLoading(true);
			const allUrls = Object.values(servers).flat();
			const results = await Promise.all(
				allUrls.map(async ({ url }) => ({
					url,
					status: await checkServerStatus(url)
				}))
			);
			const newStatus: Record<string, boolean> = {};
			results.forEach(({ url, status }) => {
				newStatus[url] = status;
			});
			setStatusData(newStatus);
			setLoading(false);
		};

		checkAllServers();
		const intervalId = setInterval(checkAllServers, 60000);
		return () => clearInterval(intervalId);
	}, []);

	// Check if all servers are operational after loading is complete
	const allSystemsOperational = !loading && Object.values(statusData).length > 0 && Object.values(statusData).every((status) => status);

	return (
		<div className="min-h-screen rounded-lg bg-viola-100 p-8">
			<h1 className="mb-6 text-3xl font-bold">Server Status</h1>

			{/* All Systems Operational Banner */}
			{!loading && allSystemsOperational && (
				<div className="mb-8 flex items-center rounded-lg border-l-4 border-green-500 bg-green-100 p-4 text-green-800 shadow" role="alert">
					<svg className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div className="ml-3">
						<p className="font-semibold">All systems operational.</p>
					</div>
				</div>
			)}

			{/* Not all systems operation issue banner */}
			{!loading && !allSystemsOperational && (
				<div className="mb-8 flex items-center rounded-lg border-l-4 border-red-500 bg-red-100 p-4 text-red-800 shadow" role="alert">
					<svg className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div className="ml-3">
						<p className="font-semibold">One or more systems are not operational.</p>
					</div>
				</div>
			)}

			{loading ? (
				<div className="flex h-48 items-center justify-center space-x-4">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-viola-600 border-t-transparent"></div>
					<span className="text-2xl font-semibold text-viola-700">Checking servers...</span>
				</div>
			) : (
				<div className="space-y-10" ref={listRef}>
					{Object.entries(servers).map(([domain, services]) => (
						<section key={domain} className="rounded-xl bg-white p-6 shadow-lg transition-shadow hover:shadow-2xl" aria-labelledby={`${domain}-heading`}>
							<h2 id={`${domain}-heading`} className="mb-6 border-b border-viola-200 pb-2 text-3xl font-semibold">
								{domain}
							</h2>

							<ul className="space-y-4">
								{services.map(({ name, url, icon }) => {
									const isOnline = statusData[url];
									return (
										<li
											key={url}
											className={`flex flex-col rounded-lg border-2 p-4 sm:flex-row sm:items-center sm:justify-between ${
												isOnline ? "border-green-400 bg-green-50 text-viola-900" : "border-red-400 bg-red-50 text-red-900"
											} transition-transform duration-200 hover:scale-[1.02]`}
											role="listitem"
											aria-live="polite"
											aria-atomic="true"
										>
											<div className="flex items-center space-x-4">
												<img
													src={`https://decision-day-calendar.armaan.cc/get-favicon/${icon}`}
													alt={`${name} favicon`}
													width={48}
													height={48}
													className="rounded-md shadow-sm"
												/>
												<div>
													<p className="text-lg font-semibold">{name}</p>
													<p className="break-words text-sm text-gray-600">{url}</p>
												</div>
											</div>

											<div className="mt-3 flex items-center space-x-2 sm:mt-0">
												<span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${isOnline ? "bg-viola-200 text-viola-800" : "bg-red-200 text-red-800"}`}>
													{isOnline ? "Online" : "Offline"}
												</span>
											</div>
										</li>
									);
								})}
							</ul>
						</section>
					))}
				</div>
			)}
		</div>
	);
}
