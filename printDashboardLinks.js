const fs = require('fs');
const path = require('path');

// Change this if your app URL ever changes
const BASE_URL = 'https://local-ai-helper.onrender.com';

const businessesPath = path.join(__dirname, 'businesses.json');

if (!fs.existsSync(businessesPath)) {
  console.error('❌ businesses.json not found');
  process.exit(1);
}

const raw = fs.readFileSync(businessesPath, 'utf8') || '{}';
let businesses;

try {
  businesses = JSON.parse(raw);
} catch (err) {
  console.error('❌ Error parsing businesses.json:', err.message);
  process.exit(1);
}

console.log('\n=== Dashboard Links ===\n');

for (const [siteId, biz] of Object.entries(businesses)) {
  if (!biz.token) {
    console.log(`(Skipping ${siteId} - no token set)\n`);
    continue;
  }

  const url = `${BASE_URL}/admin/leads?siteId=${encodeURIComponent(
    siteId
  )}&token=${encodeURIComponent(biz.token)}`;

  console.log(`${biz.name} (${siteId}):`);
  console.log(`  ${url}\n`);
}
