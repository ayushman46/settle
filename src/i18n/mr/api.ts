/** Marathi copy for messages from the server and the AI scan (what people see, never the server's own words). Keys: `api.<area>.<element>`. */
import type { Messages } from '../types'

export const api = {
  // What we tell people when a bill scan fails, by error code. Never the server's own words.
  'api.scan.error.bad_request': 'त्या फोटोमध्ये काहीतरी अडचण आली. दुसरा फोटो वापरून पहा.',
  'api.scan.error.unsupported_image': 'कृपया JPG किंवा PNG फोटो वापरा.',
  'api.scan.error.image_too_large': 'तो फोटो खूप मोठा आहे. लहान फोटो वापरा — किंवा त्याचा स्क्रीनशॉट घ्या.',
  'api.scan.error.not_a_bill': 'हे बिल वाटत नाही. संपूर्ण पावतीचा स्पष्ट फोटो घेऊन पहा.',
  'api.scan.error.unreadable': 'एकही वस्तू वाचता आली नाही. अधिक स्पष्ट, चांगल्या प्रकाशातील फोटो वापरा — किंवा वस्तू स्वतः टाइप करा.',
  'api.scan.error.not_configured': 'सध्या फोटो स्कॅन उपलब्ध नाही — तुम्ही वस्तू टाइप करू शकता.',
  'api.scan.error.upstream_auth': 'सध्या फोटो स्कॅन काम करत नाहीये — तुम्ही वस्तू टाइप करू शकता.',
  'api.scan.error.rate_limited': 'सध्या खूप स्कॅन होत आहेत. काही मिनिटांनी पुन्हा प्रयत्न करा — किंवा वस्तू टाइप करा.',
  'api.scan.error.timeout': 'बिल वाचायला खूप वेळ लागला. जवळून, स्पष्ट फोटो घेऊन पुन्हा प्रयत्न करा.',
  'api.scan.error.upstream_error': 'AI सेवेपर्यंत पोहोचता आले नाही. कृपया पुन्हा प्रयत्न करा.',
  'api.scan.error.network': 'तुम्ही ऑफलाइन असल्यासारखे दिसते. कनेक्शन तपासून पुन्हा प्रयत्न करा.',
  'api.scan.error.aborted': 'स्कॅन रद्द झाले.',
  // A short wait: the server is busy, nobody did anything wrong.
  'api.scan.busy': 'सध्या खूप बिले वाचली जात आहेत — थोड्या वेळाने पुन्हा प्रयत्न करा.',
  // A long wait; `{wait}` is "about 10 minutes" (api.wait.*).
  'api.scan.proLimit': 'आजची फेअर-यूज AI मर्यादा संपली आहे. ती {wait} मध्ये पुन्हा सुरू होईल — तरी तुम्ही वस्तू टाइप करू शकता.',
  'api.scan.limit': 'खूप स्कॅन झाले. {wait} नंतर पुन्हा प्रयत्न करा — किंवा वस्तू टाइप करा.',
  'api.scan.offline': 'तुम्ही ऑफलाइन आहात — तरी तुम्ही वस्तू टाइप करू शकता.',
  // A picked photo we can't use.
  'api.image.error.not_image': 'ती फाइल फोटो नाही. कृपया JPG किंवा PNG इमेज निवडा.',
  'api.image.error.decode_failed': 'ती इमेज उघडता आली नाही. JPG किंवा PNG वापरा — किंवा त्याचा स्क्रीनशॉट घ्या.',
  'api.image.error.too_large': 'तो फोटो खूप मोठा आहे (25 MB पेक्षा जास्त). लहान फोटो वापरा — किंवा त्याचा स्क्रीनशॉट घ्या.',
  // How long a wait is, rounded up.
  'api.wait.minute': 'सुमारे एक मिनिट',
  'api.wait.minutes': 'सुमारे {count} मिनिटे',
  'api.wait.hours': 'सुमारे {count} तास',
} as const satisfies Messages
