import { useEffect, useState } from "react";
import { useLanyard } from "react-use-lanyard";
import { useAutoAnimate } from "@formkit/auto-animate/react";

import rawGames from "../assets/gameList.json";
const gameList = rawGames as { [key: string]: string };

function formatTime(milliseconds: number) {
	const minutes = Math.floor(milliseconds / 1000 / 60);
	const seconds = Math.floor((milliseconds / 1000) % 60);

	const paddedMinutes = minutes < 10 ? "0" + minutes : minutes;
	const paddedSeconds = seconds < 10 ? "0" + seconds : seconds;

	return paddedMinutes + ":" + paddedSeconds;
}

function DiscordCard(props: { visible: boolean; }) {
	const [secondAnimate] = useAutoAnimate();
	const { loading, status } = useLanyard({
		userId: "342874998375186432",
		socket: true
	});

	const [currentTime, setCurrentTime] = useState(new Date().getTime());
	setInterval(() => setCurrentTime(new Date().getTime()), 1000);

	if (loading || !props.visible || !status?.activities || status.activities.length == 0) {
		return <></>;
	}

	const activity = status?.activities[status?.activities.length - 1];
	if (!activity) {
		return <></>;
	}

	if (status.spotify) {
		const startTime = status.spotify?.timestamps?.start || 0;
		const endTime = status.spotify?.timestamps?.end || 0;
		const songDuration = endTime - startTime;

		const spotify = status.spotify;

		return (
			<div className="bg-viola-100 rounded-lg p-8 m-2 shadow-lg">
				<h2 className="text-2xl font-bold mb-2">Status</h2>
				<h3 className="font-bold mb-2 text-md">Listening to Spotify</h3>

				<div className="flex items-center space-x-4">
					<img src={spotify.album_art_url} alt="Album Art" className="w-16 h-16 rounded" />
					<div>
						<h4 className="text-sm w-32 truncate">{spotify.song}</h4>
						<p className="text-xs w-32 truncate">by {spotify.artist}</p>
						<p className="text-xs w-32 truncate">on {spotify.album}</p>
					</div>
				</div>

				<div className="flex items-center space-x-2 mt-2">
					<span>{formatTime(Math.min(currentTime - startTime, songDuration))}</span>
					<progress
						value={currentTime - startTime}
						max={songDuration}
						className="w-3/4 rounded-xl [&::-webkit-progress-bar]:rounded-lg [&::-webkit-progress-value]:rounded-lg   [&::-webkit-progress-bar]:bg-slate-300 [&::-webkit-progress-value]:bg-viola-400 [&::-moz-progress-bar]:bg-viola-400"
					></progress>
					<span>{formatTime(songDuration)}</span>
				</div>
			</div>
		);
	}

	const internalAssetsLink = "https://cdn.discordapp.com/app-assets/";
	const internalIconsLink = "https://cdn.discordapp.com/app-icons/";
	const externalAssetsLink = "https://media.discordapp.net/external/";

	let largeImage = activity.assets?.large_image
		? activity.assets?.large_image.startsWith("mp:external/")
			? `${externalAssetsLink}${activity.assets.large_image.replace("mp:external/", "")}`
			: `${internalAssetsLink}${activity?.application_id}/${activity.assets?.large_image}.png`
		: null;

	largeImage = gameList[activity.application_id || ""] ? `${internalIconsLink}${activity?.application_id}/${gameList[activity.application_id || ""]}.png` : largeImage;

	let smallImage = activity.assets?.small_image
		? activity.assets?.small_image.startsWith("mp:external/")
			? `${externalAssetsLink}${activity.assets.small_image.replace("mp:external/", "")}`
			: `${internalAssetsLink}${activity?.application_id}/${activity.assets?.small_image}.png`
		: null;

	return (
		<div className="bg-viola-100 rounded-lg p-8 m-2 shadow-lg">
			<h2 className="text-2xl font-bold mb-4">Status</h2>
			<div className="flex items-center space-x-4">
				<div className="flex-shrink-0 relative" ref={secondAnimate}>
					{largeImage ? <img src={largeImage} alt="Activity Image" className="w-16 h-16 rounded" /> : <></>}
					{smallImage && !largeImage ? <img src={smallImage} alt="Activity Image" className="w-16 h-16 rounded" /> : <></>}
					{smallImage && largeImage ? <img src={smallImage} alt="Activity Image" className="w-6 h-6 rounded right-0 bottom-0 absolute ring-3" /> : <></>}
				</div>

				<div>
					<h4 className="text-sm font-bold">{activity.name}</h4>
					<p className="text-xs">{activity.state}</p>
					<p className="text-xs">{activity.details}</p>
					<p className="text-xs">{formatTime(currentTime - activity.created_at)} elapsed</p>
				</div>
			</div>
		</div>
	);
}

export default function DiscordStatus() {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		setTimeout(() => setVisible(!visible), 1000);
	}, [])

	const [animationParent] = useAutoAnimate({duration: 500});
	return (
		<div ref={animationParent}>
			<DiscordCard visible={visible} />
		</div>
	);
}
