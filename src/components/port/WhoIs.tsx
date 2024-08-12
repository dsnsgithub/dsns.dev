import { useEffect, useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";

function camelCaseToTitleCase(input: string): string {
	return (
		input
			// Insert a space before each uppercase letter
			.replace(/([A-Z])/g, " $1")
			// Capitalize the first letter of each word
			.replace(/^./, (str) => str.toUpperCase())
			// Trim any leading spaces (if the first character is uppercase)
			.trim()
	);
}

export default function WhoIs() {
	const [domain, setDomain] = useState("");
	const [results, setResults] = useState<JSX.Element[]>();
	const [parent] = useAutoAnimate();

	async function handleInput() {
		try {
			const response = await fetch(`/api/whois/${domain}`);
			const data = await response.json();

			const final = [];
			for (const key in data) {
				final.push(
					<p key={key}>
						<b>{camelCaseToTitleCase(key)}: </b> {data[key]}
					</p>
				);
			}

			setResults(final);
		} catch (error) {
			console.error("Error fetching WHOIS data:", error);
		}
	}

	useEffect(() => {
		setTimeout(() => {
			window.scrollTo(0, 0);
		}, 100);
	});

	return (
		<div>
			<div className="lg:p-8 p-4 shadow-xl rounded-xl bg-viola-100">
				<div className="mb-4">
					<h1 className="text-3xl font-semibold">WHOIS Lookup</h1>
					<h2>A WHOIS search without censorship.</h2>
				</div>

				<div className="mb-4 flex flex-row">
					<input
						type="text"
						id="inputBox"
						placeholder="Search..."
						className="px-6 py-4 border rounded-lg focus:outline-none focus:border-viola-500 text-xl flex-grow w-5/6"
						onInput={(e) => setDomain((e.target as HTMLInputElement).value)}
						onKeyDown={(e) => e.key === "Enter" && handleInput()}
					></input>
					<button className="p-5 shadow-xl bg-viola-200 border-2 border-viola-300 rounded-xl ml-4 flex flex-row items-center" onClick={() => handleInput()}>
						Lookup
					</button>
				</div>

				<div ref={parent}>
					{(results?.length || 0) > 1 ? (
						<div className="bg-viola-100 border-2 border-viola-300 p-4 rounded-xl">{results}</div>
					) : (results?.length || 0) == 1 ? (
						<div className="bg-viola-100 border-2 border-viola-300 p-4 rounded-xl text-center">
							<h2 className="text-2xl text-red-500">Invalid domain name. Please try again.</h2>
						</div>
					) : (
						<></>
					)}
				</div>
			</div>
		</div>
	);
}
