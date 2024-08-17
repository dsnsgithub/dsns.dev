/** @type {import("prettier").Config} */
export default {
	tabWidth: 4,
	useTabs: true,
	printWidth: 200,
	trailingComma: "none",
	plugins: ["prettier-plugin-astro", "prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
	overrides: [
		{
			files: "*.astro",
			options: {
				parser: "astro"
			}
		},
		{
			files: "*.svelte",
			options: {
				parser: "svelte"
			}
		}
	]
};
