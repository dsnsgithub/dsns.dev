import birthdaysData from "../../assets/birthdays.json";
import Confetti from "react-confetti";
import { Tooltip } from "react-tooltip";
import { useEffect, useState } from "react";

interface Birthday {
	name: string;
	date: Date;
}

function calculateDaysUntilDate(targetDate: Date): number {
	const difference = targetDate.getTime() - new Date().getTime();
	return Math.ceil(difference / (1000 * 60 * 60 * 24));
}

function calculatePercent(targetDate: Date): number {
	const difference = targetDate.getTime() - new Date().getTime();
	const oneYear = 1000 * 60 * 60 * 24 * 365;

	return ((oneYear - difference) / oneYear) * 100;
}

export default function BirthdaysElem() {
	const birthdays: Birthday[] = [];
	const [height, setHeight] = useState(0);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		const updateDimensions = () => {
			setHeight(document.body.scrollHeight + 100);
			setWidth(window.innerWidth);
		};

		updateDimensions();

		window.addEventListener("resize", updateDimensions);

		return () => {
			window.removeEventListener("resize", updateDimensions);
		};
	}, []);

	for (const birthday of birthdaysData) {
		const newBirthday: Birthday = {
			name: birthday.name,
			date: new Date(birthday.date + " " + new Date().getFullYear())
		};

		if (newBirthday.date.getTime() + 86400000 < new Date().getTime()) {
			newBirthday.date.setFullYear(new Date().getFullYear() + 1);
		}

		birthdays.push(newBirthday);
	}

	birthdays.sort((a, b) => {
		return new Date(a.date).getTime() - new Date(b.date).getTime();
	});

	let birthdayToday = false;
	for (const birthday of birthdays) {
		if (birthday.date.getTime() + 86400000 > new Date().getTime() && birthday.date.getTime() < new Date().getTime()) {
			birthdayToday = true;
			break;
		}
	}

	return (
		<>
			{birthdayToday && width && height ? <Confetti width={width} height={height}></Confetti> : <></>}
			<div className="rounded-xl bg-viola-100 p-4 shadow-xl lg:p-8">
				<h1 className="mb-4 text-3xl font-semibold">Birthdays</h1>
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{birthdays.map((birthday) => (
						<div key={birthday.name} className="rounded-xl bg-viola-50 p-6 shadow-md">
							<div className="flex">
								<Tooltip id={birthday.date.toLocaleDateString()}></Tooltip>
								<h2 className="mb-2 text-xl font-semibold" data-tooltip-id={birthday.date.toLocaleDateString()} data-tooltip-content={birthday.date.toLocaleDateString()}>
									{birthday.name}
								</h2>
							</div>

							<div className="mb-4">
								{birthday.date.getTime() + 86400000 > new Date().getTime() && birthday.date.getTime() < new Date().getTime() ? (
									<p className="font-bold">Happy Birthday {birthday.name}!</p>
								) : (
									<p>
										{calculateDaysUntilDate(birthday.date)} day{calculateDaysUntilDate(birthday.date) === 1 ? "" : "s"} ({calculatePercent(birthday.date).toFixed(2)}%)
									</p>
								)}
							</div>
							<div className="h-4 overflow-hidden rounded-full border border-viola-300 bg-viola-50">
								<div className="h-full bg-viola-400" style={{ width: `${calculatePercent(birthday.date)}%` }}></div>
							</div>
						</div>
					))}
				</div>
			</div>
		</>
	);
}
