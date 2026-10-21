/**
 * A category from a few words — a merchant name, a model's free-text label, a sentence.
 * The models pick a category themselves; this is the safety net when they don't (or invent
 * one of their own like "Dining"). India-first brand lists, but works anywhere.
 */
import { isCategoryId, type CategoryId } from '../shared/categories'

/** Keywords per category. Matched as whole words; the longest match wins ("uber eats" beats "uber"). */
const KEYWORDS: Readonly<Record<Exclude<CategoryId, 'other'>, readonly string[]>> = {
  food: [
    'food', 'restaurant', 'restaurants', 'dining', 'dine', 'dinner', 'lunch', 'breakfast', 'brunch', 'supper', 'meal', 'meals',
    'snack', 'snacks', 'cafe', 'coffee', 'chai', 'tea', 'bar', 'pub', 'brewery', 'bistro', 'dhaba', 'canteen', 'mess', 'tiffin',
    'bakery', 'dessert', 'desserts', 'ice cream', 'juice', 'drinks', 'beer', 'beers', 'wine', 'cocktails', 'pizza', 'burger',
    'biryani', 'dosa', 'thali', 'momos', 'shawarma', 'sushi', 'kitchen', 'eatery', 'swiggy', 'zomato', 'uber eats', 'doordash',
    'deliveroo', 'eatsure', 'dominos', 'mcdonalds', 'kfc', 'subway', 'starbucks', 'haldirams', 'barbeque nation', 'takeaway',
    'takeout', 'party food',
  ],
  groceries: [
    'grocery', 'groceries', 'supermarket', 'hypermarket', 'kirana', 'provisions', 'ration', 'vegetables', 'veggies', 'sabzi',
    'fruits', 'milk', 'dairy', 'blinkit', 'zepto', 'bigbasket', 'big basket', 'instamart', 'swiggy instamart', 'jiomart',
    'dmart', 'd mart', 'reliance fresh', 'reliance smart', 'more supermarket', 'spencers', 'natures basket', 'star bazaar',
    'lulu', 'walmart', 'costco', 'tesco', 'aldi', 'lidl', 'whole foods', 'trader joes',
  ],
  rent: ['rent', 'rental', 'house rent', 'flat rent', 'room rent', 'pg', 'paying guest', 'maintenance', 'society maintenance', 'lease', 'landlord', 'deposit', 'brokerage'],
  utilities: [
    'utilities', 'utility', 'electricity', 'electric', 'power bill', 'light bill', 'current bill', 'bescom', 'msedcl', 'mahavitaran',
    'tata power', 'adani electricity', 'bses', 'tneb', 'tangedco', 'kseb', 'cesc', 'water bill', 'water', 'gas', 'gas bill', 'lpg',
    'cylinder', 'indane', 'bharat gas', 'hp gas', 'piped gas', 'igl', 'mgl', 'wifi', 'wi fi', 'broadband', 'internet', 'fibernet',
    'act fibernet', 'jio fiber', 'jiofiber', 'airtel', 'airtel xstream', 'jio', 'vodafone', 'bsnl', 'recharge', 'postpaid',
    'mobile bill', 'phone bill', 'dth', 'tata play', 'cable',
  ],
  travel: [
    'travel', 'trip', 'vacation', 'holiday', 'flight', 'flights', 'airfare', 'airline', 'airlines', 'airways', 'indigo', 'air india',
    'vistara', 'spicejet', 'akasa', 'makemytrip', 'goibibo', 'cleartrip', 'yatra', 'ixigo', 'easemytrip', 'hotel', 'hotels',
    'resort', 'stay', 'homestay', 'hostel', 'zostel', 'oyo', 'airbnb', 'booking com', 'agoda', 'irctc', 'train tickets',
    'train ticket', 'visa', 'tour', 'trek', 'sightseeing',
  ],
  transport: [
    'transport', 'cab', 'cabs', 'taxi', 'uber', 'ola', 'rapido', 'namma yatri', 'blusmart', 'auto', 'rickshaw', 'tuk tuk', 'metro',
    'bus', 'local train', 'train', 'petrol', 'diesel', 'fuel', 'cng', 'ev charging', 'toll', 'fastag', 'parking', 'bike rental',
    'yulu', 'ferry', 'ride',
  ],
  shopping: [
    'shopping', 'clothes', 'clothing', 'apparel', 'shoes', 'electronics', 'gadget', 'gadgets', 'amazon', 'flipkart', 'myntra',
    'ajio', 'nykaa', 'meesho', 'tata cliq', 'croma', 'reliance digital', 'decathlon', 'ikea', 'zara', 'uniqlo', 'westside',
    'lifestyle', 'shoppers stop', 'mall', 'furniture', 'appliance',
  ],
  entertainment: [
    'entertainment', 'movie', 'movies', 'film', 'cinema', 'pvr', 'inox', 'cinepolis', 'bookmyshow', 'book my show', 'district',
    'insider', 'concert', 'gig', 'show', 'standup', 'stand up', 'comedy', 'bowling', 'arcade', 'gaming', 'games', 'amusement park',
    'theme park', 'wonderla', 'imagica', 'club', 'nightclub', 'cover charge', 'match tickets', 'ipl', 'museum', 'zoo', 'escape room',
  ],
  subscription: [
    'subscription', 'subscriptions', 'membership', 'netflix', 'spotify', 'prime', 'amazon prime', 'prime video', 'hotstar',
    'disney', 'jiocinema', 'jiohotstar', 'youtube', 'youtube premium', 'apple music', 'apple one', 'apple tv', 'icloud',
    'google one', 'chatgpt', 'zee5', 'sonyliv', 'sony liv', 'audible', 'kindle unlimited', 'linkedin premium', 'xbox game pass',
    'playstation plus', 'canva',
  ],
  gift: ['gift', 'gifts', 'present', 'birthday', 'anniversary', 'wedding gift', 'farewell', 'flowers', 'bouquet', 'shagun', 'ferns n petals', 'fnp', 'igp'],
  health: [
    'health', 'medical', 'medicine', 'medicines', 'pharmacy', 'chemist', 'apollo', 'medplus', '1mg', 'tata 1mg', 'pharmeasy',
    'netmeds', 'doctor', 'hospital', 'clinic', 'dentist', 'dental', 'diagnostics', 'lab test', 'thyrocare', 'practo', 'gym', 'cult',
    'cult fit', 'cultfit', 'fitness', 'yoga', 'physio', 'physiotherapy', 'health insurance',
  ],
}

/** Lower-case, accents off, apostrophes dropped ("Domino's" → "dominos"), other punctuation → spaces. */
export function foldText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Words that only name a kind of spending: any brand or specific word beats them ("Cult.fit membership" is health). */
const GENERIC: ReadonlySet<string> = new Set([
  'food', 'meal', 'meals', 'groceries', 'grocery', 'utilities', 'utility', 'travel', 'trip', 'transport', 'ride', 'stay', 'shopping',
  'entertainment', 'subscription', 'subscriptions', 'membership', 'gift', 'gifts', 'health', 'fitness',
])

/** Specific words first, longest first: "uber eats" beats "uber", "netflix" beats "subscription". */
const ENTRIES: ReadonlyArray<readonly [CategoryId, string]> = Object.entries(KEYWORDS)
  .flatMap(([category, words]) => words.map((word) => [category as CategoryId, foldText(word)] as const))
  .sort((a, b) => Number(GENERIC.has(a[1])) - Number(GENERIC.has(b[1])) || b[1].length - a[1].length)

/** The category whose keyword best matches `text`, or null when nothing does. */
export function inferCategory(text: string | null | undefined): CategoryId | null {
  if (!text) return null
  const padded = ` ${foldText(text)} `
  if (padded.trim() === '') return null
  for (const [category, word] of ENTRIES) if (padded.includes(` ${word} `)) return category
  return null
}

/** A model's category: an id as-is ("Food" → food), else whatever its label suggests ("Dining" → food). */
export function toCategory(value: unknown): CategoryId | null {
  if (typeof value !== 'string') return null
  const id = value.trim().toLowerCase()
  if (isCategoryId(id)) return id
  return inferCategory(value)
}
