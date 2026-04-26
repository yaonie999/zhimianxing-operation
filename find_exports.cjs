const fs = require('fs');
const content = fs.readFileSync('C:/Users/yaoni/AppData/Roaming/LobsterAI/openclaw/state/workspace-70b7e8d0-6d89-4e06-8575-86960d94f4d3/zhimianxing-operation/src/pages/MemberListPage.jsx', 'utf8');
// Find all function definitions
let idx = 0;
let count = 0;
while(count < 30) {
  idx = content.indexOf('function ', idx);
  if(idx < 0) break;
  const lineNum = content.slice(0, idx).split('\n').length;
  const fnName = content.slice(idx+9, idx+50).match(/^\w+/)?.[0];
  console.log('function ' + fnName + ' at line ' + lineNum + ' pos ' + idx);
  idx++;
  count++;
}
console.log('\nLooking for export default:');
idx = 0;
while(idx < content.length) {
  const idx2 = content.indexOf('export default', idx);
  if(idx2 < 0) break;
  const lineNum = content.slice(0, idx2).split('\n').length;
  console.log('export default at line', lineNum, ':', content.slice(idx2, idx2+80).replace(/\n/g, ' '));
  idx = idx2 + 1;
}
