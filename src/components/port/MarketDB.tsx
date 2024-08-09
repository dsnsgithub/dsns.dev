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
			<div className="bg-viola-50 p-6 rounded-lg shadow-lg relative flex flex-col lg:flex-row justify-around items-center gap-4">
				<div className="lg:w-1/2">
					<h3 className="text-lg font-bold">{props.result.contents.name}</h3>
					{props["result"]["contents"]["description"] ? (
						<p className="mb-4 h-32">{props["result"]["contents"]["description"].split(".")[0] + "."}</p>
					) : (
						<p className="mb-2 h-32">No description provided.</p>
					)}
					<div className="grid grid-cols-2 items-center text-xs gap-1">
						<div className="rounded-lg bg-viola-500 text-white p-2">
							{props["result"]["contents"]["pricePerOunce"].toLocaleString("en-US", {
								style: "currency",
								currency: "USD"
							})}
							/oz
						</div>
						{props["result"]["contents"]["nutritionPercentage"] ? (
							<>
								{/* <div className="rounded-xl bg-orange-600 text-white p-2 ml-2 md:mb-3 lg:mb-0">{props["result"]["contents"]["caloriesPer100G"]} cal/100g</div> */}
								<div className="rounded-lg bg-green-500 text-white p-2">Carbs: {props["result"]["contents"]["nutritionPercentage"]["carbs"]}%</div>
								<div className="rounded-lg bg-yellow-500 text-white p-2">Fat: {props["result"]["contents"]["nutritionPercentage"]["fat"]}%</div>
								<div className="rounded-lg bg-red-500 text-white p-2">Protein: {props["result"]["contents"]["nutritionPercentage"]["protein"]}%</div>
							</>
						) : (
							<></>
						)}
					</div>
				</div>

				{props["result"]["contents"]["imageURL"] ? <img src={props["result"]["contents"]["imageURL"]} alt={props.result.contents.name} className="rounded-lg w-48 h-48" /> : <></>}
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
		<div className="lg:p-8 p-4 shadow-xl rounded-xl bg-viola-100">
			<h1 className="text-3xl font-semibold mb-4">Generic Supermarket Database</h1>

			<div className="p-5 rounded-lg mt-4 mb-4 shadow-xl bg-viola-50">
				<h2>Explore a wide range of products and their prices.</h2>
				<h2>
					Using a web-scraped DB from{" "}
					<a href="https://cooklist.com/products/browse" className="text-viola-500 underline">
						CookList
					</a>
					.
				</h2>

				<div className="flex flex-row gap-4 flex-wrap mt-4">
					<div className="p-2 px-4 rounded-xl bg-viola-200 flex justify-center items-center">
						<span className="font-bold mr-1">{analysis.itemCount}</span> items
					</div>
					<div className="p-2 px-4 rounded-xl bg-viola-200 text-center">
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
					<div className="p-2 px-4 rounded-xl bg-viola-200 text-center">
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
					className="px-6 py-4 border rounded-lg focus:outline-none focus:border-viola-500 w-full text-xl"
				></input>
			</div>

			<div id="results" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{results}
			</div>
		</div>
	);
}
