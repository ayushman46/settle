/** Tamil copy for Activity (src/features/activity). Keys: `activity.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const activity = {
  // The screen.
  'activity.title': 'வரலாறு',
  'activity.newSplit.cta': 'புதிய பிரிப்பு',
  // Nothing split yet (first run).
  'activity.firstRun.title': 'உங்கள் பிரிப்புகள் இங்கே இருக்கும்',
  'activity.firstRun.body': 'நீங்கள் பிரிக்கும் ஒவ்வொரு செலவும் இங்கே, புதியது முதலில் வரும்படி தோன்றும் — யார் உங்களுக்குத் திருப்பிச் செலுத்தியுள்ளனர், யார் இன்னும் செலுத்தவில்லை என்பதுடன்.',
  'activity.firstRun.split.cta': 'தொகையைப் பிரி',
  'activity.firstRun.scan.cta': 'பில்லை ஸ்கேன் செய்',
  // A filter with nothing in it.
  'activity.empty.all.title': 'இன்னும் செலவுகள் இல்லை',
  'activity.empty.all.body': 'எதையாவது பிரியுங்கள், அது இங்கே தோன்றும்.',
  'activity.empty.collect.title': 'வசூலிக்க எதுவும் இல்லை',
  'activity.empty.collect.body': 'எல்லோரும் உங்களுக்குத் திருப்பிச் செலுத்திவிட்டனர். நன்று.',
  'activity.empty.pay.title': 'கணக்கு சரியாக உள்ளது',
  'activity.empty.pay.body': 'இப்போது நீங்கள் யாருக்கும் கடன்படவில்லை.',
  'activity.empty.bills.title': 'இன்னும் பில்கள் இல்லை',
  // {brand} is the app's name (Settle).
  'activity.empty.bills.body': 'உணவகப் பில்லைப் புகைப்படம் எடுங்கள், {brand} அதைப் பொருள் பொருளாகப் பிரிக்கும்.',
  'activity.empty.groups.title': 'இன்னும் குழுச் செலவுகள் இல்லை',
  'activity.empty.groups.body': 'பயணங்கள், வீடுகள், ஜோடிகள் — பகிர்ந்த செலவுகளை ஒரு குழுவில் வையுங்கள்.',
  'activity.empty.settled.title': 'இன்னும் தீர்க்கப்பட்டவை எதுவும் இல்லை',
  'activity.empty.settled.body': 'எல்லோரும் கணக்கைச் சமன் செய்தவுடன் பிரிப்புகள் இங்கே வரும்.',
  'activity.empty.scan.cta': 'பில்லை ஸ்கேன் செய்',
  'activity.empty.groups.cta': 'குழுக்களுக்குச் செல்',
  // A search that finds nothing ({query} is what was typed).
  'activity.noMatches.title': '“{query}” க்கு பொருத்தங்கள் இல்லை',
  'activity.noMatches.body': 'ஒரு பெயர், ஓர் இடம் அல்லது ஒரு தொகையை முயற்சி செய்யுங்கள்.',
  'activity.noMatches.cta': 'எல்லா வரலாற்றையும் காட்டு',
  // Groups that aren't square, listed above the splits under "To collect" / "To pay".
  'activity.groups.owed.title': 'குழுக்களில் உங்களுக்குத் தர வேண்டியவை',
  'activity.groups.owe.title': 'குழுக்களில் நீங்கள் தர வேண்டியவை',
  'activity.groups.description': 'குழுச் செலவுகளை எல்லோரும் சேர்ந்து தீர்த்துக்கொள்ளுங்கள்.',
  'activity.groups.row.subtitle': 'கணக்கு தீர்',
  // Spoken name of a group's row: {group} its name, {amount} formatted money.
  'activity.groups.row.owed.aria': '{group}: உங்களுக்கு {amount} வர வேண்டும். கணக்கு தீர்',
  'activity.groups.row.owe.aria': '{group}: நீங்கள் {amount} தர வேண்டும். கணக்கு தீர்',
  // The filter chips.
  'activity.filters.aria': 'காட்டு',
  'activity.filter.all.chip': 'அனைத்தும்',
  'activity.filter.collect.chip': 'வசூலிக்க',
  'activity.filter.pay.chip': 'செலுத்த',
  'activity.filter.bills.chip': 'பில்கள்',
  'activity.filter.groups.chip': 'குழுக்கள்',
  'activity.filter.settled.chip': 'தீர்ந்தவை',
  // Spoken name of a chip with a count bubble: "To collect, 3".
  'activity.filter.counted.aria': '{label}, {count}',
  // The search pill.
  'activity.search.label': 'வரலாற்றைத் தேடு',
  'activity.search.placeholder': 'பெயர்கள், இடங்கள் அல்லது தொகைகளைத் தேடுங்கள்',
  'activity.search.clear.aria': 'தேடலை அழி',
  // The line under the chips, summing up what's listed (also read out as the list changes).
  'activity.results.noMatches': '“{query}” க்கு பொருத்தங்கள் இல்லை',
  'activity.results.matches': '“{query}” க்கு {count, plural, one {# பொருத்தம்} other {# பொருத்தங்கள்}}',
  'activity.results.nothing.all': 'இன்னும் செலவுகள் இல்லை',
  'activity.results.nothing.collect': 'வசூலிக்க எதுவும் இல்லை',
  'activity.results.nothing.pay': 'செலுத்த எதுவும் இல்லை',
  'activity.results.nothing.bills': 'இன்னும் பில்கள் இல்லை',
  'activity.results.nothing.groups': 'இன்னும் குழுச் செலவுகள் இல்லை',
  'activity.results.nothing.settled': 'இன்னும் தீர்ந்தவை எதுவும் இல்லை',
  'activity.results.all': '{count, plural, one {# செலவு} other {# செலவுகள்}}',
  // {sum}: formatted money, several currencies joined with " + ".
  'activity.results.collect': '{sum} வசூலிக்க வேண்டும் — {count, plural, one {# பிரிப்பில்} other {# பிரிப்புகளில்}}',
  'activity.results.pay': 'நீங்கள் {sum} தர வேண்டும் — {count, plural, one {# பிரிப்பில்} other {# பிரிப்புகளில்}}',
  'activity.results.bills': '{count, plural, one {# பில்} other {# பில்கள்}}',
  'activity.results.groups': '{count, plural, one {# குழுச் செலவு} other {# குழுச் செலவுகள்}}',
  'activity.results.settled': '{count, plural, one {# செலவு தீர்க்கப்பட்டது} other {# செலவுகள் தீர்க்கப்பட்டன}}',
  // Only groups listed (read by screen readers only).
  'activity.results.owedInGroups': '{count, plural, one {# குழுவில்} other {# குழுக்களில்}} உங்களுக்குத் தர வேண்டியவை',
  'activity.results.oweInGroups': '{count, plural, one {# குழுவில்} other {# குழுக்களில்}} நீங்கள் தர வேண்டியவை',
  // Month sections.
  'activity.month.undated': 'தேதி இல்லாதவை',
} as const satisfies Messages
