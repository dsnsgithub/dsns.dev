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

export default function WhoIs({ children }: { children: JSX.Element }) {
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
			<div className="rounded-xl bg-viola-100 p-4 shadow-xl lg:p-8">
				<div className="mb-4">
					<h1 className="text-3xl font-semibold">WHOIS Lookup</h1>
					<h2>A WHOIS search without censorship.</h2>
				</div>

				<div className="mb-4 flex flex-row">
					<input
						type="text"
						id="inputBox"
						placeholder="Search..."
						className="w-5/6 flex-grow rounded-lg border px-6 py-4 text-xl focus:border-viola-500 focus:outline-none"
						onInput={(e) => setDomain((e.target as HTMLInputElement).value)}
						onKeyDown={(e) => e.key === "Enter" && handleInput()}
					></input>
					<button className="ml-4 flex flex-row items-center rounded-xl border-2 border-viola-300 bg-viola-200 p-5 shadow-xl" onClick={() => handleInput()}>
						{children}
						<div className="hidden md:block">Lookup</div>
					</button>
				</div>

				<div ref={parent}>
					{(results?.length || 0) > 1 ? (
						<div className="overflow-scroll rounded-xl border-2 border-viola-300 bg-viola-100 p-4">{results}</div>
					) : (results?.length || 0) == 1 ? (
						<div className="rounded-xl border-2 border-viola-300 bg-viola-100 p-4 text-center">
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
