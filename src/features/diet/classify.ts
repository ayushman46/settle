/**
 * What a line on an Indian restaurant bill is, as far as "doesn't drink" and "vegetarian" go:
 * a drink with alcohol in it, a dish with meat, fish or egg in it, or neither (or not sure).
 *
 * Read the way a waiter would: whole words only ("gin" is not in "ginger", "ham" is not in
 * "shami"), brands and Hindi and regional words included ("KF Strong", "Old Monk", "murgh",
 * "kozhi", "machher"), and the traps kept out ("ginger beer", "virgin mojito", "beer battered
 * fish" is fish, "veg seekh", "eggless", "oyster mushroom", "goat cheese"). When it isn't clear,
 * the answer is null: nobody is taken off an item the app isn't sure about.
 */

export type DietKind = 'alcohol' | 'nonveg'

/* ------------------------------------------------------------------ alcohol */

/** Words that on their own mean a drink with alcohol in it. */
const ALCOHOL_WORDS = new Set([
  // beer
  'beer', 'lager', 'ale', 'ipa', 'stout', 'pilsner', 'draught', 'witbier', 'hefeweizen',
  // spirits
  'whisky', 'whiskey', 'whiskies', 'scotch', 'rum', 'vodka', 'gin', 'tequila', 'mezcal', 'brandy', 'cognac', 'liqueur',
  'liquor', 'absinthe', 'sambuca', 'vermouth', 'feni', 'fenny', 'toddy', 'daru', 'sharab', 'soju',
  // wine
  'wine', 'champagne', 'prosecco', 'sangria', 'cider', 'mimosa',
  // cocktails
  'martini', 'negroni', 'daiquiri', 'cosmopolitan', 'liit', 'peg', 'jagerbomb', 'campari', 'aperol',
  // brands
  'kingfisher', 'kf', 'budweiser', 'bud', 'bira', 'corona', 'heineken', 'tuborg', 'carlsberg', 'hoegaarden', 'simba',
  'stella', 'erdinger', 'paulaner', 'asahi', 'strongbow', 'fosters', 'haywards', 'breezer', 'smirnoff', 'absolut',
  'bacardi', 'jameson', 'glenfiddich', 'glenlivet', 'chivas', 'jagermeister', 'jager', 'baileys', 'kahlua', 'antiquity',
  'mcdowell', 'mcdowells', 'romanov', 'sula', 'fratelli', 'grover', 'teachers', 'jd', 'jw',
])

/** Phrases that mean a drink with alcohol in it. */
const ALCOHOL_PHRASES = [
  'long island', 'old monk', 'blenders pride', 'royal stag', 'royal challenge', 'imperial blue', 'officers choice',
  'magic moments', 'white mischief', 'jack daniels', 'jack daniel', 'johnnie walker', 'black label', 'red label',
  'blue label', 'double black', 'single malt', 'jacobs creek', 'on the rocks', 'bloody mary', 'white owl',
]

/** Words that usually mean alcohol, unless the line says it's a soft drink or food. */
const MAYBE_ALCOHOL = new Set(['cocktail', 'mojito', 'margarita', 'pint', 'pitcher', 'shots', 'bourbon'])

/** It says so: no alcohol in it. */
const NOT_ALCOHOL_PHRASES = [
  'virgin', 'mocktail', 'non alcoholic', 'nonalcoholic', 'alcohol free', 'zero alcohol', 'no alcohol', 'ginger beer',
  'root beer', 'ginger ale', 'scotch egg', 'wine vinegar', 'rum ball', 'rum and raisin', 'rum raisin',
]

/** Food made with a drink: rum cake, beer batter, wine sauce, penne alla vodka, a bourbon biscuit. */
const FOOD_WORDS = new Set([
  'cake', 'vinegar', 'sauce', 'batter', 'battered', 'pasta', 'penne', 'raisin', 'reduction', 'glazed', 'glaze',
  'marinated', 'brownie', 'pudding', 'tiramisu', 'truffle', 'risotto', 'fondue', 'pizza', 'biscuit', 'cookie', 'icecream',
  'samosa', 'idli', 'kachori', 'fruit', 'sandwich', 'platter', 'chips',
])
const FOOD_PHRASES = ['ice cream']

/** A soft drink in a pitcher or a pint, a coffee shot, a bourbon (biscuit) shake. */
const SOFT_WORDS = new Set([
  'lemonade', 'juice', 'soda', 'cola', 'coke', 'pepsi', 'water', 'lassi', 'shake', 'milkshake', 'smoothie', 'coffee',
  'espresso', 'tea', 'wheatgrass', 'ginger', 'chaas', 'buttermilk',
])

/* ------------------------------------------------------------------ meat, fish, egg */

/** Words that mean meat, fish or seafood. */
const MEAT_WORDS = new Set([
  'chicken', 'chiken', 'chikken', 'murgh', 'murg', 'kozhi', 'koli', 'kodi', 'kombdi', 'mutton', 'gosht', 'lamb', 'goat',
  'meat', 'keema', 'kheema', 'qeema', 'kaleji', 'bheja', 'paya', 'nalli', 'boti', 'mangsho', 'erachi', 'irachi', 'fish',
  'machli', 'machhli', 'macchi', 'machhi', 'machher', 'maach', 'meen', 'prawn', 'shrimp', 'jhinga', 'chingri', 'kolambi',
  'crab', 'lobster', 'squid', 'calamari', 'octopus', 'oyster', 'mussel', 'clam', 'tisrya', 'tuna', 'salmon', 'basa',
  'surmai', 'pomfret', 'rawas', 'bangda', 'bombil', 'kingfish', 'seer', 'hilsa', 'ilish', 'rohu', 'katla', 'anchovy',
  'sardine', 'anchovies', 'mackerel', 'tilapia', 'pork', 'beef', 'buff', 'veal', 'bacon', 'ham', 'sausage', 'salami', 'pepperoni',
  'chorizo', 'prosciutto', 'duck', 'turkey', 'quail', 'venison', 'rabbit', 'liver', 'meatball', 'hamburger',
])
const MEAT_PHRASES = ['rogan josh', 'laal maas', 'lal maas', 'hot dog', 'hot dogs']

/** Egg (counted as non-veg: most vegetarians at an Indian table don't eat it). */
const EGG_WORDS = new Set(['egg', 'anda', 'omelette', 'omelet', 'mutta'])

/** Dishes that are meat unless the line says veg ("seekh kebab" is mutton; "veg seekh" isn't). */
const USUALLY_MEAT = new Set([
  'seekh', 'shami', 'galouti', 'kakori', 'reshmi', 'haleem', 'nihari', 'shawarma', 'nugget', 'wings', 'wing', 'tangdi',
])

/** It says it isn't meat, whatever else it says ("vegan chicken burger", "chicken-less nuggets"). */
const SURELY_VEG_WORDS = new Set(['vegan', 'vegetarian', 'mock', 'meatless', 'chickenless', 'faux', 'plantbased'])
const SURELY_VEG_PHRASES = ['plant based', 'meat free', 'chicken less', 'no meat']

/** It says veg, which settles a dish that could go either way ("veg seekh", "paneer shawarma"). */
const VEG_WORDS = new Set([
  'veg', 'veggie', 'vegetable', 'paneer', 'mushroom', 'soya', 'soy', 'chaap', 'tofu', 'aloo', 'gobi', 'cauliflower',
  'corn', 'dal', 'rajma', 'chana', 'chole', 'palak', 'kathal', 'jackfruit', 'cheese',
])
const VEG_PHRASES = ['hara bhara']

/** Words that look like meat or egg here but aren't ("goat cheese", "oyster mushroom", "egg free", "egg plant"). */
const NOT_MEAT_PHRASES = [
  'goat cheese', 'goats cheese', 'oyster mushroom', 'oyster mushrooms', 'oyster sauce', 'egg plant', 'egg less',
  'egg free', 'without egg', 'without eggs', 'no egg', 'no eggs',
]

const NON_VEG_PHRASES = ['non veg', 'nonveg', 'non vegetarian', 'nv']

/* ------------------------------------------------------------------ reading a line */

interface Line {
  /** Normalised words joined by single spaces, padded with a space at each end. */
  text: string
  /** Each word, and each word without a plural "s". */
  words: Set<string>
  zeroZero: boolean
}

function read(name: string): Line {
  const lower = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  // "Bira 0.0", "Heineken 0.0%": alcohol-free beer.
  const zeroZero = /(^|[^\d.])0\.0+(?![\d.]*[1-9])/.test(lower)
  const plain = lower
    .replace(/['’`]/g, '') // Jack Daniel's → jack daniels
    .replace(/([a-z])(\d)/g, '$1 $2') // chicken65 → chicken 65
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  return lineOf(plain, zeroZero)
}

function lineOf(plain: string, zeroZero: boolean): Line {
  const words = new Set<string>()
  for (const word of plain.split(' ')) {
    if (word === '') continue
    words.add(word)
    if (word.length > 3 && word.endsWith('es') && /(sh|ch|x|ss)es$/.test(word)) words.add(word.slice(0, -2))
    if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) words.add(word.slice(0, -1))
  }
  return { text: ` ${plain} `, words, zeroZero }
}

const hasPhrase = (line: Line, phrases: readonly string[]): boolean => phrases.some((p) => line.text.includes(` ${p} `))
const hasWord = (line: Line, set: ReadonlySet<string>): boolean => {
  for (const word of line.words) if (set.has(word)) return true
  return false
}

function isAlcohol(line: Line, meaty: boolean): boolean {
  if (line.zeroZero || hasPhrase(line, NOT_ALCOHOL_PHRASES)) return false
  // Food made with a drink is food (beer battered fish, rum cake, whisky glazed chicken).
  const food = meaty || hasWord(line, FOOD_WORDS) || hasPhrase(line, FOOD_PHRASES)
  if (food) return false
  if (hasWord(line, ALCOHOL_WORDS) || hasPhrase(line, ALCOHOL_PHRASES)) return true
  return hasWord(line, MAYBE_ALCOHOL) && !hasWord(line, SOFT_WORDS)
}

function isNonVeg(line: Line): boolean {
  if (hasPhrase(line, NON_VEG_PHRASES)) return true
  if (hasWord(line, SURELY_VEG_WORDS) || hasPhrase(line, SURELY_VEG_PHRASES)) return false
  // "Goat cheese and chicken salad": the goat is cheese, the chicken is still chicken.
  let text = line.text
  for (const phrase of NOT_MEAT_PHRASES) text = text.replaceAll(` ${phrase} `, ' ')
  const rest = lineOf(text.trim(), false)
  if (hasWord(rest, MEAT_WORDS) || hasWord(rest, EGG_WORDS) || hasPhrase(rest, MEAT_PHRASES)) return true
  return hasWord(rest, USUALLY_MEAT) && !hasWord(rest, VEG_WORDS) && !hasPhrase(rest, VEG_PHRASES)
}

/**
 * `'alcohol'` for a drink with alcohol in it, `'nonveg'` for a dish with meat, fish or egg, null
 * for anything else or anything unclear. Case, spacing and punctuation don't matter.
 */
export function classifyItem(name: string): DietKind | null {
  const line = read(name)
  if (line.words.size === 0) return null
  const nonVeg = isNonVeg(line)
  if (isAlcohol(line, nonVeg)) return 'alcohol'
  return nonVeg ? 'nonveg' : null
}
