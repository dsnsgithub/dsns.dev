/* eslint-disable @next/next/no-img-element */
const { useState } = require("react");

import { FormEvent } from "react";
import database from "./db/marketDB.json";
import CustomTags from "./components/CustomTags";

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

	return results.slice(0, 5);
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
			<div className="bg-lochmara-100 p-4 rounded-lg shadow-lg border-lochmara-300 border-2 relative flex flex-col lg:flex-row justify-between">
				<div className="lg:w-1/2">
					<h3 className="text-lg font-bold">{props.result.contents.name}</h3>
					{props["result"]["contents"]["description"] ? <p className="mb-4">{props["result"]["contents"]["description"]}</p> : <p className="mb-2">No description provided.</p>}
					<div className="flex items-center text-sm flex-wrap">
						<div className="rounded-xl bg-lochmara-600 text-white p-2 md:mb-3 lg:mb-0">
							{props["result"]["contents"]["pricePerOunce"].toLocaleString("en-US", {
								style: "currency",
								currency: "USD"
							})}
							/oz
						</div>
						{props["result"]["contents"]["nutritionPercentage"] ? (
							<>
								{/* <div className="rounded-xl bg-orange-600 text-white p-2 ml-2 md:mb-3 lg:mb-0">{props["result"]["contents"]["caloriesPer100G"]} cal/100g</div> */}
								<div className="rounded-xl bg-green-600 text-white p-2 ml-2 md:mb-3 lg:mb-0">Carbs: {props["result"]["contents"]["nutritionPercentage"]["carbs"]}%</div>
								<div className="rounded-xl bg-yellow-600 text-white p-2 ml-2 md:mb-3 lg:mb-0">Fat: {props["result"]["contents"]["nutritionPercentage"]["fat"]}%</div>
								<div className="rounded-xl bg-red-600 text-white p-2 ml-2 md:mb-3 lg:mb-0">Protein: {props["result"]["contents"]["nutritionPercentage"]["protein"]}%</div>
							</>
						) : (
							<></>
						)}
					</div>
				</div>

				{props["result"]["contents"]["imageURL"] ? (
					<img src={props["result"]["contents"]["imageURL"]} alt={props.result.contents.name} className="mb-4 rounded-lg lg:mb-0 lg:ml-4 lg:w-72 lg:h-72" />
				) : (
					<></>
				)}
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
		<div className="lg:p-8 p-4 shadow-xl rounded-xl bg-lochmara-200 m-2 mt-8 lg:m-8">
			<h1 className="text-3xl font-semibold mb-4">Generic Supermarket Database</h1>
			<CustomTags title="Market DB" description="Explore a wide range of products and their prices."></CustomTags>

			<div className="p-4 rounded-lg mt-4 mb-4 shadow-xl border-2 border-lochmara-300 bg-lochmara-100">
				<h2>Explore a wide range of products and their prices.</h2>
				<h2>
					Using a web-scraped DB from{" "}
					<a href="https://cooklist.com/products/browse" className="text-lochmara-500 underline">
						CookList
					</a>
					.
				</h2>

				<h2 className="text-lg mt-4">Statistics</h2>
				<ul className="list-disc list-inside">
					<li>{analysis.itemCount} items</li>
					<li>
						Lowest cost item by weight: {analysis.lowestCostItem} at{" "}
						{analysis.lowestCost.toLocaleString("en-US", {
							style: "currency",
							currency: "USD"
						})}
						/oz
					</li>
					<li>
						Highest cost item by weight: {analysis.highestCostItem} at{" "}
						{analysis.highestCost.toLocaleString("en-US", {
							style: "currency",
							currency: "USD"
						})}
						/oz
					</li>
					{/* <li>
						Least Calories Per 100g: {analysis.lowestCalPerKgItem} at {analysis.lowestCalPerKg} cal/100G
					</li>
					<li>
						Highest cost item by weight: {analysis.highestCalPerKgItem} at {analysis.highestCalPerKg} cal/100G
					</li> */}
				</ul>
			</div>

			<div className="mb-4">
				<input
					type="text"
					id="inputBox"
					placeholder="Search..."
					onInput={(e) => {
						handleInput(e, setResults);
					}}
					className="px-6 py-4 border rounded-lg focus:outline-none focus:border-lochmara-500 w-full text-xl"
				></input>
			</div>

			<div id="results" className="grid grid-cols-1 gap-4">
				{results}
			</div>
		</div>
	);
}
