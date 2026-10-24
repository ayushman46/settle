/** Gujarati copy for insights (src/features/insights). Keys: `insights.<screen>.<element>`. */
import type { Messages } from '../types'

export const insights = {
  'insights.title': 'ઇનસાઇટ્સ',
  'insights.subtitle': 'તમારા પૈસા ક્યાં જાય છે',

  'insights.range.aria': 'સમયગાળો',
  'insights.range.thisMonth': 'આ મહિનો',
  'insights.range.last3Months': '3 મહિના',
  'insights.range.thisYear': 'આ વર્ષ',
  'insights.range.all': 'બધો સમય',

  'insights.empty.title':
    '{range, select, this_month {આ મહિને હજી કંઈ નથી} last_3_months {છેલ્લા 3 મહિનામાં હજી કંઈ નથી} this_year {આ વર્ષે હજી કંઈ નથી} other {તમે શરૂ કર્યું ત્યારથી હજી કંઈ નથી}}',
  'insights.empty.body': 'આ સમયગાળામાં તમે જેમાં છો તે સ્પ્લિટ અહીં દેખાશે. લાંબો સમયગાળો અજમાવો.',
  'insights.empty.first.title': 'તમારી ઇનસાઇટ્સ પહેલી સ્પ્લિટથી શરૂ થશે',
  'insights.empty.first.body': 'તમે જેમાં છો એવી દરેક સ્પ્લિટ અહીં દેખાય છે — કેટેગરી, મહિના અને મિત્ર પ્રમાણે.',
  'insights.empty.cta': 'એક ખર્ચ વહેંચો',
  'insights.otherCurrency':
    '{count, plural, one {બીજી કરન્સીમાં એક # ખર્ચ અહીં ગણાયો નથી — રકમોનું ક્યારેય રૂપાંતર થતું નથી.} other {બીજી કરન્સીમાં # ખર્ચ અહીં ગણાયા નથી — રકમોનું ક્યારેય રૂપાંતર થતું નથી.}}',
  'insights.private': 'આ ફોન પર ગણતરી થાય છે — કશું અપલોડ થતું નથી.',

  'insights.spent.title':
    '{range, select, this_month {આ મહિને તમે ખર્ચ્યું} last_3_months {છેલ્લા 3 મહિનામાં તમે ખર્ચ્યું} this_year {આ વર્ષે તમે ખર્ચ્યું} other {તમે શરૂ કર્યું ત્યારથી તમે ખર્ચ્યું}}',
  'insights.spent.note': '{count, plural, one {# ખર્ચમાં} other {# ખર્ચોમાં}} તમારો હિસ્સો',
  'insights.spent.top': '{category} પર {percent}%',
  'insights.stat.paid': 'તમે આગળથી ચૂકવ્યું',
  'insights.stat.perMonth': 'મહિને લગભગ',

  'insights.category.title': 'કેટેગરી પ્રમાણે',
  'insights.chart.spent': 'ખર્ચ',
  'insights.category.aria': 'કેટેગરી પ્રમાણે ખર્ચ',
  'insights.month.title': 'મહિના પ્રમાણે',
  'insights.month.last': 'છેલ્લા {count} મહિના',
  'insights.month.aria': 'મહિના પ્રમાણે ખર્ચ',
  'insights.month.header': 'મહિનો',
  'insights.people.title': 'કોની સાથે વહેંચ્યું',
  'insights.people.description': 'દરેક વ્યક્તિ સાથે વહેંચેલામાં તમારો હિસ્સો',
  'insights.people.count': '{count, plural, one {# વહેંચેલો ખર્ચ} other {# વહેંચેલા ખર્ચ}}',

  'insights.sample.aria': 'નમૂનો',
  'insights.locked.note':
    '{count, plural, one {તમે અત્યાર સુધીમાં # ખર્ચ વહેંચ્યો છે — બધું ક્યાં ગયું તે જુઓ.} other {તમે અત્યાર સુધીમાં # ખર્ચ વહેંચ્યા છે — બધું ક્યાં ગયું તે જુઓ.}}',
} as const satisfies Messages
