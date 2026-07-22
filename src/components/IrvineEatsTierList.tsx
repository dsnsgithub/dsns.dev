import { useState, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────
   IRVINE EATS — Asian Food, Boba & Dessert Tier List
   Interactive, drag-to-rank tier list for the Asian
   restaurants, boba shops and dessert spots in and
   around Irvine / UC Irvine. Rankings save locally.
   ───────────────────────────────────────────── */

interface Category {
	id: string;
	label: string;
	color: string;
}

interface Place {
	id: string;
	name: string;
	cat: string;
	area: string;
	r: number;
}

interface Tier {
	id: string;
	label: string;
	tag: string;
	color: string;
	ink: string;
}

const CATS: Category[] = [
	{ id: "boba", label: "Boba & Tea", color: "#C8956C" },
	{ id: "korean", label: "Korean", color: "#E36B5C" },
	{ id: "japanese", label: "Japanese & Ramen", color: "#E8949B" },
	{ id: "sushi", label: "Sushi", color: "#7FB3D5" },
	{ id: "chinese", label: "Chinese", color: "#E3B341" },
	{ id: "taiwanese", label: "Taiwanese", color: "#8FBF6B" },
	{ id: "viet", label: "Vietnamese", color: "#5FC9B5" },
	{ id: "thai", label: "Thai", color: "#B98DD6" },
	{ id: "hotpot", label: "Hot Pot, Grill & Boils", color: "#F08A5D" },
	{ id: "poke", label: "Poke & Hawaiian", color: "#EE6FA6" },
	{ id: "indian", label: "Indian", color: "#F0A93B" },
	{ id: "dessert", label: "Dessert & Bakery", color: "#D98BB8" }
];

const PLACES: Place[] = [
	// ── Boba & Tea
	{ id: "omomo", name: "Omomo Tea Shoppe", cat: "boba", area: "Heritage Plaza (Culver)", r: 4.3 },
	{ id: "sunright", name: "Sunright Tea Studio", cat: "boba", area: "Diamond Jamboree", r: 4.6 },
	{ id: "heytea", name: "HEYTEA", cat: "boba", area: "Walnut Village (Jeffrey)", r: 4.4 },
	{ id: "tptea-main", name: "TP Tea — Main St", cat: "boba", area: "Main St", r: 4.5 },
	{ id: "tptea-jeff", name: "TP Tea — Jeffrey", cat: "boba", area: "Arbor Village", r: 4.7 },
	{ id: "alley", name: "The Alley", cat: "boba", area: "Irvine Spectrum", r: 4.0 },
	{ id: "chafortea", name: "Cha For Tea", cat: "boba", area: "UTC · UCI", r: 4.3 },
	{ id: "sharetea", name: "Sharetea", cat: "boba", area: "UTC · UCI", r: 4.3 },
	{ id: "onezo", name: "One Zo (house-made pearls)", cat: "boba", area: "Northpark", r: 4.4 },
	{ id: "jamjam", name: "Jam Jam Tea Lab", cat: "boba", area: "Corporate Park", r: 4.6 },
	{ id: "teabydo", name: "TeaByDo 茶百道", cat: "boba", area: "Dupont Dr", r: 4.9 },
	{ id: "macu", name: "MACU Tea", cat: "boba", area: "Irvine Center Dr", r: 4.0 },
	{ id: "desouro", name: "Desouro", cat: "boba", area: "Culver Dr", r: 4.4 },
	{ id: "owly", name: "Owly Tea & Crepe", cat: "boba", area: "UTC · UCI", r: 4.8 },
	{ id: "wanpo", name: "Wanpo Tea Shop", cat: "boba", area: "Diamond Jamboree", r: 4.4 },
	{ id: "yifang", name: "Yifang Taiwan Fruit Tea", cat: "boba", area: "Culver Dr", r: 4.3 },
	{ id: "sevenleaves", name: "7 Leaves Cafe", cat: "boba", area: "Walnut Village", r: 4.5 },
	{ id: "cocofresh", name: "CoCo Fresh Tea & Juice", cat: "boba", area: "Campus Plaza · UCI", r: 4.2 },
	{ id: "gongcha", name: "Gong Cha", cat: "boba", area: "Alton Square", r: 4.3 },
	{ id: "dingtea", name: "Ding Tea", cat: "boba", area: "Northwood", r: 4.2 },
	{ id: "tigersugar", name: "Tiger Sugar", cat: "boba", area: "Diamond Jamboree", r: 4.3 },
	{ id: "tastea", name: "Tastea", cat: "boba", area: "Woodbury Town Center", r: 4.4 },
	{ id: "happylemon", name: "Happy Lemon", cat: "boba", area: "Northpark", r: 4.1 },
	{ id: "mixue", name: "Mixue", cat: "boba", area: "Culver Dr", r: 4.0 },
	{ id: "alittletea", name: "ALittle Tea", cat: "boba", area: "Diamond Jamboree", r: 4.5 },
	{ id: "machimachi", name: "Machi Machi", cat: "boba", area: "Irvine Spectrum", r: 4.2 },

	// ── Korean
	{ id: "baekjeong", name: "Baekjeong KBBQ", cat: "korean", area: "Culver Plaza", r: 4.3 },
	{ id: "kalbi", name: "Kalbi Social Club", cat: "korean", area: "Irvine Spectrum", r: 4.2 },
	{ id: "moobongri", name: "Moobongri Soondae", cat: "korean", area: "Stonecreek (Barranca)", r: 4.4 },
	{ id: "hanshin", name: "Hanshin Pocha", cat: "korean", area: "Quail Hill", r: 4.5 },
	{ id: "youngdabang", name: "Youngdabang (tteokbokki)", cat: "korean", area: "Alton Pkwy", r: 4.7 },
	{ id: "yukdaejang", name: "Yuk Dae Jang", cat: "korean", area: "Alton Square", r: 4.2 },
	{ id: "sogongdong", name: "So Gong Dong Tofu & BBQ", cat: "korean", area: "Irvine Center Dr", r: 4.5 },
	{ id: "bcd", name: "BCD Tofu House", cat: "korean", area: "Diamond Jamboree", r: 4.3 },
	{ id: "yigah", name: "Yigah", cat: "korean", area: "Diamond Jamboree", r: 4.2 },
	{ id: "tang190", name: "Tang 190", cat: "korean", area: "Cypress Village (Jeffrey)", r: 4.1 },
	{ id: "chd", name: "CHD Korean Dumplings", cat: "korean", area: "H Mart (Northpark)", r: 4.0 },
	{ id: "yupdduk", name: "Yup Dduk (tteokbokki)", cat: "korean", area: "Campus Dr · UCI", r: 4.4 },
	{ id: "furai", name: "Furai Chicken (KFC)", cat: "korean", area: "Yale Ave (Northwood)", r: 4.3 },
	{ id: "bbqchicken", name: "bb.q Chicken", cat: "korean", area: "Quail Hill + 2 more", r: 4.0 },
	{ id: "cmchicken", name: "CM Chicken", cat: "korean", area: "Zion Market (Northpark)", r: 4.4 },
	{ id: "yoosplace", name: "Yoo's Place", cat: "korean", area: "Culver Dr", r: 4.5 },
	{ id: "morangak", name: "Mo Ran Gak", cat: "korean", area: "Barranca Pkwy", r: 4.2 },
	{ id: "cheongdam", name: "Cheongdam Jokbal", cat: "korean", area: "Diamond Jamboree", r: 4.4 },
	{ id: "kyochon", name: "Kyochon Chicken", cat: "korean", area: "Diamond Jamboree", r: 4.2 },
	{ id: "itstofu", name: "Its Tofu Restaurant", cat: "korean", area: "Culver Plaza", r: 4.3 },

	// ── Japanese & Ramen
	{ id: "hironori", name: "HiroNori Craft Ramen", cat: "japanese", area: "Park Place (Michelson)", r: 4.6 },
	{ id: "marufuku", name: "Marufuku Ramen", cat: "japanese", area: "Los Olivos (Spectrum)", r: 4.5 },
	{ id: "hanabi", name: "Menya Hanabi (mazesoba)", cat: "japanese", area: "Walnut Village", r: 4.4 },
	{ id: "kitakata", name: "Kitakata Ramen Ban Nai", cat: "japanese", area: "Heritage Plaza (Culver)", r: 4.4 },
	{ id: "yakamoz", name: "Yakamoz Craft Ramen", cat: "japanese", area: "Stonecreek (Barranca)", r: 4.6 },
	{ id: "coco", name: "CoCo Ichibanya (curry)", cat: "japanese", area: "Diamond Jamboree", r: 4.5 },
	{ id: "osen", name: "Izakaya Osen", cat: "japanese", area: "Main St", r: 4.2 },
	{ id: "taiko", name: "Taiko", cat: "japanese", area: "Arbor Village (Jeffrey)", r: 4.3 },
	{ id: "miyabi", name: "Miyabi Halal Ramen", cat: "japanese", area: "Sky Park Circle", r: 5.0 },
	{ id: "marugame", name: "Marugame Udon", cat: "japanese", area: "Diamond Jamboree", r: 4.5 },
	{ id: "ssg", name: "Shin-Sen-Gumi", cat: "japanese", area: "Woodbury Town Center", r: 4.3 },
	{ id: "fukada", name: "Fukada (udon & teishoku)", cat: "japanese", area: "Irvine Center Dr", r: 4.4 },
	{ id: "katsubar", name: "Katsu Bar", cat: "japanese", area: "Culver Dr (Woodbridge)", r: 4.5 },
	{ id: "misasa", name: "Misasa (in Mitsuwa)", cat: "japanese", area: "Mitsuwa (Culver)", r: 4.3 },
	{ id: "pepperlunch", name: "Pepper Lunch", cat: "japanese", area: "Irvine Spectrum", r: 4.2 },
	{ id: "omori", name: "Omori Katsu & Ramen", cat: "japanese", area: "Culver Dr", r: 4.3 },
	{ id: "yasai", name: "Yasai", cat: "japanese", area: "Woodbury Town Center", r: 4.2 },

	// ── Sushi
	{ id: "kiyo", name: "KIYO Japanese Grill & Sake", cat: "sushi", area: "Dupont Dr", r: 4.8 },
	{ id: "ootoro", name: "Ootoro Sushi", cat: "sushi", area: "Park Place (Michelson)", r: 4.5 },
	{ id: "tensushi", name: "TEN Sushi + Cocktail Bar", cat: "sushi", area: "Von Karman", r: 4.4 },
	{ id: "tomikawa", name: "Tomikawa (AYCE)", cat: "sushi", area: "Jeffrey Rd", r: 4.2 },
	{ id: "wakasakura", name: "Waka Sakura (conveyor)", cat: "sushi", area: "Culver Plaza", r: 4.2 },
	{ id: "gurume", name: "Gurume Sushi", cat: "sushi", area: "Culver Dr", r: 4.3 },
	{ id: "nikoniko", name: "Niko Niko Sushi", cat: "sushi", area: "Woodbury Town Center", r: 4.2 },
	{ id: "robata", name: "Robata Wasa", cat: "sushi", area: "Irvine Spectrum", r: 4.1 },
	{ id: "botan", name: "Botan Sushi", cat: "sushi", area: "Walnut Village", r: 4.4 },
	{ id: "sushiworld", name: "Sushi World (AYCE)", cat: "sushi", area: "Culver Dr", r: 4.1 },
	{ id: "goginori", name: "Goginori (AYCE Sushi & KBBQ)", cat: "sushi", area: "Diamond Jamboree", r: 4.2 },

	// ── Chinese
	{ id: "timhowan", name: "Tim Ho Wan (dim sum)", cat: "chinese", area: "Diamond Jamboree", r: 4.0 },
	{ id: "noodlenest", name: "Noodle Nest 和悦", cat: "chinese", area: "Diamond Jamboree", r: 4.5 },
	{ id: "jajiaozi", name: "JA Jiaozi Dumplings", cat: "chinese", area: "Jamboree (Northpark)", r: 4.3 },
	{ id: "meizhou", name: "Meizhou Dongpo (Peking duck)", cat: "chinese", area: "Culver Dr", r: 4.0 },
	{ id: "sevengrams", name: "Seven Grams (XLB)", cat: "chinese", area: "Tustin", r: 4.6 },
	{ id: "mamama", name: "Mama Ma Kitchen 麻妈妈", cat: "chinese", area: "Culver Dr", r: 4.8 },
	{ id: "fishwithyou", name: "Fish With You 鱼你在一起", cat: "chinese", area: "Dupont Dr", r: 4.7 },
	{ id: "superyummy", name: "Super Yummy (luosifen)", cat: "chinese", area: "Corporate Park", r: 4.7 },
	{ id: "tenseconds", name: "Ten Seconds Yunnan Noodles", cat: "chinese", area: "Campus Dr · UCI", r: 4.8 },
	{ id: "northerncafe", name: "Northern Cafe", cat: "chinese", area: "UTC · UCI", r: 4.1 },
	{ id: "jzhou", name: "J Zhou Oriental (dim sum)", cat: "chinese", area: "Tustin District", r: 3.9 },
	{ id: "yueyan", name: "Yue Yan 悦宴 (Michelin rec.)", cat: "chinese", area: "Walnut Village", r: 4.2 },
	{ id: "kuanzhai", name: "Kuan Zhai Alley (Sichuan)", cat: "chinese", area: "Irvine Center Dr", r: 4.2 },
	{ id: "masterhu", name: "Master Hu 胡一南 (Hunan)", cat: "chinese", area: "Jeffrey Rd", r: 4.3 },
	{ id: "northernwp", name: "Northern Cafe (skewers)", cat: "chinese", area: "Westpark (Alton)", r: 4.2 },
	{ id: "capital", name: "Capital Seafood (dim sum)", cat: "chinese", area: "Irvine Spectrum", r: 3.8 },
	{ id: "leshrimp", name: "Le Shrimp Noodle Bar", cat: "chinese", area: "Irvine Spectrum", r: 4.2 },
	{ id: "pfchangs", name: "P.F. Chang's", cat: "chinese", area: "Irvine Spectrum", r: 4.2 },
	{ id: "chinagarden", name: "China Garden (dim sum)", cat: "chinese", area: "Walnut Village", r: 4.2 },
	{ id: "samwoo", name: "Sam Woo BBQ", cat: "chinese", area: "Culver Dr", r: 4.0 },
	{ id: "dunhuang", name: "Dun Huang (Lanzhou noodles)", cat: "chinese", area: "Culver Dr", r: 4.4 },

	// ── Taiwanese
	{ id: "aj", name: "A&J Restaurant 半畝園", cat: "taiwanese", area: "Arbor Village (Jeffrey)", r: 4.4 },
	{ id: "dtf", name: "Din Tai Fung", cat: "taiwanese", area: "Irvine Spectrum", r: 4.3 },
	{ id: "kingchops", name: "Kingchops 金園排骨", cat: "taiwanese", area: "Jeffrey Rd", r: 4.5 },
	{ id: "bafang", name: "Bafang Dumpling", cat: "taiwanese", area: "Walnut Village", r: 4.1 },
	{ id: "yusgarden", name: "Yu's Garden", cat: "taiwanese", area: "Walnut Village", r: 4.0 },
	{ id: "class302", name: "Class 302 Cafe", cat: "taiwanese", area: "Jamboree (Northpark)", r: 4.1 },
	{ id: "guppy", name: "Guppy House", cat: "taiwanese", area: "Diamond Jamboree", r: 3.8 },

	// ── Vietnamese
	{ id: "nep", name: "NEP Cafe", cat: "viet", area: "Heritage Plaza (Culver)", r: 4.5 },
	{ id: "saiga", name: "Saiga Vietnamese Eatery", cat: "viet", area: "Sky Park Circle", r: 4.7 },
	{ id: "sup", name: "SUP Noodle Bar", cat: "viet", area: "Heritage Plaza (Culver)", r: 4.4 },
	{ id: "phobaco", name: "Pho Ba Co", cat: "viet", area: "Stonecreek (Barranca)", r: 4.3 },
	{ id: "littlesister", name: "Little Sister", cat: "viet", area: "Irvine Spectrum", r: 4.0 },
	{ id: "phohanoi", name: "Pho Ha Noi", cat: "viet", area: "Jeffrey Rd", r: 4.0 },
	{ id: "saigonpearl", name: "Pho Saigon Pearl", cat: "viet", area: "Diamond Jamboree", r: 3.9 },
	{ id: "photasia", name: "PhoTasia", cat: "viet", area: "University Dr · UCI", r: 4.2 },
	{ id: "pholab", name: "Pho Lab", cat: "viet", area: "Alton Pkwy", r: 4.3 },
	{ id: "soupshop", name: "Soup Shop", cat: "viet", area: "Campus Plaza · UCI", r: 4.4 },
	{ id: "phokydong", name: "Pho Ky Dong", cat: "viet", area: "Walnut Village", r: 4.1 },
	{ id: "bamboobistro", name: "Bamboo Bistro (Viet · Thai)", cat: "viet", area: "University Dr · UCI", r: 4.2 },

	// ── Thai
	{ id: "thaikitchen", name: "Thai Kitchen", cat: "thai", area: "Stonecreek (Barranca)", r: 4.2 },
	{ id: "thaicafe", name: "Thai Cafe", cat: "thai", area: "Jeffrey Rd", r: 4.3 },
	{ id: "kinaree", name: "Kinaree Eatery (Thai brunch)", cat: "thai", area: "Quail Hill", r: 4.1 },
	{ id: "narathai", name: "Nara Thai Kitchen", cat: "thai", area: "Portola (Northpark)", r: 3.7 },
	{ id: "siam", name: "Siam Station", cat: "thai", area: "Corporate Park", r: 3.9 },

	// ── Hot Pot, Grill & Boils
	{ id: "haidilao", name: "Haidilao Hot Pot", cat: "hotpot", area: "Diamond Jamboree", r: 4.8 },
	{ id: "chubby", name: "Chubby Cattle BBQ", cat: "hotpot", area: "Diamond Jamboree", r: 4.9 },
	{ id: "showhotpot", name: "Show Hotpot (malatang)", cat: "hotpot", area: "Main St", r: 4.7 },
	{ id: "momo", name: "MoMo Paradise (shabu)", cat: "hotpot", area: "Walnut Village", r: 4.7 },
	{ id: "boilingpoint", name: "Boiling Point", cat: "hotpot", area: "Culver Plaza", r: 3.9 },
	{ id: "kickincrab", name: "The Kickin' Crab (boil)", cat: "hotpot", area: "Diamond Jamboree", r: 4.4 },
	{ id: "ygf", name: "YGF Malatang 杨国福", cat: "hotpot", area: "Dupont Dr", r: 4.8 },
	{ id: "zhangliang", name: "Zhangliang Malatang 张亮", cat: "hotpot", area: "Jeffrey Rd", r: 4.7 },

	// ── Poke & Hawaiian
	{ id: "pokeworks", name: "Pokeworks", cat: "poke", area: "Culver Dr", r: 4.5 },
	{ id: "pokenoya", name: "Pokenoya", cat: "poke", area: "Technology Dr", r: 4.6 },
	{ id: "pokedot", name: "Poke Dot", cat: "poke", area: "MacArthur Blvd", r: 4.5 },
	{ id: "poketiki", name: "Poke Tiki", cat: "poke", area: "Corporate Park", r: 4.4 },
	{ id: "pokibowl", name: "Poki Bowl", cat: "poke", area: "University Dr", r: 4.3 },
	{ id: "baypoke", name: "Bay Poke", cat: "poke", area: "Irvine Center Dr", r: 4.1 },
	{ id: "ahipoki", name: "Ahipoki Bowl", cat: "poke", area: "Culver Dr", r: 4.2 },

	// ── Indian
	{ id: "motimahal", name: "Moti Mahal (Indian-Nepali)", cat: "indian", area: "Von Karman", r: 4.6 },
	{ id: "maast", name: "Maast Indian (fusion)", cat: "indian", area: "Alton Pkwy (Spectrum)", r: 4.5 },
	{ id: "biryanipot", name: "Biryani Pot Express", cat: "indian", area: "Irvine Center Dr", r: 4.5 },
	{ id: "annapoorna", name: "Annapoorna Indian Cuisine", cat: "indian", area: "Culver Dr", r: 4.0 },
	{ id: "southernspice", name: "Southern Spice (dosa)", cat: "indian", area: "Barranca Pkwy", r: 3.4 },

	// ── Dessert & Bakery
	{ id: "85c", name: "85°C Bakery Cafe", cat: "dessert", area: "Diamond Jamboree + Spectrum", r: 4.4 },
	{ id: "meetfresh", name: "Meet Fresh", cat: "dessert", area: "Diamond Jamboree", r: 3.8 },
	{ id: "somisomi", name: "SomiSomi (taiyaki soft serve)", cat: "dessert", area: "Diamond Jamboree + Spectrum", r: 4.6 },
	{ id: "mochinut", name: "Mochinut (mochi donuts)", cat: "dessert", area: "UTC · UCI", r: 4.7 },
	{ id: "parisbaguette", name: "Paris Baguette", cat: "dessert", area: "Woodbury · Culver · UTC", r: 4.5 },
	{ id: "touslesjours", name: "Tous les Jours", cat: "dessert", area: "H Mart (Westpark + Northpark)", r: 4.1 },
	{ id: "mochilato", name: "MOCHI (Mochilato + Beard Papa)", cat: "dessert", area: "Culver Dr", r: 4.5 },
	{ id: "chewiemellow", name: "Chewie & Mellow", cat: "dessert", area: "Diamond Jamboree", r: 4.4 },
	{ id: "huilaushan", name: "Hui Lau Shan (HK dessert)", cat: "dessert", area: "Diamond Jamboree", r: 4.0 },
	{ id: "jsweets", name: "J.Sweets (in Mitsuwa)", cat: "dessert", area: "Mitsuwa (Culver)", r: 4.3 },
	{ id: "creamistry", name: "Creamistry (N2 ice cream)", cat: "dessert", area: "Northpark", r: 4.3 },
	{ id: "afters", name: "Afters Ice Cream", cat: "dessert", area: "Woodbridge (Barranca)", r: 4.4 },
	{ id: "honeymee", name: "Honeymee", cat: "dessert", area: "Culver Dr", r: 4.3 },
	{ id: "sulbeans", name: "Sul & Beans (bingsu)", cat: "dessert", area: "Diamond Jamboree", r: 4.2 }
];

const TIERS: Tier[] = [
	{ id: "S", label: "S", tag: "god tier", color: "#8f475b", ink: "#faf5f7" },
	{ id: "A", label: "A", tag: "always worth the line", color: "#a85a72", ink: "#faf5f7" },
	{ id: "B", label: "B", tag: "solid pick", color: "#bd7790", ink: "#faf5f7" },
	{ id: "C", label: "C", tag: "if it's close by", color: "#c98aa2", ink: "#3b1c24" },
	{ id: "D", label: "D", tag: "skip it", color: "#e2bfcd", ink: "#653642" }
];

const STORAGE_KEY = "irvine-eats-tierlist-v1";
const catOf = (id: string): Category => CATS.find((c) => c.id === id) ?? CATS[0];

export default function IrvineEatsTierList() {
	const [placements, setPlacements] = useState<Record<string, string>>({});
	const [loaded, setLoaded] = useState(false);
	const [filter, setFilter] = useState("all");
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<string | null>(null); // place id for tap-to-assign
	const [dragOver, setDragOver] = useState<string | null>(null); // tier id or "pool"
	const dragId = useRef<string | null>(null);

	// Load saved rankings
	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) setPlacements(JSON.parse(raw));
		} catch {
			/* first visit — nothing saved yet */
		}
		setLoaded(true);
	}, []);

	// Save on change
	useEffect(() => {
		if (!loaded) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(placements));
		} catch (e) {
			console.error("save failed", e);
		}
	}, [placements, loaded]);

	const assign = (placeId: string, tierId: string | null) => {
		setPlacements((p) => {
			const next = { ...p };
			if (tierId) next[placeId] = tierId;
			else delete next[placeId];
			return next;
		});
		setSelected(null);
	};

	const resetAll = () => {
		if (window.confirm("Clear all rankings and start over?")) setPlacements({});
	};

	const matches = (pl: Place) => {
		const okCat = filter === "all" || pl.cat === filter;
		const okSearch = !search || pl.name.toLowerCase().includes(search.toLowerCase()) || pl.area.toLowerCase().includes(search.toLowerCase());
		return okCat && okSearch;
	};

	const pool = PLACES.filter((p) => !placements[p.id] && matches(p));
	const rankedCount = Object.keys(placements).length;

	const handleDrop = (target: string) => {
		if (dragId.current) assign(dragId.current, target === "pool" ? null : target);
		dragId.current = null;
		setDragOver(null);
	};

	const Card = ({ pl, dim }: { pl: Place; dim?: boolean }) => {
		const c = catOf(pl.cat);
		const isSel = selected === pl.id;
		return (
			<div
				className={`group relative flex cursor-grab select-none flex-col gap-0.5 rounded-lg border border-viola-200 bg-white py-1.5 pl-4 pr-3 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${
					dim ? "opacity-30" : ""
				} ${isSel ? "ring-2 ring-viola-500 ring-offset-1 ring-offset-viola-50" : ""}`}
				draggable
				onDragStart={(e) => {
					dragId.current = pl.id;
					e.dataTransfer.effectAllowed = "move";
				}}
				onClick={() => setSelected(isSel ? null : pl.id)}
				title={`${pl.name} · ${c.label} · ★${pl.r}`}
			>
				<span className="absolute left-1.5 top-1/2 h-3/5 w-1.5 -translate-y-1/2 rounded-full" style={{ backgroundColor: c.color }} />
				<span className="text-[13px] font-semibold leading-tight text-viola-950">{pl.name}</span>
				<span className="text-[11px] font-medium text-viola-500">
					{pl.area} · ★{pl.r.toFixed(1)}
				</span>
			</div>
		);
	};

	const selectedPlace = PLACES.find((p) => p.id === selected);

	return (
		<div className="rounded-xl bg-viola-100 p-5 shadow-lg md:p-8">
			{/* ── Hero */}
			<header className="mb-6">
				<div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-viola-600">Irvine · UC Irvine · updated July 2026</div>
				<h1 className="text-4xl font-bold leading-none text-viola-900 md:text-6xl">
					Irvine <span className="text-viola-500">Eats</span>
				</h1>
				<p className="mt-4 max-w-2xl text-viola-800">
					The Asian food, boba &amp; dessert tier list — {PLACES.length} spots from Diamond Jamboree to the UTC, ranked by you. Drag a card into a tier, or tap it and pick a tier.
					Everything saves automatically to your browser.
				</p>
			</header>

			{/* ── Toolbar */}
			<div className="mb-6 flex flex-col gap-3">
				<div className="flex flex-wrap gap-2">
					<button
						className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
							filter === "all" ? "bg-viola-600 text-white" : "bg-viola-200 text-viola-900 hover:bg-viola-300"
						}`}
						onClick={() => setFilter("all")}
					>
						All
					</button>
					{CATS.map((c) => {
						const on = filter === c.id;
						return (
							<button
								key={c.id}
								className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
									on ? "bg-viola-600 text-white" : "bg-viola-200 text-viola-900 hover:bg-viola-300"
								}`}
								onClick={() => setFilter(on ? "all" : c.id)}
							>
								<span className="h-2 w-2 rounded-full ring-1 ring-black/10" style={{ backgroundColor: c.color }} />
								{c.label}
							</button>
						);
					})}
				</div>
				<div className="flex gap-2">
					<input
						className="w-full max-w-xs rounded-lg border border-viola-300 bg-viola-50 px-3.5 py-2 text-sm text-viola-950 outline-none transition placeholder:text-viola-400 focus:border-viola-500 focus:ring-2 focus:ring-viola-200"
						placeholder="Search spots or plazas…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<button
						className="rounded-lg border border-viola-300 px-4 py-2 text-[13px] font-semibold text-viola-700 transition hover:border-viola-500 hover:bg-viola-200"
						onClick={resetAll}
					>
						Reset
					</button>
				</div>
			</div>

			{/* ── Tier rows */}
			<div className="flex flex-col gap-2">
				{TIERS.map((t) => {
					const items = PLACES.filter((p) => placements[p.id] === t.id);
					return (
						<section
							key={t.id}
							className={`flex flex-col overflow-hidden rounded-xl border bg-viola-50 transition sm:flex-row ${
								dragOver === t.id ? "border-viola-500 ring-2 ring-viola-300" : "border-viola-200"
							}`}
							onDragOver={(e) => {
								e.preventDefault();
								setDragOver(t.id);
							}}
							onDragLeave={() => setDragOver((d) => (d === t.id ? null : d))}
							onDrop={(e) => {
								e.preventDefault();
								handleDrop(t.id);
							}}
						>
							<div
								className="flex shrink-0 flex-row items-center justify-start gap-3 px-4 py-2 sm:w-24 sm:flex-col sm:justify-center sm:gap-1 sm:py-4"
								style={{ background: t.color, color: t.ink }}
							>
								<span className="text-2xl font-bold leading-none sm:text-4xl">{t.label}</span>
								<span className="text-[9px] font-semibold uppercase tracking-wider opacity-80 sm:text-center">{t.tag}</span>
							</div>
							<div className="flex min-h-[64px] flex-1 flex-wrap content-start gap-1.5 p-2.5">
								{items.length === 0 && <span className="self-center px-1 py-2 text-xs italic text-viola-400">drop spots here</span>}
								{items.map((pl) => (
									<Card key={pl.id} pl={pl} dim={!matches(pl)} />
								))}
							</div>
						</section>
					);
				})}
			</div>

			{/* ── Pool / the menu */}
			<section
				className={`mt-6 rounded-2xl border-[1.5px] border-dashed p-4 transition ${
					dragOver === "pool" ? "border-viola-500 bg-viola-200/40" : "border-viola-300"
				}`}
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver("pool");
				}}
				onDragLeave={() => setDragOver((d) => (d === "pool" ? null : d))}
				onDrop={(e) => {
					e.preventDefault();
					handleDrop("pool");
				}}
			>
				<div className="mb-3 flex items-baseline justify-between">
					<h2 className="text-xl font-bold text-viola-900">The menu</h2>
					<span className="text-xs font-semibold text-viola-600">
						{rankedCount}/{PLACES.length} ranked
					</span>
				</div>
				<div className="flex flex-wrap gap-1.5">
					{pool.length === 0 && (
						<span className="px-1 py-2 text-xs italic text-viola-400">
							{rankedCount === PLACES.length ? "Everything's ranked. Certified Irvine foodie." : "No matches — adjust the filter or search."}
						</span>
					)}
					{pool.map((pl) => (
						<Card key={pl.id} pl={pl} />
					))}
				</div>
			</section>

			{/* ── Tap-to-assign bar */}
			{selectedPlace && (
				<div className="fixed bottom-4 left-1/2 z-50 flex w-[min(94vw,640px)] -translate-x-1/2 flex-wrap items-center gap-3 rounded-2xl border border-viola-300 bg-viola-100 px-4 py-3 shadow-2xl">
					<span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-viola-900">{selectedPlace.name}</span>
					<div className="flex items-center gap-1.5">
						{TIERS.map((t) => (
							<button
								key={t.id}
								className="h-9 w-9 rounded-lg text-[15px] font-bold transition hover:scale-110"
								style={{ background: t.color, color: t.ink }}
								onClick={() => assign(selectedPlace.id, t.id)}
							>
								{t.label}
							</button>
						))}
						{placements[selectedPlace.id] && (
							<button
								className="rounded-lg border border-viola-300 bg-viola-50 px-2.5 py-2 text-xs font-semibold text-viola-700 transition hover:bg-viola-200"
								onClick={() => assign(selectedPlace.id, null)}
							>
								Unrank
							</button>
						)}
						<button
							className="rounded-lg border border-viola-300 bg-viola-50 px-2.5 py-2 text-xs font-semibold text-viola-700 transition hover:bg-viola-200"
							onClick={() => setSelected(null)}
						>
							✕
						</button>
					</div>
				</div>
			)}

			{/* ── Footer note */}
			<p className="mt-8 text-[11px] leading-relaxed text-viola-500">
				Spots &amp; neighborhoods gathered from Google Places, Yelp &amp; local guides, July 2026 · ratings are a rough starting point — the rankings are yours alone, saved to this
				browser.
			</p>
		</div>
	);
}
