/**
 * Expense categories: labels, emoji and the words that give each one away — including the
 * apps and brands people in India actually type ("Swiggy", "Blinkit", "Rapido", "BESCOM").
 */
import { CATEGORY_IDS, type CategoryId } from '../domain/types'

export { today } from './dates'

export interface CategoryMeta {
  label: string
  emoji: string
  keywords: readonly string[]
}

export const CATEGORY_META: Readonly<Record<CategoryId, CategoryMeta>> = {
  food: {
    label: 'Food & drinks',
    emoji: '🍽️',
    keywords: [
      'food', 'dinner', 'lunch', 'breakfast', 'brunch', 'meal', 'supper', 'restaurant', 'cafe',
      'coffee', 'tea', 'chai', 'snack', 'pizza', 'burger', 'biryani', 'dosa', 'thali', 'momos',
      'dessert', 'ice cream', 'bakery', 'buffet', 'takeaway', 'drinks', 'beer', 'bar', 'pub',
      'swiggy', 'zomato', 'eatsure', 'eatfit', 'dominos', 'domino s', 'mcdonalds', 'mcdonald s',
      'kfc', 'starbucks', 'chaayos', 'ccd', 'cafe coffee day', 'barbeque nation', 'haldiram',
      'haldirams', 'dhaba', 'khana', 'nashta', 'pani puri', 'chaat', 'uber eats',
    ],
  },
  groceries: {
    label: 'Groceries',
    emoji: '🛒',
    keywords: [
      'grocery', 'groceries', 'supermarket', 'kirana', 'provisions', 'ration', 'vegetables',
      'veggies', 'sabzi', 'fruits', 'milk', 'blinkit', 'zepto', 'bigbasket', 'big basket', 'bb now',
      'dmart', 'd mart', 'instamart', 'swiggy instamart', 'jiomart', 'jio mart', 'reliance fresh',
      'more supermarket', 'nature s basket', 'spencers', 'spencer s', 'star bazaar', 'amazon fresh',
      'flipkart minutes', 'dunzo', 'country delight', 'milkbasket',
    ],
  },
  rent: {
    label: 'Rent',
    emoji: '🏠',
    keywords: [
      'rent', 'house rent', 'flat rent', 'room rent', 'pg', 'paying guest', 'maintenance',
      'society', 'society maintenance', 'deposit', 'security deposit', 'lease', 'landlord',
      'brokerage', 'kiraya', 'nobroker',
    ],
  },
  utilities: {
    label: 'Bills & utilities',
    emoji: '💡',
    keywords: [
      'electricity', 'electricity bill', 'power bill', 'current bill', 'bijli', 'bescom', 'msedcl',
      'mseb', 'tata power', 'adani electricity', 'bses', 'tneb', 'tangedco', 'kseb', 'cesc',
      'water', 'water bill', 'gas', 'gas bill', 'cylinder', 'lpg', 'indane', 'bharat gas',
      'hp gas', 'piped gas', 'igl', 'mgl', 'wifi', 'wi fi', 'internet', 'broadband', 'fibre',
      'fiber', 'jio', 'jio fiber', 'airtel', 'airtel xstream', 'vodafone', 'act fibernet', 'bsnl',
      'recharge', 'mobile bill', 'phone bill', 'postpaid', 'dth', 'tata play', 'dish tv',
      'utilities', 'utility',
    ],
  },
  travel: {
    label: 'Travel & stays',
    emoji: '✈️',
    keywords: [
      'trip', 'travel', 'flight', 'flights', 'airfare', 'indigo', 'air india', 'air india express',
      'vistara', 'akasa', 'spicejet', 'makemytrip', 'make my trip', 'mmt', 'goibibo', 'cleartrip',
      'yatra', 'ixigo', 'easemytrip', 'hotel', 'hotels', 'oyo', 'airbnb', 'resort', 'hostel',
      'homestay', 'booking com', 'agoda', 'treebo', 'fabhotels', 'zostel', 'train', 'irctc',
      'redbus', 'holiday', 'vacation', 'visa', 'tour', 'sightseeing', 'stay',
    ],
  },
  transport: {
    label: 'Transport',
    emoji: '🚕',
    keywords: [
      'uber', 'ola', 'rapido', 'namma yatri', 'blusmart', 'cab', 'taxi', 'auto', 'rickshaw',
      'metro', 'bus', 'local train', 'petrol', 'diesel', 'fuel', 'cng', 'ev charging', 'parking',
      'toll', 'fastag', 'ride', 'commute',
    ],
  },
  shopping: {
    label: 'Shopping',
    emoji: '🛍️',
    keywords: [
      'shopping', 'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tata cliq', 'croma',
      'reliance digital', 'decathlon', 'ikea', 'lifestyle', 'westside', 'zara', 'h m', 'mall',
      'clothes', 'shoes', 'electronics', 'gadget', 'gadgets',
    ],
  },
  entertainment: {
    label: 'Entertainment',
    emoji: '🎬',
    keywords: [
      'movie', 'movies', 'cinema', 'film', 'bookmyshow', 'book my show', 'pvr', 'inox',
      'cinepolis', 'concert', 'gig', 'show', 'standup', 'stand up', 'comedy', 'theatre',
      'theater', 'bowling', 'gaming', 'game', 'games', 'club', 'party', 'event', 'festival',
      'amusement park', 'wonderla', 'imagica', 'district', 'paytm insider', 'insider',
    ],
  },
  subscription: {
    label: 'Subscriptions',
    emoji: '🔁',
    keywords: [
      'subscription', 'subscriptions', 'membership', 'netflix', 'spotify', 'prime',
      'amazon prime', 'prime video', 'hotstar', 'disney', 'jiohotstar', 'jio hotstar',
      'jiocinema', 'jio cinema', 'youtube', 'youtube premium', 'apple music', 'apple one',
      'apple tv', 'icloud', 'google one', 'chatgpt', 'sonyliv', 'sony liv', 'zee5', 'gaana',
      'wynk', 'audible', 'kindle unlimited', 'linkedin premium', 'swiggy one', 'zomato gold',
    ],
  },
  gift: {
    label: 'Gifts',
    emoji: '🎁',
    keywords: [
      'gift', 'gifts', 'birthday', 'bday', 'anniversary', 'wedding', 'shagun', 'farewell',
      'housewarming', 'baby shower', 'flowers', 'bouquet', 'tohfa', 'surprise',
    ],
  },
  health: {
    label: 'Health',
    emoji: '🩺',
    keywords: [
      'health', 'pharmacy', 'medicine', 'medicines', 'medical', 'chemist', 'doctor', 'hospital',
      'clinic', 'dentist', 'dental', 'checkup', 'lab test', 'diagnostics', 'apollo', 'pharmeasy',
      '1mg', 'tata 1mg', 'netmeds', 'practo', 'gym', 'cult', 'cult fit', 'cultfit', 'yoga',
      'physio', 'dawai', 'dawa',
    ],
  },
  other: {
    label: 'Other',
    emoji: '🧾',
    keywords: [],
  },
}

/** True for one of the 12 category ids. */
export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value)
}

/** Lower-case, accent-free, punctuation-free words separated by single spaces. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

interface Rule {
  words: string[]
  category: CategoryId
}

/** Every keyword as a word sequence, longest first so "amazon prime" beats "amazon". */
const RULES: readonly Rule[] = CATEGORY_IDS.flatMap((category) =>
  CATEGORY_META[category].keywords.map((k) => ({ words: normalize(k).split(' '), category })),
)
  .filter((r) => r.words.length > 0 && r.words[0] !== '')
  .sort((a, b) => b.words.length - a.words.length || b.words.join(' ').length - a.words.join(' ').length)

/** A word matches a keyword word exactly or as a simple plural ("movies" ↔ "movie"). */
function wordMatches(word: string, keyword: string): boolean {
  return word === keyword || word === `${keyword}s` || word === `${keyword}es`
}

/**
 * Best-guess category for a description ("Swiggy order" → food, "Uber to airport" → transport),
 * or null when nothing gives it away. Longer phrases win over the words inside them
 * ("Amazon Prime" → subscription, not shopping); then the category mentioned most; ties go to
 * whichever is mentioned first ("Dinner at the hotel" → food).
 */
export function categoryFromText(text: string): CategoryId | null {
  if (typeof text !== 'string') return null
  const words = normalize(text).split(' ').filter(Boolean)
  if (words.length === 0) return null
  const used = new Array<boolean>(words.length).fill(false)
  const hits = new Map<CategoryId, { count: number; first: number }>()

  for (const rule of RULES) {
    const n = rule.words.length
    for (let i = 0; i + n <= words.length; i++) {
      let match = true
      for (let j = 0; j < n; j++) {
        const word = words[i + j] ?? ''
        const keyword = rule.words[j] ?? ''
        // Only the last word of a phrase may be a plural.
        if (used[i + j] || !(j === n - 1 ? wordMatches(word, keyword) : word === keyword)) {
          match = false
          break
        }
      }
      if (!match) continue
      for (let j = 0; j < n; j++) used[i + j] = true
      const prev = hits.get(rule.category)
      hits.set(rule.category, { count: (prev?.count ?? 0) + 1, first: Math.min(prev?.first ?? i, i) })
    }
  }

  let best: CategoryId | null = null
  let bestHit: { count: number; first: number } | null = null
  for (const [category, hit] of hits) {
    if (!bestHit || hit.count > bestHit.count || (hit.count === bestHit.count && hit.first < bestHit.first)) {
      best = category
      bestHit = hit
    }
  }
  return best
}
