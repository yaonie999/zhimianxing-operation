const fs = require('fs');
const content = fs.readFileSync('C:/Users/yaoni/AppData/Roaming/LobsterAI/openclaw/state/workspace-70b7e8d0-6d89-4e06-8575-86960d94f4d3/zhimianxing-operation/src/pages/MemberListPage.jsx', 'utf8');
const lines = content.split('\n');
// Show lines 85-108
console.log('Lines 85-108:');
for(let i=84;i<108;i++) {
  console.log((i+1) + ': ' + lines[i]);
}
// Count braces in lines 1-108
let open = 0, close = 0, openParen = 0, closeParen = 0;
for(let i=0;i<107;i++) {
  const line = lines[i];
  for(const ch of line) {
    if(ch === '{') open++;
    if(ch === '}') close++;
    if(ch === '(') openParen++;
    if(ch === ')') closeParen++;
  }
}
console.log('\nBraces balance at line 107: { open=' + open + ' close=' + close + ' diff=' + (open-close));
console.log('Parens balance at line 107: ( open=' + openParen + ' close=' + closeParen + ' diff=' + (openParen-closeParen));
// Count in ENTIRE file
let aopen=0, aclose=0;
for(const ch of content) { if(ch==='{') aopen++; if(ch==='}') aclose++; }
console.log('\nWhole file: { open=' + aopen + ' close=' + aclose + ' diff=' + (aopen-aclose));
