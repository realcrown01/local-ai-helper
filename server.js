const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ---- Check API key ----
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY in .env');
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

// ---- Static files (public folder) ----
const publicDir = path.join(__dirname, 'public');
console.log('Serving static files from:', publicDir);
app.use(express.static(publicDir));

// Explicit route for widget.js (extra safety)
app.get('/widget.js', (req, res) => {
  const widgetPath = path.join(publicDir, 'widget.js');
  console.log('Serving widget.js from:', widgetPath);
  res.sendFile(widgetPath);
});

// ---- Load business profiles ----
const businessesPath = path.join(__dirname, 'businesses.json');
let businesses = {};

if (fs.existsSync(businessesPath)) {
  try {
    const raw = fs.readFileSync(businessesPath, 'utf8') || '{}';
    businesses = JSON.parse(raw);
    console.log('Loaded businesses:', Object.keys(businesses));
  } catch (err) {
    console.error('❌ Error parsing businesses.json:', err.message);
    businesses = {};
  }
} else {
  console.error('❌ businesses.json not found');
}

// ---- Lead storage helper ----
function saveLead(lead, leadFileName) {
  try {
    const filePath = path.join(__dirname, leadFileName);
    let leads = [];

    if (fs.existsSync(filePath)) {
      leads = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
    }

    leads.push({
      ...lead,
      createdAt: new Date().toISOString(),
    });

    fs.writeFileSync(filePath, JSON.stringify(leads, null, 2));
    console.log(`✅ Lead saved to ${leadFileName}`, lead);
  } catch (err) {
    console.error('❌ Error saving lead:', err);
  }
}

// ---------- Health check ----------
app.get('/health', (req, res) => {
  res.send('OK');
});

// ---------- Leads dashboard HTML helper ----------
function renderLeadsHTML(leads, biz, siteId) {
  const rows = leads
    .map((lead) => {
      return `
        <tr>
          <td>${lead.name || ''}</td>
          <td>${lead.phone || ''}</td>
          <td>${lead.zip || ''}</td>
          <td>${lead.issue || ''}</td>
          <td>${lead.createdAt ? new Date(lead.createdAt).toLocaleString() : ''}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Leads - ${biz.name}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 900px;
          margin: 40px auto;
        }
        h1 {
          margin-bottom: 5px;
        }
        .subtitle {
          color: #666;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          font-size: 14px;
        }
        th {
          background: #f5f5f5;
          text-align: left;
        }
        tr:nth-child(even) {
          background: #fafafa;
        }
        .no-leads {
          margin-top: 20px;
          color: #888;
        }
        .site-id {
          font-size: 13px;
          color: #999;
          margin-bottom: 20px;
        }
        .hint {
          font-size: 12px;
          color: #777;
          margin-top: 12px;
        }
      </style>
    </head>
    <body>
      <h1>Leads for ${biz.name}</h1>
      <div class="site-id">siteId: <code>${siteId}</code></div>
      <div class="subtitle">${biz.location}</div>

      ${
        leads.length === 0
          ? '<div class="no-leads">No leads yet for this business.</div>'
          : `
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Zip</th>
              <th>Issue</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `
      }

      <div class="hint">
        Change <code>?siteId=...</code> in the URL to view leads for another business
        (e.g. <code>?siteId=roofing-pros</code>).
      </div>
    </body>
    </html>
  `;
}

// ---------- Leads dashboard route ----------
app.get('/admin/leads', (req, res) => {
  const siteId = req.query.siteId || 'demo-plumber';
  const biz = businesses[siteId];

  if (!biz) {
    return res
      .status(404)
      .send(`Unknown business for siteId "${siteId}". Check businesses.json.`);
  }

  const leadFileName = biz.leadFile || `leads_${siteId}.json`;
  const filePath = path.join(__dirname, leadFileName);

  let leads = [];
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8') || '[]';
      leads = JSON.parse(raw);
    } catch (err) {
      console.error('❌ Error reading leads file:', err);
    }
  }

  const html = renderLeadsHTML(leads, biz, siteId);
  res.send(html);
});

// ---------- /chat endpoint ----------
app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    const history = req.body.history || [];
    const siteId = req.body.siteId || 'demo-plumber';

    if (!userMessage) {
      return res.status(400).json({ error: 'No message provided.' });
    }

    const biz = businesses[siteId];
    if (!biz) {
      console.log(`⚠️ No business found for siteId: ${siteId}`);
      return res.json({
        reply: 'Sorry, this business is not configured yet.',
      });
    }

    // Build business info text from the JSON
    const businessInfo = `
Business name: ${biz.name}
Location / service area: ${biz.location}

Services (ONLY these are guaranteed):
${biz.services.map((s) => '- ' + s).join('\n')}

Pricing (rough guidance, never quote exact unless clearly stated):
${Object.entries(biz.pricing)
  .map(([k, v]) => `- ${v}`)
  .join('\n')}

Hours:
${biz.hours}

Rules / Notes:
${biz.rules.map((r) => '- ' + r).join('\n')}
    `;

    const systemPrompt = `
You are the website assistant for a LOCAL SERVICE BUSINESS.

BUSINESS INFO (SOURCE OF TRUTH):
${businessInfo}

VERY IMPORTANT RULES — DO NOT BREAK THESE:
1. You MUST NOT say the business offers a service if it is not clearly included in the "Services" list above.
2. If the user asks about something that is not obviously part of those services, you MUST respond cautiously, for example:
   - "From what I can see, we focus on: ${biz.services.join(
     ', '
   )}. I don't see that specific service listed, so we may not offer it. Please call the office to confirm."
3. DO NOT invent or promise:
   - Extra services
   - Special warranties
   - Financing
   - New locations
   - Exact prices that are not clearly given in the info above
4. Only mention same-day or emergency service IF the business info or rules clearly mention it (e.g. if "emergency" or "same-day" is in services or rules). If it is not explicitly listed, do NOT talk about same-day or emergency promises.
5. If you're unsure whether something is offered, say you're not sure and suggest they call or that someone from the team will confirm.

CONVERSATION GOALS:
- Be friendly, concise, and professional.
- Help visitors understand what the business can do based ONLY on the info above.
- Your main goal is to turn visitors into leads.

LEAD COLLECTION:
1. Collect these four details (if missing):
   - customer's name
   - phone number
   - address or zip code
   - short description of the issue
2. Only ask for details that are STILL missing.
   - If you already know their name from earlier messages, DO NOT ask for it again.
   - If you already know their phone from earlier messages, DO NOT ask for it again.
   - Same for zip/address and issue description.
3. Once you have ALL FOUR items:
   - Briefly confirm their details.
   - Move the conversation toward scheduling (time, day, etc.), being careful NOT to promise same-day/emergency unless clearly allowed.
   - On the LAST line of your reply, add a hidden machine-readable summary in format like:
       LEAD: name=John Smith | phone=555-555-5555 | zip=12345 | issue=clogged drain in kitchen
     or at least:
       name=John Smith | phone=555-555-5555 | zip=12345 | issue=clogged drain in kitchen
   - Do NOT explain this LEAD line. The user should not see it as something special.

GENERAL BEHAVIOR:
- If you do not know something from the business info, say you are not sure and suggest calling the business.
- If the user asks "what do you do" or "what kind of business is this", answer ONLY using the Services and other info above.
- Keep responses short and helpful, focused on solving their problem and capturing the lead details.
    `;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    console.log('\n==== Incoming request ====');
    console.log('Site ID:', siteId);
    console.log('User message:', userMessage);
    console.log('History length:', history.length);

    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages,
    });

    let aiReply = completion.choices[0].message.content || '';

    console.log('AI raw reply:\n', aiReply, '\n---');

    // ---------- Detect lead line ----------
    // Accept either:
    //   LEAD: name=... | phone=... | zip=... | issue=...
    // or just:
    //   name=... | phone=... | zip=... | issue=...
    const leadMatch = aiReply.match(/(LEAD:\s*)?name=.*$/mi);

    if (leadMatch) {
      let rawLine = leadMatch[0].trim();
      rawLine = rawLine.replace(/^LEAD:\s*/i, ''); // remove optional LEAD:
      const parts = rawLine.split('|').map((p) => p.trim());

      const lead = {};
      parts.forEach((part) => {
        const [key, value] = part.split('=').map((x) => x.trim());
        if (key && value) {
          lead[key.toLowerCase()] = value;
        }
      });

      if (lead.name && lead.phone) {
        const leadFileName = biz.leadFile || `leads_${siteId}.json`;

        saveLead(lead, leadFileName);
      } else {
        console.log('⚠️ Lead line found, but missing name or phone:', lead);
      }

      // Remove the lead line from what the user sees
      aiReply = aiReply.replace(/(LEAD:\s*)?name=.*$/mi, '').trim();

      // Optional: add visible confirmation
      aiReply +=
        '\n\nI have your details and will pass them to the team so they can contact you shortly.';
    }

    res.json({ reply: aiReply });
  } catch (err) {
    console.error('Error in /chat:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------- Start server ----------
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
