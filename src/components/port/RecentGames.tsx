import { useState } from "react";

interface StatusData {
	success: boolean;
	uuid: string;
	session: {
		online: boolean;
		gameType: string;
		mode: string | null;
		map: string | null;
	};
}

interface Game {
	date: number;
	gameType: string;
	mode: string | null;
	map: string | null;
	ended?: number; // Optional property
}

interface RecentGamesData {
	success: boolean;
	uuid: string;
	games: Game[];
}

interface HypixelAPIResponse {
	success: boolean;
	lastUpdated: number;
	games: {
		[key: string]: {
			modeNames?: {
				[key: string]: string;
			};
			databaseName: string;
			name: string;
			retired?: boolean;
			legacy?: boolean;
			id: number;
		};
	};
}

export default function RecentGames({ children }: { children: JSX.Element }) {
	const [username, setUsername] = useState("");
	const [actualUsername, setActualUsername] = useState<String | number>("");
	const [uuid, setUUID] = useState("");

	const [statusData, setStatusData] = useState<StatusData>();
	const [recentGamesData, setRecentGamesData] = useState<RecentGamesData>();
	const [gamesList, setGamesList] = useState<HypixelAPIResponse>();

	const [statusVisible, setStatusVisible] = useState(false);

	async function handleInput() {
		try {
			const response = await fetch(`https://cors.dsns.dev/api.mojang.com/users/profiles/minecraft/${username}`);
			const data = await response.json();

			if (!data["id"]) {
				setActualUsername(-1);
				return;
			}

			setUUID(data["id"]);
			setActualUsername(data["name"]);

			const status = await fetch(`https://hypixel.dsns.dev/status/${data["id"]}`);
			const recentGames = await fetch(`https://hypixel.dsns.dev/recentgames/${data["id"]}`);

			if (!gamesList) {
				const games = await fetch(`https://api.hypixel.net/resources/games`);
				setGamesList(await games.json());
			}

			setStatusData(await status.json());
			setRecentGamesData(await recentGames.json());
			setStatusVisible(true);
		} catch (error) {
			console.error("Error fetching recent games data:", error);
		}
	}

	return (
		<div>
			<div className="rounded-xl bg-viola-100 p-4 shadow-xl lg:p-8">
				<div className="mb-4">
					<h1 className="text-3xl font-semibold">Recent Games Finder</h1>
					<h2>Find the status and recent games of any Hypixel player.</h2>
				</div>

				<div className="mb-4 flex flex-row">
					<input
						type="text"
						id="inputBox"
						placeholder="Search..."
						className="w-5/6 flex-grow rounded-lg border px-6 py-4 text-xl focus:border-viola-500 focus:outline-none"
						onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
						onKeyDown={(e) => e.key === "Enter" && handleInput()}
					></input>
					<button className="ml-4 flex flex-row items-center rounded-xl border-2 border-viola-300 bg-viola-200 p-5 shadow-xl" onClick={() => handleInput()}>
						{children}
						<div className="hidden md:block">Lookup</div>
					</button>
				</div>

				<div>
					{actualUsername != -1 ? (
						<></>
					) : (
						<div className="m-2 rounded-xl border-2 border-viola-300 bg-viola-100 p-6 text-center shadow-xl">
							<h2 className="text-2xl text-red-500">Invalid IGN. Please try again.</h2>
						</div>
					)}

					<div className={`mt-1 items-center lg:flex lg:flex-row lg:justify-around ${statusVisible ? "block" : "hidden"}`}>
						<div className="flex flex-col">
							{actualUsername != -1 && statusData ? (
								<div className="mt-1 rounded-xl border-2 border-viola-300 bg-viola-100 p-6 shadow-xl lg:m-2">
									<h2 className="mb-3 text-2xl font-semibold">Status</h2>

									{statusData.success && statusData.session && statusData.session.online && gamesList ? (
										statusData.session.mode == "LOBBY" ? (
											<p className="text-center text-xl">
												{actualUsername} is <span className="text-green-600">online</span>. They are in a{" "}
												{gamesList["games"][statusData.session.gameType] ? gamesList["games"][statusData.session.gameType]["name"] : statusData.session.gameType} lobby.
											</p>
										) : (
											<p className="text-center text-xl">
												{actualUsername} is <span className="text-green-600">online</span>. They are playing{" "}
												{gamesList["games"][statusData.session.gameType] ? gamesList["games"][statusData.session.gameType]["name"] : statusData.session.gameType}.
											</p>
										)
									) : (
										<p className="text-center text-xl">
											{actualUsername} is <span className="text-red-600">offline</span>.
										</p>
									)}
								</div>
							) : (
								<></>
							)}

							{actualUsername != -1 && recentGamesData && (recentGamesData?.games?.length || -1) > 0 ? (
								<div className="mt-1 rounded-xl border-2 border-viola-300 bg-viola-100 p-6 shadow-xl lg:m-2">
									<h2 className="mb-3 text-2xl font-semibold">Recent Games</h2>
									<div className="overflow-x-auto">
										<table className="w-full table-auto">
											<thead>
												<tr className="border-2 border-viola-300 bg-viola-200">
													<th className="border border-viola-300 px-4 py-2 text-center">Game Type</th>
													<th className="border border-viola-300 px-4 py-2 text-center">Mode</th>
													<th className="border border-viola-300 px-4 py-2 text-center">Map</th>
													<th className="border border-viola-300 px-4 py-2 text-center">Start Time</th>
													<th className="border border-viola-300 px-4 py-2 text-center">End Time</th>
												</tr>
											</thead>
											<tbody>
												{recentGamesData.success &&
													recentGamesData.games.map((game, index) => (
														<tr key={index} className="border-2 border-viola-300 bg-viola-200">
															<td className="border border-viola-300 px-4 py-2 text-center">
																{gamesList && gamesList["games"][game.gameType] ? gamesList["games"][game.gameType]["name"] : game.gameType}
															</td>
															<td className="border border-viola-300 px-4 py-2 text-center">
																{gamesList && gamesList["games"][game.gameType]["modeNames"]?.[game.mode || ""]
																	? gamesList["games"][game.gameType]["modeNames"]?.[game.mode || ""]
																	: game.mode}
															</td>
															<td className="border border-viola-300 px-4 py-2 text-center">{game.map || "-"}</td>
															<td className="border border-viola-300 px-4 py-2 text-center">{new Date(game.date).toLocaleString()}</td>
															<td className="border border-viola-300 px-4 py-2 text-center">{game.ended ? new Date(game.ended).toLocaleString() : "Still Playing"}</td>
														</tr>
													))}
											</tbody>
										</table>
									</div>
								</div>
							) : recentGamesData?.success && actualUsername != -1 ? (
								<div className="m-2 rounded-xl border-2 border-viola-300 bg-viola-100 p-6 shadow-xl">
									<h2 className="mb-3 text-2xl font-semibold">Recent Games</h2>
									<p className="text-center text-xl">{actualUsername} has no recent games.</p>
								</div>
							) : (
								<></>
							)}

							{actualUsername != -1 && uuid && (statusData || recentGamesData) ? (
								<div className="m-2 overflow-scroll rounded-xl border-2 border-viola-300 bg-viola-100 p-6 shadow-xl scrollbar-none">
									<img src={`https://hypixel.paniek.de/signature/${uuid}/general-tooltip`} alt="Hypixel Player Information" className="min-h-[170px] min-w-[430px]"></img>
								</div>
							) : (
								<></>
							)}
						</div>

						{actualUsername != -1 && uuid && (statusData || recentGamesData) ? (
							<div className="flex flex-col">
								<div className="m-2 flex items-center justify-center rounded-xl border-2 border-viola-300 bg-viola-100 p-6 shadow-xl">
									<img src={`https://mc-heads.net/body/${uuid}`} alt="Minecraft Player Model" className="min-h-[432px] min-w-[180px]"></img>
								</div>
							</div>
						) : (
							<></>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
