import * as FileSystem from 'expo-file-system/legacy';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';

const RECEIPT_SCHEMA = {
  name: 'receipt',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      store: { type: ['string', 'null'], description: 'Namnet på butiken/restaurangen' },
      date: { type: ['string', 'null'], description: 'Köpdatum i ISO-format YYYY-MM-DD' },
      currency: { type: ['string', 'null'], description: 'ISO 4217-valutakod, t.ex. SEK, EUR, JPY, USD' },
      total: { type: ['number', 'null'], description: 'Totalsumma inklusive moms' },
      card: { type: ['string', 'null'], description: 'Kort som använts, t.ex. "Visa ****1234" eller "Kontant"' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name_original: { type: ['string', 'null'], description: 'Varans namn exakt som det står på kvittot' },
            name_sv: { type: ['string', 'null'], description: 'Varans namn översatt till svenska' },
            price: { type: ['number', 'null'], description: 'Radens totalpris' },
            quantity: { type: ['number', 'null'], description: 'Antal (1 om ej angivet)' },
          },
          required: ['name_original', 'name_sv', 'price', 'quantity'],
        },
      },
    },
    required: ['store', 'date', 'currency', 'total', 'card', 'items'],
  },
};

const SYSTEM_PROMPT = `Du är en expert på att tolka kvitton från hela världen.
Extrahera från bilden:
- Butikens namn
- Köpdatum i ISO-format YYYY-MM-DD (om året saknas, anta innevarande år)
- Valuta som ISO 4217-kod (SEK, EUR, USD, JPY, DKK, NOK, GBP, etc.)
- Totalsumma (inklusive moms)
- Vilket kort som använts om det står (t.ex. "Visa ****1234", "Mastercard", "Kontant")
- Varje rad/vara med originalnamn, svensk översättning, pris och antal

Översätt varunamn till naturlig svenska. Behåll varumärken oöversatta.
Om ett fält inte går att läsa, returnera null för det fältet.
Returnera alltid "items" som en array (tom array om inga varor syns).`;

async function toDataUri(imageUri) {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${base64}`;
}

export async function parseReceiptImage({ apiKey, imageUri }) {
  if (!apiKey) throw new Error('OpenAI API-nyckel saknas. Lägg till den i Inställningar.');

  const dataUri = await toDataUri(imageUri);

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Tolka detta kvitto och returnera som strukturerad JSON.' },
          { type: 'image_url', image_url: { url: dataUri, detail: 'high' } },
        ],
      },
    ],
    response_format: { type: 'json_schema', json_schema: RECEIPT_SCHEMA },
    temperature: 0,
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message || JSON.stringify(j);
    } catch {
      detail = await res.text();
    }
    throw new Error(`OpenAI-fel (${res.status}): ${detail}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Tomt svar från OpenAI.');

  try {
    return JSON.parse(content);
  } catch {
    throw new Error('Kunde inte tolka OpenAI-svaret som JSON.');
  }
}
