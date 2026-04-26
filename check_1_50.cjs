const fs = require('fs');
const content = fs.readFileSync('C:/Users/yaoni/AppData/Roaming/LobsterAI/openclaw/state/workspace-70b7e8d0-6d89-4e06-8575-86960d94f4d3/zhimianxing-operation/src/pages/MemberListPage.jsx', 'utf8');
const lines = content.split('\n');
// Show lines 1-15
console.log('Lines 1-15:');
for(let i=0;i<15;i++) {
  console.log((i+1) + ': ' + lines[i]);
}
console.log('\nLines 44-60:');
for(let i=43;i<60;i++) {
  console.log((i+1) + ': ' + lines[i]);
}
