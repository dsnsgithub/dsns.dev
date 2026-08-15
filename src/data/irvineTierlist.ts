// Irvine + UCI Asian food tier list dataset.
//
// Sources: official center directories (Diamond Jamboree, Irvine Company Retail,
// The Market Place, Trade Marketplace), UCI Dining, and current listings as of
// August 2026. Permanently closed spots (Tokyo Table, Yushoken, Gyutan Ramen,
// Poke Kai, Asian Tapas, Zion Mart on University Dr) are intentionally omitted.
//
// IMPORTANT: append new places to the END of this array. Share links encode a
// place by its index, so reordering would scramble existing links.

export interface Place {
	name: string;
	cat: CategoryId;
	loc: string;
	note?: string;
	/** Opened (or reopened) recently — renders a NEW badge. */
	fresh?: boolean;
}

export type CategoryId = "chinese" | "hotpot" | "japanese" | "korean" | "viet" | "thai" | "taiwanese" | "indian" | "fusion" | "dessert" | "boba" | "bakery" | "campus" | "market";

export interface Category {
	id: CategoryId;
	label: string;
	emoji: string;
	color: string;
}

export const CATEGORIES: Category[] = [
	{ id: "chinese", label: "Chinese", emoji: "🥟", color: "#d8474c" },
	{ id: "hotpot", label: "Hot Pot & Malatang", emoji: "🍲", color: "#e2703a" },
	{ id: "japanese", label: "Japanese", emoji: "🍣", color: "#e08fa8" },
	{ id: "korean", label: "Korean", emoji: "🍖", color: "#c0567f" },
	{ id: "viet", label: "Vietnamese", emoji: "🍜", color: "#3f9e79" },
	{ id: "thai", label: "Thai", emoji: "🌶️", color: "#7aa63c" },
	{ id: "taiwanese", label: "Taiwanese", emoji: "🧋", color: "#3f8fb0" },
	{ id: "indian", label: "Indian & South Asian", emoji: "🍛", color: "#d99a1f" },
	{ id: "fusion", label: "Asian Fusion & Seafood", emoji: "🥢", color: "#8a6bbf" },
	{ id: "dessert", label: "Asian Desserts", emoji: "🍧", color: "#e2679b" },
	{ id: "boba", label: "Boba & Tea", emoji: "🥤", color: "#6f7fd4" },
	{ id: "bakery", label: "Bakeries & Cafés", emoji: "🥐", color: "#b07c4f" },
	{ id: "campus", label: "On UCI Campus", emoji: "🐜", color: "#2f6fae" },
	{ id: "market", label: "Asian Markets & Food Courts", emoji: "🛒", color: "#5e8a5e" }
];

export const TIERS = [
	{ id: "S", label: "S", color: "#ff7d8a" },
	{ id: "A", label: "A", color: "#ffa66b" },
	{ id: "B", label: "B", color: "#ffd166" },
	{ id: "C", label: "C", color: "#a8d98a" },
	{ id: "D", label: "D", color: "#7fc3e8" },
	{ id: "F", label: "F", color: "#bda6dd" }
];

export const LAST_UPDATED = "August 2026";

export const PLACES: Place[] = [
	// ── Diamond Jamboree (2700–2750 Alton Pkwy) ────────────────────────────────
	{ name: "BCD Tofu House", cat: "korean", loc: "Diamond Jamboree", note: "24hr-ish sundubu institution" },
	{ name: "Yi-Gah Korean Cuisine", cat: "korean", loc: "Diamond Jamboree", note: "Korean BBQ + banchan" },
	{ name: "BBQ Chicken", cat: "korean", loc: "Diamond Jamboree", note: "Korean fried chicken" },
	{ name: "Young Dabang", cat: "korean", loc: "Diamond Jamboree", note: "Korean street food & cafe" },
	{ name: "SomiSomi", cat: "dessert", loc: "Diamond Jamboree", note: "Ah-boong taiyaki soft serve" },
	{ name: "Sul & Beans", cat: "dessert", loc: "Diamond Jamboree", note: "Bingsu" },
	{ name: "Meet Fresh", cat: "dessert", loc: "Diamond Jamboree", note: "Taro balls, grass jelly" },
	{ name: "85°C Bakery Café", cat: "bakery", loc: "Diamond Jamboree & Spectrum", note: "Sea salt coffee" },
	{ name: "Sunright Tea Studio", cat: "boba", loc: "Diamond Jamboree & Jeffrey Rd", note: "Brûléed cheese foam" },
	{ name: "7 Leaves Cafe", cat: "boba", loc: "Diamond Jamboree", note: "Vietnamese coffee & house teas" },
	{ name: "Haidilao Hot Pot", cat: "hotpot", loc: "Diamond Jamboree", note: "Noodle dance, free everything" },
	{ name: "Chubby Cattle", cat: "hotpot", loc: "Diamond Jamboree", note: "Conveyor-belt hot pot" },
	{ name: "Tim Ho Wan", cat: "chinese", loc: "Diamond Jamboree", note: "BBQ pork buns, dim sum" },
	{ name: "Dun Huang", cat: "chinese", loc: "Diamond Jamboree", note: "Northwestern hand-pulled noodles" },
	{ name: "Kura Revolving Sushi Bar", cat: "japanese", loc: "Diamond Jamboree", note: "Conveyor sushi + prize gacha" },
	{ name: "Marugame Udon", cat: "japanese", loc: "Diamond Jamboree", note: "Udon + tempura line" },
	{ name: "Pepper Lunch", cat: "japanese", loc: "Diamond Jamboree & Spectrum", note: "Sizzling beef pepper rice" },
	{ name: "CoCo Ichibanya", cat: "japanese", loc: "Diamond Jamboree", note: "Japanese curry, pick your spice" },
	{ name: "Pho Saigon Pearl", cat: "viet", loc: "Diamond Jamboree", note: "Pho & rice plates" },
	{ name: "The Kickin' Crab", cat: "fusion", loc: "Diamond Jamboree", note: "Cajun seafood boil" },
	{ name: "H Mart", cat: "market", loc: "Diamond Jamboree & Northpark", note: "Korean grocery + food stalls" },

	// ── Irvine Spectrum Center ─────────────────────────────────────────────────
	{ name: "Din Tai Fung", cat: "chinese", loc: "Irvine Spectrum", note: "XLB — opened March 2026", fresh: true },
	{ name: "Capital Seafood", cat: "chinese", loc: "Irvine Spectrum", note: "Dim sum & live seafood" },
	{ name: "Le Shrimp Noodle Bar", cat: "chinese", loc: "Irvine Spectrum", note: "Shrimp noodles from Paradise Group" },
	{ name: "Kalbi Social Club", cat: "korean", loc: "Irvine Spectrum", note: "Modern Korean BBQ", fresh: true },
	{ name: "J&G Fried Chicken", cat: "korean", loc: "Irvine Spectrum", note: "First OC location", fresh: true },
	{ name: "Robata Wasa", cat: "japanese", loc: "Irvine Spectrum", note: "Robata grill & sushi" },
	{ name: "Manaao Thai Comfort Food", cat: "thai", loc: "Irvine Spectrum", note: "Newest Thai arrival", fresh: true },
	{ name: "The Alley", cat: "boba", loc: "Irvine Spectrum", note: "Deerioca brown sugar" },
	{ name: "Hello Kitty Cafe", cat: "dessert", loc: "Irvine Spectrum", note: "Bow-shaped everything" },
	{ name: "Honey & Butter Macarons", cat: "dessert", loc: "Irvine Spectrum", note: "Character macarons" },
	{ name: "Blk Dot Coffee", cat: "bakery", loc: "Irvine Spectrum", note: "Vietnamese-style coffee" },
	{ name: "P.F. Chang's", cat: "chinese", loc: "Irvine Spectrum", note: "Lettuce wraps, obviously" },

	// ── The Market Place (Irvine / Tustin) ─────────────────────────────────────
	{ name: "EverSpring Modern Chinese", cat: "chinese", loc: "The Market Place", note: "Fast-casual Chinese classics" },
	{ name: "JA Jiaozi Authentic Dumplings", cat: "chinese", loc: "The Market Place", note: "Handmade dumplings" },
	{ name: "Class 302 Tea Cafe", cat: "taiwanese", loc: "The Market Place", note: "Shaved ice + school-desk seating" },
	{ name: "399 Vietnamese Kitchen", cat: "viet", loc: "The Market Place", note: "Pho & bun bo hue" },
	{ name: "I Can Barbecue Korean Grill", cat: "korean", loc: "Oak Creek & The Market Place", note: "AYCE KBBQ" },
	{ name: "Happy Lemon", cat: "boba", loc: "The Market Place", note: "Rock salt cheese tea" },
	{ name: "BenGong's Tea", cat: "boba", loc: "The Market Place", note: "Fruit teas" },
	{ name: "Flame Broiler", cat: "fusion", loc: "The Market Place", note: "The bowl. You know the bowl." },

	// ── Northpark Plaza & Irvine Blvd / Jeffrey ────────────────────────────────
	{ name: "Chai Lan", cat: "chinese", loc: "Northpark Plaza", note: "Korean-Chinese jjajang & jjamppong" },
	{ name: "SUP Noodle Bar", cat: "viet", loc: "Northpark Plaza", note: "Pho & garlic noodles" },
	{ name: "Nep Cafe by Kei Concepts", cat: "viet", loc: "Northpark Plaza", note: "Vietnamese brunch" },
	{ name: "Kiyo Sushi & Sake", cat: "japanese", loc: "Northpark Plaza", note: "Neighborhood sushi bar" },
	{ name: "Hako", cat: "japanese", loc: "Northpark area", note: "Japanese comfort plates" },
	{ name: "Tang N Tang", cat: "korean", loc: "Northpark area", note: "Korean fried chicken" },
	{ name: "Noodle St", cat: "chinese", loc: "Northpark area", note: "Noodles & small plates" },
	{ name: "Boba Story", cat: "boba", loc: "Northpark area" },
	{ name: "UG Tea", cat: "boba", loc: "Northpark area" },

	// ── Zion Market plaza (4800 Irvine Blvd) ───────────────────────────────────
	{ name: "Zion Market", cat: "market", loc: "4800 Irvine Blvd", note: "Korean grocery + prepared food" },
	{ name: "Paik's Noodle", cat: "korean", loc: "Zion Market plaza", note: "Jjamppong & noodles" },
	{ name: "Two Dak Two Dak", cat: "korean", loc: "Zion Market plaza", note: "Korean wings" },
	{ name: "Dada Shabu Shabu", cat: "hotpot", loc: "Zion Market plaza" },
	{ name: "Seoul Haus", cat: "korean", loc: "Zion Market plaza", note: "Korean soups & fusion" },
	{ name: "Hong Kong Banjum", cat: "chinese", loc: "Zion Market plaza", note: "Korean-Chinese" },

	// ── Culver Dr: Culver Plaza / Heritage Plaza / Walnut Village ──────────────
	{ name: "Mitsuwa Marketplace", cat: "market", loc: "14230 Culver Dr", note: "Japanese grocery + food court" },
	{ name: "Santouka Ramen", cat: "japanese", loc: "Mitsuwa, Culver Dr", note: "Shio tonkotsu" },
	{ name: "Hamadaya Bakery", cat: "bakery", loc: "Mitsuwa, Culver Dr", note: "Japanese bread & pastries" },
	{ name: "Kaju Soft Tofu", cat: "korean", loc: "14370 Culver Dr", note: "Sundubu + combo BBQ" },
	{ name: "All That Barbecue", cat: "korean", loc: "Culver Plaza", note: "KBBQ" },
	{ name: "Boiling Point", cat: "taiwanese", loc: "Heritage Plaza, Culver Dr", note: "Personal hot pots" },
	{ name: "99 Ranch Market", cat: "market", loc: "Culver Plaza", note: "Chinese grocery + deli" },
	{ name: "J.J. Bakery", cat: "bakery", loc: "Culver Plaza", note: "Taiwanese buns & cakes" },
	{ name: "Junbi Matcha & Tea", cat: "boba", loc: "Culver Plaza", note: "Matcha & hojicha lattes" },
	{ name: "Home Baking Day", cat: "dessert", loc: "Culver Plaza" },
	{ name: "Guppy House", cat: "taiwanese", loc: "Culver Dr", note: "Late-night Taiwanese + shaved snow" },
	{ name: "Gurume Sushi", cat: "japanese", loc: "Walnut Village Center", note: "Value sushi" },
	{ name: "Paris Baguette", cat: "bakery", loc: "Culver Dr", note: "Korean-French bakery" },
	{ name: "Chengdu Taste", cat: "chinese", loc: "Culver Dr", note: "Sichuan, toothpick lamb" },
	{ name: "Ji Rong Peking Duck", cat: "chinese", loc: "Culver Dr", note: "Whole roast duck" },
	{ name: "Little Sheep Mongolian Hot Pot", cat: "hotpot", loc: "Culver Dr", note: "Herbal broth" },
	{ name: "Tasty Pot", cat: "hotpot", loc: "Culver Dr", note: "Taiwanese personal pots" },

	// ── Alton Square / Alton Pkwy ──────────────────────────────────────────────
	{ name: "Bopomofo Cafe", cat: "taiwanese", loc: "Alton Square", note: "Popcorn chicken & tea" },
	{ name: "Crazy Rock'N Sushi", cat: "japanese", loc: "Alton Square", note: "AYCE sushi" },
	{ name: "Hui Lau Shan", cat: "dessert", loc: "Alton Square", note: "HK mango dessert" },
	{ name: "HN Tea", cat: "boba", loc: "Alton Retail Center" },
	{ name: "OMOMO Tea Shoppe", cat: "boba", loc: "5365 Alton Pkwy", note: "Matcha swirl, sea salt cream" },

	// ── Woodbury / Northwood / Woodbridge / Cypress Village ────────────────────
	{ name: "One Zo Boba", cat: "boba", loc: "Woodbury Town Center", note: "Handmade taro & sesame boba" },
	{ name: "Shin-Sen-Gumi Yakitori", cat: "japanese", loc: "Woodbury Town Center", note: "Skewers & hakata ramen" },
	{ name: "Niko Niko Sushi", cat: "japanese", loc: "Woodbury Town Center" },
	{ name: "dPot", cat: "hotpot", loc: "Woodbridge Village Center", note: "Hot pot from Ding Tai" },
	{ name: "Cha For Tea", cat: "boba", loc: "University Center & Woodbridge", note: "Ten Ren tea house" },
	{ name: "Bag of Cakes", cat: "dessert", loc: "Cypress Village", note: "Asian-style cakes" },
	{ name: "Kiyoraka", cat: "dessert", loc: "Parkview Center", note: "Japanese sweets" },

	// ── Trade Marketplace & Food Hall (2222 Michelson) ─────────────────────────
	{ name: "HiroNori Craft Ramen", cat: "japanese", loc: "Trade Marketplace", note: "Tonkotsu + tsukemen" },
	{ name: "Ootoro Sushi", cat: "japanese", loc: "Trade Marketplace", note: "Omakase & rolls" },
	{ name: "Rice Bunn", cat: "japanese", loc: "Trade Food Hall", note: "Onigiri & Japanese sweets" },
	{ name: "Tuk Tuk Thai Street Food", cat: "thai", loc: "Trade Food Hall" },
	{ name: "Sen Thai Noodle Bar", cat: "thai", loc: "Trade Food Hall", note: "Hainan chicken & soups" },
	{ name: "Bao Chick", cat: "chinese", loc: "Trade Food Hall", note: "Chinese-American bao" },
	{ name: "Presotea", cat: "boba", loc: "Trade Food Hall", note: "Brewed-to-order tea" },

	// ── University Center (4100–4255 Campus Dr) — walkable from UCI ────────────
	{ name: "Northern Cafe Noodle House", cat: "chinese", loc: "University Center", note: "Beef roll, soup dumplings" },
	{ name: "Mad Dumplings", cat: "chinese", loc: "University Center" },
	{ name: "Karē Japanese Curry", cat: "japanese", loc: "University Center", note: "Katsu curry" },
	{ name: "Tenori", cat: "japanese", loc: "University Center", note: "Rice bowls" },
	{ name: "Iro Sushi Stuff X Roll", cat: "japanese", loc: "University Center", note: "Stuffed rolls" },
	{ name: "Temakira", cat: "japanese", loc: "University Center", note: "Hand roll shop" },
	{ name: "California Gogi Grill", cat: "korean", loc: "University Center", note: "Korean bowls & burritos" },
	{ name: "Poki Bowl", cat: "fusion", loc: "5323 University Dr", note: "Poke, right by campus" },

	// ── On campus (UCI) ───────────────────────────────────────────────────────
	{ name: "The Anteatery", cat: "campus", loc: "Mesa Court, UCI", note: "Dining hall" },
	{ name: "Brandywine", cat: "campus", loc: "Middle Earth, UCI", note: "Dining hall" },
	{ name: "Pippin Commons", cat: "campus", loc: "Middle Earth, UCI", note: "Dining hall" },
	{ name: "Panda Express (UCI)", cat: "campus", loc: "Student Center West Food Court" },
	{ name: "Bento Sushi (UCI)", cat: "campus", loc: "Student Center East Food Court" },
	{ name: "Planteatery", cat: "campus", loc: "Student Center East Food Court", note: "Plant-based" },

	// ── Irvine Business Complex / Park Place / Michelson / Barranca ────────────
	{ name: "YGF Malatang", cat: "hotpot", loc: "2626 Dupont Dr", note: "Build-your-own malatang, open late" },
	{ name: "Izakaya Osen", cat: "japanese", loc: "Centerview at Irvine Concourse", note: "New izakaya", fresh: true },
	{ name: "Rise Bagels", cat: "bakery", loc: "Centerview at Irvine Concourse", note: "Japanese-inspired bagels", fresh: true },
	{ name: "Marufuku Ramen", cat: "japanese", loc: "Irvine", note: "Hakata tonkotsu" },
	{ name: "Moobongri", cat: "korean", loc: "Barranca Pkwy", note: "Korean comfort food" },
	{ name: "Capital Noodle Bar", cat: "chinese", loc: "Crossroads, Irvine" },

	// ── Citywide / other plazas ───────────────────────────────────────────────
	{ name: "A & J Restaurant", cat: "chinese", loc: "Irvine", note: "Spicy wontons, beef noodle soup" },
	{ name: "Qin West Noodle", cat: "chinese", loc: "Irvine", note: "Hand-pulled spicy lamb noodles" },
	{ name: "Tsurukawa Udon", cat: "japanese", loc: "Irvine", note: "Sanuki udon" },
	{ name: "Gyu-Kaku", cat: "japanese", loc: "Irvine", note: "Japanese BBQ" },
	{ name: "Nana San", cat: "japanese", loc: "Irvine", note: "Sushi & Japanese dining" },
	{ name: "Hanuman Thai Eatery", cat: "thai", loc: "Irvine" },
	{ name: "Kinaree Eatery", cat: "thai", loc: "Irvine" },
	{ name: "Saiga Vietnamese Eatery", cat: "viet", loc: "Irvine" },
	{ name: "Yonny", cat: "fusion", loc: "Irvine", note: "Modern Asian" },
	{ name: "MooMoo Hot Pot", cat: "hotpot", loc: "Irvine" },
	{ name: "Panda Express", cat: "chinese", loc: "Culver Plaza & citywide", note: "Orange chicken benchmark" },

	// ── Desserts ──────────────────────────────────────────────────────────────
	{ name: "Chewie & Mellow", cat: "dessert", loc: "Irvine", note: "Mochi & marshmallow treats" },
	{ name: "Che Vi", cat: "dessert", loc: "Irvine", note: "Vietnamese chè" },
	{ name: "Heybings", cat: "dessert", loc: "Irvine", note: "Korean bingsu" },
	{ name: "Mochinut", cat: "dessert", loc: "Irvine", note: "Mochi donuts & corn dogs" },
	{ name: "Afters Ice Cream", cat: "dessert", loc: "Irvine", note: "Milky bun" },

	// ── Boba & tea ────────────────────────────────────────────────────────────
	{ name: "Heytea", cat: "boba", loc: "Irvine", note: "Cheese-topped fruit teas" },
	{ name: "Auntea Jenny", cat: "boba", loc: "Irvine" },
	{ name: "TP Tea", cat: "boba", loc: "Irvine", note: "Taiwanese classic" },
	{ name: "Jam Jam Tea Lab", cat: "boba", loc: "Irvine" },
	{ name: "Desouro", cat: "boba", loc: "Irvine" },
	{ name: "Macu Tea", cat: "boba", loc: "Irvine" },
	{ name: "Tastea", cat: "boba", loc: "Irvine" },
	{ name: "Ding Tea", cat: "boba", loc: "Irvine" },
	{ name: "Sharetea", cat: "boba", loc: "Irvine" },

	// ── Indian & South Asian ──────────────────────────────────────────────────
	{ name: "India Kitchen", cat: "indian", loc: "Irvine" },
	{ name: "Annapoorna Indian Cuisine", cat: "indian", loc: "Irvine", note: "South Indian, dosas" },
	{ name: "India Gate Restaurant", cat: "indian", loc: "Irvine" },
	{ name: "Moti Mahal", cat: "indian", loc: "Irvine" },
	{ name: "Masala Bae", cat: "indian", loc: "Irvine" },
	{ name: "Southern Spice", cat: "indian", loc: "Irvine" },
	{ name: "Masala Waves", cat: "indian", loc: "Irvine" },
	{ name: "Maast Indian", cat: "indian", loc: "Irvine" },
	{ name: "Biryani Pot Express", cat: "indian", loc: "Irvine" },
	{ name: "Sattva Indian Rasoi", cat: "indian", loc: "Irvine" },
	{ name: "Natraj's Tandoori", cat: "indian", loc: "Irvine" },
	{ name: "Punjabi Tandoor", cat: "indian", loc: "Irvine" }
];
