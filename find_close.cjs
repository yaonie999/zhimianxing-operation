const fs = require('fs');
const content = fs.readFileSync('C:/Users/yaoni/AppData/Roaming/LobsterAI/openclaw/state/workspace-70b7e8d0-6d89-4e06-8575-86960d94f4d3/zhimianxing-operation/src/pages/MemberListPage.jsx', 'utf8');
const lines = content.split('\n');
// Find the closing brace of MultiSelectFilter
// MultiSelectFilter starts at line 50
// We need to find where it ends - look for the closing }
let braceCount = 0;
let inFunction = false;
let funcName = '';
for(let i=49;i<lines.length;i++) {
  const line = lines[i];
  for(const ch of line) {
    if(ch === '{') { braceCount++; inFunction = true; }
    if(ch === '}') { braceCount--; if(braceCount === 0 && inFunction) { console.log('Function closes at line', i+1, ':', line.trim()); inFunction = false; } }
  }
  if(i < 70 || (i > 100 && i < 115)) {
    console.log('Line ' + (i+1) + ' (brace=' + braceCount + '): ' + line.trim().slice(0,80));
  }
}
