/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

import type { FormEvent } from "react";
import database from "../../assets/marketDB.json";

function searchProducts(searchTerm: string, database: any) {
	const results = [];

	for (const category in database) {
		for (const subCategory in database[category]) {
			for (const product in database[category][subCategory]) {
				const relevance = calculateRelevance(product, searchTerm);
				if (relevance == 0) continue;

				results.push({
					product: product,
					relevance: relevance,
					contents: database[category][subCategory][product],
					url: `https://cooklist.com/products/${category}/${subCategory}/${product}`
				});
			}
		}
	}

	results.sort((a, b) => b.relevance - a.relevance);

	return results.slice(0, 8);
}

function calculateRelevance(product: string, searchTerm: string) {
	const regex = new RegExp(searchTerm, "gi");
	let matches = ((product.replace(/-/g, "") + product.replace(/-/g, " ")).match(regex) || []).length;

	if (matches > 0) {
		matches = matches / product.length;
	}

	return matches;
}

function analyzeItems(database: any) {
	let count = 0;
	let lowestCostItem = "";
	let highestCostItem = "";
	let lowestCost = Number.MAX_VALUE;
	let highestCost = Number.MIN_VALUE;

	let lowestCalPerKgItem = "";
	let highestCalPerKgItem = "";
	let lowestCalPerKg = Number.MAX_VALUE;
	let highestCalPerKg = Number.MIN_VALUE;

	for (const category in database) {
		for (const subCategory in database[category]) {
			for (const product in database[category][subCategory]) {
				count++;

				const name = database[category][subCategory][product].name;
				const cost = database[category][subCategory][product].pricePerOunce;
				if (cost < lowestCost) {
					lowestCost = cost;
					lowestCostItem = name;
				}
				if (cost > highestCost) {
					highestCost = cost;
					highestCostItem = name;
				}

				let caloriesPer100G = database[category][subCategory][product].caloriesPer100G;
				if (caloriesPer100G < lowestCalPerKg) {
					lowestCalPerKgItem = name;
					lowestCalPerKg = database[category][subCategory][product].caloriesPer100G;
				}
				if (caloriesPer100G > highestCalPerKg) {
					highestCalPerKgItem = name;
					highestCalPerKg = database[category][subCategory][product].caloriesPer100G;
				}
			}
		}
	}

	return {
		itemCount: count,
		lowestCost,
		lowestCostItem,
		highestCostItem,
		highestCost,
		lowestCalPerKg,
		lowestCalPerKgItem,
		highestCalPerKg,
		highestCalPerKgItem
	};
}

function Product(props: {
	result: {
		product: string;
		relevance: number;
		contents: {
			name: string;
			description: string;
			pricePerOunce: number;
			caloriesPer100G: number;
			nutritionPercentage: {
				carbs: number;
				fat: number;
				protein: number;
			};
			imageURL: string;
		};
		url: string;
	};
}) {
	return (
		<a href={props.result.url} target="_blank">
			<div className="relative flex flex-col items-center justify-around gap-4 rounded-lg bg-viola-50 p-6 shadow-lg lg:flex-row">
				<div className="flex h-56 flex-col gap-4 lg:w-1/2">
					<h3 className="text-lg font-bold">{props.result.contents.name}</h3>
					{props["result"]["contents"]["description"] ? (
						<p className="line-clamp-4 overflow-ellipsis">{props["result"]["contents"]["description"].split(".")[0] + "."}</p>
					) : (
						<p className="h-32">No description provided.</p>
					)}

					<div className="grid grid-cols-2 items-center gap-1 text-xs">
						<div className="rounded-lg bg-viola-500 p-2 text-center text-white">
							{props["result"]["contents"]["pricePerOunce"].toLocaleString("en-US", {
								style: "currency",
								currency: "USD"
							})}
							/oz
						</div>
						{props["result"]["contents"]["nutritionPercentage"] ? (
							<>
								{/* <div className="rounded-xl bg-orange-600 text-white p-2 ml-2 md:mb-3 lg:mb-0">{props["result"]["contents"]["caloriesPer100G"]} cal/100g</div> */}
								<div className="rounded-lg bg-green-500 p-2 text-center text-white">Carbs: {props["result"]["contents"]["nutritionPercentage"]["carbs"]}%</div>
								<div className="rounded-lg bg-yellow-500 p-2 text-center text-white">Fat: {props["result"]["contents"]["nutritionPercentage"]["fat"]}%</div>
								<div className="rounded-lg bg-red-500 p-2 text-center text-white">Protein: {props["result"]["contents"]["nutritionPercentage"]["protein"]}%</div>
							</>
						) : (
							<></>
						)}
					</div>
				</div>

				{props["result"]["contents"]["imageURL"] ? <img src={props["result"]["contents"]["imageURL"]} alt={props.result.contents.name} className="h-48 w-48 rounded-lg" /> : <></>}
			</div>
		</a>
	);
}

function handleInput(e: FormEvent<HTMLInputElement>, setResults: Function) {
	const searchTerm = (e.target as HTMLInputElement).value;

	if (searchTerm == "") {
		setResults([]);
		return;
	}

	const searchResults = searchProducts(searchTerm, database);
	const currentResults: JSX.Element[] = [];

	for (const index in searchResults) {
		currentResults.push(<Product key={searchResults[index]["product"]} result={searchResults[index]}></Product>);
	}

	setResults(currentResults);
}

export default function FoodDB() {
	const [results, setResults] = useState([]);

	const analysis = analyzeItems(database);

	return (
		<div className="rounded-xl bg-viola-100 p-4 shadow-xl lg:p-8">
			<h1 className="mb-4 text-3xl font-semibold">Generic Supermarket Database</h1>

			<div className="mb-4 mt-4 rounded-lg bg-viola-50 p-5 shadow-xl">
				<h2>Explore a wide range of products and their prices.</h2>
				<h2>
					Using a web-scraped DB from{" "}
					<a href="https://cooklist.com/products/browse" className="text-viola-500 underline">
						CookList
					</a>
					.
				</h2>

				<div className="mt-4 flex flex-row flex-wrap gap-4">
					<div className="flex items-center justify-center rounded-xl bg-viola-200 p-2 px-4">
						<span className="mr-1 font-bold">{analysis.itemCount}</span> items
					</div>
					<div className="rounded-xl bg-viola-200 p-2 px-4 text-center">
						Cheapest item by weight:
						<div className="font-bold">
							{analysis.lowestCostItem} at{" "}
							{analysis.lowestCost.toLocaleString("en-US", {
								style: "currency",
								currency: "USD"
							})}
							/oz
						</div>
					</div>
					<div className="rounded-xl bg-viola-200 p-2 px-4 text-center">
						Most expensive item by weight:
						<div className="font-bold">
							{analysis.highestCostItem} at{" "}
							{analysis.highestCost.toLocaleString("en-US", {
								style: "currency",
								currency: "USD"
							})}
							/oz
						</div>
					</div>
				</div>
			</div>

			<div className="mb-4">
				<input
					type="text"
					id="inputBox"
					placeholder="Search..."
					onInput={(e) => {
						handleInput(e, setResults);
					}}
					className="w-full rounded-lg border px-6 py-4 text-xl focus:border-viola-500 focus:outline-none"
				></input>
			</div>

			<div id="results" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{results}
			</div>
		</div>
	);
}
