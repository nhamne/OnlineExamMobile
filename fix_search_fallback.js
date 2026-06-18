const fs = require('fs');

let code = fs.readFileSync('OnlineExamBe/index.js', 'utf8');

// Replace empty array return with throw
const regex = /if\s*\(\s*hits\.length\s*===\s*0\s*\)\s*\{\s*return\s*res\.json\(\{\s*results:\s*\[\]\s*\}\);\s*\}/g;

const replacement = `if (hits.length === 0) {
        throw new Error('Meilisearch index empty, using SQL fallback');
      }`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('OnlineExamBe/index.js', code);
    console.log('Patched search fallback logic');
} else {
    console.log('Search fallback logic not found or already patched');
}
