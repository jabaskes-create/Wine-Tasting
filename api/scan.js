// Vercel serverless function: POST /api/scan
// Body: { images: ["data:image/jpeg;base64,...", ...] }  (1 to 3 photos of one bottle)
// Reply: { wine: { name, producer, vintage, type, grapes, country, region, appellation, abv, volume } }
//
// Vercel project settings, Environment Variables:
//   ANTHROPIC_API_KEY  (required)  your Anthropic API key
//   SCAN_PASSCODE      (used only while accounts are off) any phrase you choose
//   FIREBASE_API_KEY   (turns accounts on) Firebase web API key; scans then need a signed-in, approved user
//   ALLOWED_EMAILS     comma-separated emails allowed to scan, or * for any signed-in user
//   ANTHROPIC_MODEL    (optional)  defaults to claude-sonnet-5-5

const crypto = require('crypto');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const TYPES = ['red', 'white', 'rosé', 'sparkling', 'orange', 'dessert'];
const MAX_IMAGES = 3;
const MAX_IMAGE_CHARS = 3000000; // base64 characters per photo

const SYSTEM = [
  'You read photographs of wine bottle labels (front and back) and record only what is printed on the label.',
  'Rules:',
  '1. If a detail is not printed on the label, return an empty string for it. Never guess and never fill gaps from general knowledge.',
  '2. name is the wine\'s own name: a brand or cuvée name. If the label has no separate brand or cuvée name, use the appellation name (for example "Riviera Ligure di Ponente") without DOC or DOCG and without the grape. Never use a grape name on its own as the name when an appellation is printed. If a handwritten or signature-style name appears, use it as the name only when you can read it clearly; otherwise fall back to the appellation.',
  '3. grapes: a grape (varietal) name printed on the label, such as "Pigato", "Vermentino" or "Sangiovese 100%", belongs in grapes, not in name. Do not infer grapes from the appellation. Many European labels print no grape, so an empty string is common.',
  '4. producer is the winery, estate or house. It may appear only as a logo or in small print, so read logos and small text carefully. Words such as "vino biologico", "organic", "bio" or "product of Italy" are not the name, producer or appellation.',
  '5. appellation is the official designation: the protected name plus its quality level, using the standard abbreviation. "Denominazione di Origine Controllata" means DOC, "Denominazione di Origine Controllata e Garantita" means DOCG, "Indicazione Geografica Tipica" means IGT, "Appellation d\'Origine Contrôlée" means AOC, "Denominación de Origen" means DO. Example: "Riviera Ligure di Ponente DOC".',
  '6. country and region: record what is printed. You may set country when a legal designation makes it certain (DOC or DOCG means Italy, AOC means France, DO or DOCa means Spain). Leave region empty unless it is printed.',
  '7. vintage is a four-digit year, or NV if the label says non-vintage or multi-vintage. Empty string if neither appears.',
  '8. type is one of red, white, rosé, sparkling, orange, dessert. Use label cues such as "Brut", "Rosé" or "Spumante"; empty string if unclear.',
  '9. abv is the alcohol percentage as a plain number such as 13.5. volume is millilitres as a plain number such as 750 (convert 75 cl to 750).',
  '10. Copy names exactly as printed, keeping accents and original spelling.',
