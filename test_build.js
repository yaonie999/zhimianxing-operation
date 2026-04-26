const esbuild = require('./node_modules/esbuild');
const fs = require('fs');
const filePath = 'C:/Users/yaoni/AppData/Roaming/LobsterAI/openclaw/state/workspace-70b7e8d0-6d89-4e06-8575-86960d94f4d3/zhimianxing-operation/src/pages/MemberListPage.jsx';
const code = fs.readFileSync(filePath, 'utf8');
try {
  const result = esbuild.transformSync(code, { loader: 'jsx', jsx: 'automatic' });
  console.log('OK: ' + result.code.length + ' bytes');
} catch(e) {
  console.log('ERROR: ' + e.message.split('\n')[0]);
}
