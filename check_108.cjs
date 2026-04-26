const fs = require('fs');
const content = fs.readFileSync('C:/Users/yaoni/AppData/Roaming/LobsterAI/openclaw/state/workspace-70b7e8d0-6d89-4e06-8575-86960d94f4d3/zhimianxing-operation/src/pages/MemberListPage.jsx', 'utf8');
const lines = content.split('\n');
console.log('Lines 100-115:');
for(let i=99;i<115;i++) {
  console.log((i+1) + ': ' + lines[i]);
}
