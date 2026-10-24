/** Bengali copy for messages from the server and the AI scan (what people see, never the server's own words). Keys: `api.<area>.<element>`. */
import type { Messages } from '../types'

export const api = {
  // What we tell people when a bill scan fails, by error code. Never the server's own words.
  'api.scan.error.bad_request': 'ছবিটিতে কিছু একটা সমস্যা হয়েছে। অন্য একটি ছবি দিয়ে দেখুন।',
  'api.scan.error.unsupported_image': 'JPG বা PNG ছবি ব্যবহার করুন।',
  'api.scan.error.image_too_large': 'ছবিটি খুব বড়। ছোট ছবি দিন — বা এর স্ক্রিনশট নিন।',
  'api.scan.error.not_a_bill': 'এটি বিল বলে মনে হচ্ছে না। পুরো রসিদের একটি স্পষ্ট ছবি দিয়ে দেখুন।',
  'api.scan.error.unreadable': 'কোনো আইটেম পড়া যায়নি। আরও স্পষ্ট, ভালো আলোর ছবি দিন — অথবা আইটেমগুলো নিজে লিখুন।',
  'api.scan.error.not_configured': 'এখন ছবি স্ক্যান করা যাচ্ছে না — আইটেমগুলো টাইপ করে দিতে পারেন।',
  'api.scan.error.upstream_auth': 'এখন ছবি স্ক্যান কাজ করছে না — আইটেমগুলো টাইপ করে দিতে পারেন।',
  'api.scan.error.rate_limited': 'এখন অনেক স্ক্যান হচ্ছে। কয়েক মিনিট পরে আবার চেষ্টা করুন — বা আইটেমগুলো টাইপ করুন।',
  'api.scan.error.timeout': 'বিল পড়তে অনেক সময় লেগেছে। আরও কাছ থেকে, স্পষ্ট ছবি দিয়ে আবার চেষ্টা করুন।',
  'api.scan.error.upstream_error': 'AI সার্ভিসের সঙ্গে যোগাযোগ করা যায়নি। আবার চেষ্টা করুন।',
  'api.scan.error.network': 'মনে হচ্ছে আপনি অফলাইনে আছেন। সংযোগ দেখে আবার চেষ্টা করুন।',
  'api.scan.error.aborted': 'স্ক্যান বাতিল হয়েছে।',
  // A short wait: the server is busy, nobody did anything wrong.
  'api.scan.busy': 'এখন অনেক বিল পড়া হচ্ছে — একটু পরে আবার চেষ্টা করুন।',
  // A long wait; `{wait}` is "about 10 minutes" (api.wait.*).
  'api.scan.proLimit': 'আজকের ফেয়ার-ইউজ AI সীমা শেষ হয়ে গেছে। {wait} পরে আবার শুরু হবে — তবু আইটেমগুলো টাইপ করে দিতে পারেন।',
  'api.scan.limit': 'অনেক স্ক্যান হয়ে গেছে। {wait} পরে আবার চেষ্টা করুন — বা আইটেমগুলো টাইপ করুন।',
  'api.scan.offline': 'আপনি অফলাইনে আছেন — তবু আইটেমগুলো টাইপ করে দিতে পারেন।',
  // A picked photo we can't use.
  'api.image.error.not_image': 'ফাইলটি ছবি নয়। একটি JPG বা PNG ছবি বেছে নিন।',
  'api.image.error.decode_failed': 'ছবিটি খোলা যায়নি। JPG বা PNG দিয়ে দেখুন — বা এর স্ক্রিনশট নিন।',
  'api.image.error.too_large': 'ছবিটি খুব বড় (25 MB-এর বেশি)। ছোট ছবি দিন — বা এর স্ক্রিনশট নিন।',
  // How long a wait is, rounded up.
  'api.wait.minute': 'প্রায় এক মিনিট',
  'api.wait.minutes': 'প্রায় {count} মিনিট',
  'api.wait.hours': 'প্রায় {count} ঘণ্টা',
} as const satisfies Messages
