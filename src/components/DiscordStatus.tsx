import { useState, useEffect, useMemo } from 'react';
import { useLanyard } from 'use-lanyard';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import rawGames from '../assets/gameList.json';

const gameList = rawGames as { [key: string]: string };

const INTERNAL_ASSETS_LINK = "https://cdn.discordapp.com/app-assets/";
const INTERNAL_ICONS_LINK = "https://cdn.discordapp.com/app-icons/";
const EXTERNAL_ASSETS_LINK = "https://media.discordapp.net/external/";

const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const paddedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;

    if (hours > 0) return `${hours}:${paddedMinutes}:${paddedSeconds}`;
    return `${paddedMinutes}:${paddedSeconds}`;
};

const LanyardStatus = () => {
    const [parent] = useAutoAnimate();
    const [visible, setVisible] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date().getTime());

    const { data: status } = useLanyard("342874998375186432");

    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), 500);
        
        const interval = setInterval(() => {
            setCurrentTime(new Date().getTime());
        }, 1000);

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, []);

    const activity = useMemo(() => {
        if (!status?.activities || status.activities.length === 0) return null;
        return status.activities[status.activities.length - 1];
    }, [status]);

    const handleExternalLinks = (image: string | undefined) => {
        if (!image) return null;
        return image.startsWith("mp:external/") 
            ? `${EXTERNAL_ASSETS_LINK}${image.replace("mp:external/", "")}` 
            : `${INTERNAL_ASSETS_LINK}${activity?.application_id}/${image}.png`;
    };

    const largeImage = useMemo(() => {
        if (!activity) return null;
        return gameList[activity.application_id || ""]
            ? `${INTERNAL_ICONS_LINK}${activity.application_id}/${gameList[activity.application_id as keyof typeof gameList]}.png`
            : handleExternalLinks(activity.assets?.large_image);
    }, [activity]);

    const smallImage = useMemo(() => {
        return handleExternalLinks(activity?.assets?.small_image);
    }, [activity]);

    if (!status || !visible || !activity) return <div ref={parent} />;

    return (
        <div ref={parent}>
            {status.spotify && status.spotify.timestamps?.end ? (
                <div className="m-2 rounded-lg bg-viola-100 p-8 shadow-lg">
                    <h2 className="mb-2 text-2xl font-bold">Status</h2>
                    <h3 className="text-md mb-2 font-bold">Listening to Spotify</h3>

                    <div className="flex items-center space-x-4">
                        <img src={status.spotify.album_art_url as string} alt="Album Art" className="h-16 w-16 rounded" />
                        <div>
                            <h4 className="w-32 truncate text-sm md:w-48 lg:w-32 xl:w-32 2xl:w-48" title={status.spotify.song}>
                                {status.spotify.song}
                            </h4>
                            <p className="w-32 truncate text-xs md:w-48 lg:w-32 xl:w-32 2xl:w-48" title={status.spotify.artist as string}>
                                by {status.spotify.artist}
                            </p>
                            <p className="w-32 truncate text-xs md:w-48 lg:w-32 xl:w-32 2xl:w-48" title={status.spotify.album as string}>
                                on {status.spotify.album}
                            </p>
                        </div>
                    </div>

                    <div className="mt-2 flex items-center">
                        <span className="relative inline-block text-left tabular-nums">
                            <span aria-hidden="true" className="invisible block">00:00</span>
                            <span className="absolute inset-0">
                                {formatTime(Math.min(currentTime - status.spotify.timestamps.start, status.spotify.timestamps.end - status.spotify.timestamps.start))}
                            </span>
                        </span>

                        <div className="mx-1 h-3 flex-1 overflow-hidden rounded-xl bg-slate-300">
                            <div
                                className="h-full rounded-xl bg-viola-400"
                                style={{ 
                                    width: `${((currentTime - status.spotify.timestamps.start) / (status.spotify.timestamps.end - status.spotify.timestamps.start)) * 100}%` 
                                }}
                            ></div>
                        </div>

                        <span className="relative inline-block text-right tabular-nums">
                            <span aria-hidden="true" className="invisible block">00:00</span>
                            <span className="absolute inset-0">
                                {formatTime(status.spotify.timestamps.end - status.spotify.timestamps.start)}
                            </span>
                        </span>
                    </div>
                </div>
            ) : (
                // General Activity Layout
                <div className="m-2 rounded-lg bg-viola-100 p-8 shadow-lg">
                    <h2 className="mb-4 text-2xl font-bold">Status</h2>
                    <div className="flex items-center space-x-4">
                        <div className="relative flex-shrink-0">
                            {largeImage && (
                                <img src={largeImage} alt="Large Activity Icon" className="h-16 w-16 rounded" />
                            )}
                            {!largeImage && !smallImage && activity.emoji?.name && (
                                <span className="text-3xl">{activity.emoji.name}</span>
                            )}
                            {smallImage && !largeImage && (
                                <img src={smallImage} alt="Activity Icon" className="h-16 w-16 rounded" />
                            )}
                            {smallImage && largeImage && (
                                <img src={smallImage} alt="Small Activity Icon" className="ring-3 absolute bottom-0 right-0 h-6 w-6 rounded" />
                            )}
                        </div>

                        <div>
                            <h3 className="text-sm font-bold">{activity.name}</h3>
                            <p className="text-xs">{activity.state}</p>
                            <p className="text-xs">{activity.details}</p>
                            <p className="text-xs">{formatTime(currentTime - activity.created_at)} elapsed</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LanyardStatus;