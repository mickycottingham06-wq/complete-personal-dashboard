// Generates .claude/agents/<id>.md (Claude Code project subagents) from the
// canonical definitions in api/_specialists.js.
//   node tools/sync-agents.mjs          write/update the files
//   node tools/sync-agents.mjs --check  exit 1 if any file is missing or out of date
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECIALISTS, ROLE_IDS, agentBody } from '../api/_specialists.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.claude', 'agents');
const check = process.argv.includes('--check');

function render(id) {
  const s = SPECIALISTS[id];
  return [
    '---',
    'name: ' + id,
    'description: ' + s.description,
    'tools: ' + s.tools,
    '---',
    '<!-- Generated from api/_specialists.js by tools/sync-agents.mjs — edit the source, then run `npm run agents:sync`. -->',
    '',
    agentBody(id),
    '',
  ].join('\n');
}

let stale = [];
if (!check) fs.mkdirSync(dir, { recursive: true });
for (const id of ROLE_IDS) {
  const file = path.join(dir, id + '.md');
  const want = render(id);
  const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
  if (have === want) continue;
  if (check) stale.push(id);
  else { fs.writeFileSync(file, want); console.log('wrote ' + path.relative(root, file)); }
}
const extra = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !ROLE_IDS.includes(f.slice(0, -3))) : [];
if (check) {
  if (stale.length || extra.length) { console.error('Out of sync: ' + stale.concat(extra).join(', ') + ' — run npm run agents:sync'); process.exit(1); }
  console.log('Subagents in sync (' + ROLE_IDS.length + ').');
}
