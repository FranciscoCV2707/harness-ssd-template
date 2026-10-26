// Servidor HTTP para la GUI orquestadora del harness SDD.
// Sin dependencias externas: solo modulos nativos de Node.
// Uso: node gui/server.js   (desde la raiz del proyecto)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const https = require('https');

const ROOT = process.cwd();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8765;
const IS_WIN = process.platform === 'win32';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

// --- donde viven .claude/skills ---
function claudeDir() {
  if (fs.existsSync(path.join(ROOT, '.claude'))) return path.join(ROOT, '.claude');
  if (fs.existsSync(path.join(ROOT, 'template', '.claude'))) return path.join(ROOT, 'template', '.claude');
  return path.join(ROOT, '.claude');
}
function skillsDir() { return path.join(claudeDir(), 'skills'); }
function agentsDir() { return path.join(claudeDir(), 'agents'); }
function assignmentsFile() { return path.join(claudeDir(), 'skill-assignments.json'); }

// --- deteccion de CLIs ---
const CLI_CANDIDATES = [
  { name: 'claude', cmd: 'claude', args: (p) => ['-p', p] },
  { name: 'codex', cmd: 'codex', args: (p) => ['exec', p] },
  { name: 'opencode', cmd: 'opencode', args: (p) => ['run', p] },
  { name: 'kilo', cmd: 'kilo', args: (p) => [p] },
  { name: 'vibe', cmd: 'vibe', args: (p) => ['-p', p] },
];
function which(cmd) {
  try {
    if (IS_WIN) {
      const r = execSync('where ' + cmd, { stdio: ['ignore','pipe','ignore'] }).toString().trim();
      return r.split(/\r?\n/)[0];
    } else {
      const r = execSync('command -v ' + cmd, { stdio: ['ignore','pipe','ignore'], shell: '/bin/sh' }).toString().trim();
      return r || null;
    }
  } catch (e) { return null; }
}
const AVAILABLE_CLIS = CLI_CANDIDATES.map(c => {
  const p = which(c.cmd);
  return p ? { name: c.name, cmd: c.cmd, path: p } : null;
}).filter(Boolean);

// --- procesos activos ---
const PROCESSES = new Map();
let procCounter = 0;
function wslPath(winPath) {
  return winPath.replace(/^([A-Za-z]):/, (_, d) => '/mnt/' + d.toLowerCase()).replace(/\\/g, '/');
}
function spawnCli(cliName, prompt) {
  const cand = CLI_CANDIDATES.find(c => c.name === cliName);
  if (!cand) throw new Error('CLI desconocido: ' + cliName);
  const id = 'p' + (++procCounter);
  const args = cand.args(prompt);
  let proc;
  if (IS_WIN) {
    // CLIs are Windows binaries (.exe); run them directly so PATH resolves.
    const bin = cand.path || cand.cmd;
    proc = spawn(bin, args, { cwd: ROOT, shell: false, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] });
  } else {
    proc = spawn(cand.cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  }
  const entry = { proc, listeners: [], output: '', status: 'running', cli: cliName, prompt };
  PROCESSES.set(id, entry);
  const push = (d) => {
    const txt = d.toString();
    entry.output += txt;
    entry.listeners.forEach(fn => fn(txt));
  };
  proc.stdout.on('data', push);
  proc.stderr.on('data', push);
  proc.on('close', (code) => {
    entry.status = 'done:' + code;
    entry.listeners.forEach(fn => fn('\n[exit code: ' + code + ']\n'));
    entry.listeners.forEach(fn => fn(null));
  });
  proc.on('error', (e) => {
    entry.status = 'error';
    entry.listeners.forEach(fn => fn('\nERROR: ' + e.message + '\n'));
    entry.listeners.forEach(fn => fn(null));
  });
  return id;
}

function safePath(rel) {
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT + path.sep) && full !== ROOT) return null;
  return full;
}

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(body);
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'harness-gui' } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        return resolve(httpsGet(r.headers.location));
      }
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => resolve({ status: r.statusCode, body: data, headers: r.headers }));
    }).on('error', reject);
  });
}

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  m[1].split('\n').forEach(line => {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  });
  return out;
}

// --- skills helpers ---
function listInstalledSkills() {
  const dir = skillsDir();
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const skillMd = path.join(dir, name, 'SKILL.md');
    if (fs.existsSync(skillMd)) {
      const text = fs.readFileSync(skillMd, 'utf8');
      const fm = parseFrontmatter(text);
      out.push({ name, description: fm.description || '', frontmatter: fm, path: path.relative(ROOT, skillMd) });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function loadCatalog() {
  const candidates = [path.join(ROOT, 'skills-catalog.json'), path.join(ROOT, 'template', 'skills-catalog.json')];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try { return JSON.parse(fs.readFileSync(c, 'utf8')); } catch (e) {}
    }
  }
  return { skills: [] };
}

function loadAssignments() {
  const f = assignmentsFile();
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return {}; }
}
function saveAssignments(obj) {
  const dir = path.dirname(assignmentsFile());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(assignmentsFile(), JSON.stringify(obj, null, 2), 'utf8');
}

async function fetchSkillFolder(repo, branch, skillName, destDir) {
  // list contents
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${skillName}?ref=${branch}`;
  const listing = await httpsGet(apiUrl);
  if (listing.status !== 200) throw new Error('No se pudo listar ' + skillName + ' (' + listing.status + ')');
  const items = JSON.parse(listing.body);
  fs.mkdirSync(destDir, { recursive: true });
  for (const item of items) {
    if (item.type === 'file') {
      const r = await httpsGet(item.download_url);
      if (r.status === 200) fs.writeFileSync(path.join(destDir, item.name), r.body, 'utf8');
    } else if (item.type === 'dir') {
      await fetchSkillFolder(repo, branch, skillName + '/' + item.name, path.join(destDir, item.name));
    }
  }
}

function appendGitignore(entries) {
  const gi = path.join(ROOT, '.gitignore');
  const tmpl = path.join(ROOT, 'template', '.gitignore');
  const target = fs.existsSync(gi) ? gi : (fs.existsSync(tmpl) ? tmpl : gi);
  let content = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  let changed = false;
  for (const e of entries) {
    if (!content.split(/\r?\n/).includes(e)) {
      content = content.trimEnd() + '\n' + e + '\n';
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(target, content, 'utf8');
  return changed;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // --- CLIs ---
  if (req.method === 'GET' && url.pathname === '/api/clis') {
    return send(res, 200, JSON.stringify(AVAILABLE_CLIS), 'application/json');
  }

  // --- features ---
  if (req.method === 'GET' && url.pathname === '/api/features') {
    const f = path.join(ROOT, 'feature_list.json');
    if (!fs.existsSync(f)) return send(res, 200, '[]', 'application/json');
    return send(res, 200, fs.readFileSync(f, 'utf8'), 'application/json');
  }
  if (req.method === 'POST' && url.pathname === '/api/features') {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try {
        JSON.parse(data);
        fs.writeFileSync(path.join(ROOT, 'feature_list.json'), data, 'utf8');
        send(res, 200, '{"ok":true}', 'application/json');
      } catch (e) {
        send(res, 400, JSON.stringify({ error: String(e) }), 'application/json');
      }
    });
    return;
  }

  // --- plan.md ---
  if (req.method === 'GET' && url.pathname === '/api/plan') {
    const f = path.join(ROOT, 'plan.md');
    if (!fs.existsSync(f)) return send(res, 200, '', 'text/plain');
    return send(res, 200, fs.readFileSync(f, 'utf8'));
  }
  if (req.method === 'POST' && url.pathname === '/api/plan') {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      fs.writeFileSync(path.join(ROOT, 'plan.md'), data, 'utf8');
      send(res, 200, '{"ok":true}', 'application/json');
    });
    return;
  }

  // --- generar plan ---
  if (req.method === 'POST' && url.pathname === '/api/generate-plan') {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      let input = '';
      try { input = JSON.parse(data).input || ''; } catch (e) {}
      const prompt = 'Eres el leader del harness SDD. PRIMERO lee el archivo plan-template.md en la raiz del proyecto y sigue SU estructura exacta. A partir del siguiente analisis/contexto, genera un plan.md. REGLAS OBLIGATORIAS: (1) Solo lineas a nivel superior que empiecen con "- [ ]" o "- [x]" o numero + punto. (2) Cada tarea DEBE tener entre parentesis el agente sugerido: (agente sugerido: implementer|reviewer|explorer|spec_author|leader). (3) Sub-tareas indentadas se ignoran. (4) Encabezados # no son tareas. (5) Una tarea por linea. (6) Descripciones concretas y verificables. Secciones: # Plan, ## Objetivo, ## Contexto, ## Fase N — <nombre> (con ### Tareas dentro), ## Notas. Puedes usar varias fases, cada una con su ### Tareas. Los bullets de tareas pueden estar bajo ### Tareas de cualquier fase.\n\nANALISIS DEL USUARIO:\n' + input;
      let id;
      try { id = spawnCli('claude', prompt); }
      catch (e) { return send(res, 400, JSON.stringify({ error: String(e) }), 'application/json'); }
      const entry = PROCESSES.get(id);
      entry.listeners = [ (chunk) => {
        if (chunk === null) {
          try { fs.writeFileSync(path.join(ROOT, 'plan.md'), entry.output, 'utf8'); } catch (e) {}
        }
      } ];
      send(res, 200, JSON.stringify({ id }), 'application/json');
    });
    return;
  }

  // --- lanzar agente ---
  if (req.method === 'POST' && url.pathname === '/api/run') {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(data); } catch (e) {}
      const cli = body.cli;
      const prompt = body.prompt || '';
      if (!cli || !prompt) return send(res, 400, JSON.stringify({ error: 'cli y prompt requeridos' }), 'application/json');
      let id;
      try { id = spawnCli(cli, prompt); }
      catch (e) { return send(res, 400, JSON.stringify({ error: String(e) }), 'application/json'); }
      send(res, 200, JSON.stringify({ id }), 'application/json');
    });
    return;
  }

  // --- streaming SSE ---
  const mStream = url.pathname.match(/^\/api\/stream\/(.+)$/);
  if (req.method === 'GET' && mStream) {
    const id = mStream[1];
    const entry = PROCESSES.get(id);
    if (!entry) return send(res, 404, 'not found');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    if (entry.output) res.write('data: ' + JSON.stringify(entry.output) + '\n\n');
    const listener = (chunk) => {
      if (chunk === null) { res.write('event: end\ndata: done\n\n'); res.end(); }
      else res.write('data: ' + JSON.stringify(chunk) + '\n\n');
    };
    entry.listeners.push(listener);
    req.on('close', () => { entry.listeners = entry.listeners.filter(l => l !== listener); });
    return;
  }

  // --- init.sh ---
  if (req.method === 'POST' && url.pathname === '/api/init') {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      let flag = '--full';
      try { flag = JSON.parse(data).flag || '--full'; } catch (e) {}
      if (flag !== '--fast' && flag !== '--full') flag = '--full';
      const INIT_REL = fs.existsSync(path.join(ROOT, 'init.sh')) ? 'init.sh' :
        (fs.existsSync(path.join(ROOT, 'template', 'init.sh')) ? 'template/init.sh' : null);
      if (!INIT_REL) return send(res, 404, JSON.stringify({ code: 1, output: 'init.sh no encontrado' }), 'application/json');
      let cmd, args, opts = {};
      if (IS_WIN) {
        const wslRoot = wslPath(ROOT);
        cmd = 'bash';
        args = ['-c', 'cd "' + wslRoot + '" && bash ' + INIT_REL + ' ' + flag];
      } else {
        cmd = 'bash';
        args = [INIT_REL, flag];
        opts = { cwd: ROOT };
      }
      const proc = spawn(cmd, args, opts);
      let out = '';
      proc.stdout.on('data', d => out += d);
      proc.stderr.on('data', d => out += d);
      proc.on('close', code => send(res, 200, JSON.stringify({ code, output: out }), 'application/json'));
      proc.on('error', e => send(res, 200, JSON.stringify({ code: 127, output: 'ERROR: ' + e.message }), 'application/json'));
    });
    return;
  }

  // --- file read ---
  if (req.method === 'GET' && url.pathname === '/api/file') {
    const rel = url.searchParams.get('path') || '';
    const full = safePath(rel);
    if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) return send(res, 404, 'not found');
    return send(res, 200, fs.readFileSync(full, 'utf8'));
  }

  // --- open terminal ---
  if (req.method === 'POST' && url.pathname === '/api/open-terminal') {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(data); } catch (e) {}
      const cli = body.cli || 'claude';
      const cand = CLI_CANDIDATES.find(c => c.name === cli);
      if (!cand) return send(res, 400, JSON.stringify({ error: 'CLI desconocido' }), 'application/json');
      try {
        if (IS_WIN) {
          spawn('cmd', ['/c', 'start', '', 'cmd', '/k', cand.cmd], { cwd: ROOT, detached: true, stdio: 'ignore' }).unref();
        } else {
          const terms = ['gnome-terminal', 'xterm', 'konsole', 'alacritty', 'kitty'];
          let launched = false;
          for (const t of terms) {
            try {
              const bin = execSync('command -v ' + t, { stdio: ['ignore','pipe','ignore'], shell: '/bin/sh' }).toString().trim();
              if (bin) { spawn(bin, ['--', cand.cmd], { cwd: ROOT, detached: true, stdio: 'ignore' }).unref(); launched = true; break; }
            } catch (e) {}
          }
          if (!launched) throw new Error('No se encontro terminal grafica. Lanza ' + cand.cmd + ' manualmente.');
        }
        send(res, 200, JSON.stringify({ ok: true }), 'application/json');
      } catch (e) {
        send(res, 400, JSON.stringify({ error: String(e) }), 'application/json');
      }
    });
    return;
  }

  // ===================== SKILLS API =====================

  // installed skills
  if (req.method === 'GET' && url.pathname === '/api/skills/installed') {
    return send(res, 200, JSON.stringify(listInstalledSkills()), 'application/json');
  }

  // catalog
  if (req.method === 'GET' && url.pathname === '/api/skills/catalog') {
    const cat = loadCatalog();
    const installed = new Set(listInstalledSkills().map(s => s.name));
    const out = (cat.skills || []).map(s => ({ ...s, installed: installed.has(s.name) }));
    return send(res, 200, JSON.stringify(out), 'application/json');
  }

  // agents list
  if (req.method === 'GET' && url.pathname === '/api/agents') {
    const dir = agentsDir();
    const out = [];
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.md')) out.push(f.replace(/\.md$/, ''));
      }
    }
    return send(res, 200, JSON.stringify(out), 'application/json');
  }

  // assignments
  if (req.method === 'GET' && url.pathname === '/api/skills/assignments') {
    return send(res, 200, JSON.stringify(loadAssignments()), 'application/json');
  }

  // install skill
  if (req.method === 'POST' && url.pathname === '/api/skills/install') {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', async () => {
      let body = {};
      try { body = JSON.parse(data); } catch (e) {}
      const name = (body.name || '').trim();
      const source = body.source || 'catalog'; // catalog | github | url
      const agents = Array.isArray(body.agents) ? body.agents : [];
      const stateDirs = Array.isArray(body.stateDirs) ? body.stateDirs : [];
      if (!name) return send(res, 400, JSON.stringify({ error: 'name requerido' }), 'application/json');
      // sanitize name
      if (!/^[a-zA-Z0-9._-]+$/.test(name)) return send(res, 400, JSON.stringify({ error: 'nombre invalido' }), 'application/json');
      const destDir = path.join(skillsDir(), name);
      try {
        if (source === 'catalog') {
          const cat = loadCatalog();
          const entry = (cat.skills || []).find(s => s.name === name);
          const repo = (body.repo || cat.repo || 'ComposioHQ/awesome-claude-skills');
          const branch = (body.branch || cat.branch || 'master');
          await fetchSkillFolder(repo, branch, name, destDir);
          // state dirs from catalog entry
          const dirs = (entry && entry.stateDirs) ? entry.stateDirs : stateDirs;
          if (dirs.length) appendGitignore(dirs);
        } else if (source === 'github') {
          const repo = body.repo;
          const branch = body.branch || 'master';
          const skillPath = body.path || name;
          if (!repo) return send(res, 400, JSON.stringify({ error: 'repo requerido' }), 'application/json');
          await fetchSkillFolder(repo, branch, skillPath, destDir);
          if (stateDirs.length) appendGitignore(stateDirs);
        } else if (source === 'url') {
          // install a single SKILL.md from url
          const r = await httpsGet(body.url);
          if (r.status !== 200) throw new Error('HTTP ' + r.status);
          fs.mkdirSync(destDir, { recursive: true });
          fs.writeFileSync(path.join(destDir, 'SKILL.md'), r.body, 'utf8');
        } else {
          return send(res, 400, JSON.stringify({ error: 'source invalido' }), 'application/json');
        }
        // verify SKILL.md exists
        if (!fs.existsSync(path.join(destDir, 'SKILL.md'))) {
          throw new Error('SKILL.md no encontrado tras la instalacion');
        }
        // assignments
        if (agents.length) {
          const a = loadAssignments();
          const cur = new Set(a[name] || []);
          agents.forEach(ag => cur.add(ag));
          a[name] = Array.from(cur);
          saveAssignments(a);
          // append reference to agent md files
          for (const ag of agents) {
            const mdPath = path.join(agentsDir(), ag + '.md');
            if (fs.existsSync(mdPath)) {
              const txt = fs.readFileSync(mdPath, 'utf8');
              const marker = `\n\n## Skills asignadas\n`;
              if (!txt.includes('## Skills asignadas')) {
                fs.appendFileSync(mdPath, marker + `- ${name}\n`, 'utf8');
              } else if (!txt.includes(`- ${name}`)) {
                // append to existing section (simple: add line after marker)
                fs.writeFileSync(mdPath, txt.replace(marker, marker + `- ${name}\n`), 'utf8');
              }
            }
          }
        }
        // gitignore for known state dirs from catalog
        const cat = loadCatalog();
        const centry = (cat.skills || []).find(s => s.name === name);
        if (centry && centry.stateDirs && centry.stateDirs.length) appendGitignore(centry.stateDirs);
        send(res, 200, JSON.stringify({ ok: true, name, path: path.relative(ROOT, destDir) }), 'application/json');
      } catch (e) {
        // cleanup partial
        try { if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true }); } catch (x) {}
        send(res, 400, JSON.stringify({ error: String(e) }), 'application/json');
      }
    });
    return;
  }

  // uninstall skill
  if (req.method === 'POST' && url.pathname === '/api/skills/uninstall') {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(data); } catch (e) {}
      const name = (body.name || '').trim();
      if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) return send(res, 400, JSON.stringify({ error: 'nombre invalido' }), 'application/json');
      const destDir = path.join(skillsDir(), name);
      try {
        if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
        // remove from assignments
        const a = loadAssignments();
        if (a[name]) { delete a[name]; saveAssignments(a); }
        send(res, 200, JSON.stringify({ ok: true }), 'application/json');
      } catch (e) {
        send(res, 400, JSON.stringify({ error: String(e) }), 'application/json');
      }
    });
    return;
  }

  // assign skill to agents
  if (req.method === 'POST' && url.pathname === '/api/skills/assign') {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(data); } catch (e) {}
      const skill = (body.skill || '').trim();
      const agents = Array.isArray(body.agents) ? body.agents : [];
      if (!skill) return send(res, 400, JSON.stringify({ error: 'skill requerido' }), 'application/json');
      const a = loadAssignments();
      a[skill] = agents;
      saveAssignments(a);
      send(res, 200, JSON.stringify({ ok: true }), 'application/json');
    });
    return;
  }

  // --- shutdown ---
  if (req.method === 'POST' && url.pathname === '/api/shutdown') {
    send(res, 200, '{"ok":true}', 'application/json');
    setTimeout(() => process.exit(0), 300);
    return;
  }

  // --- tasks persistence ---
  if (req.method === 'GET' && url.pathname === '/api/tasks') {
    const f = path.join(ROOT, 'tasks.json');
    if (!fs.existsSync(f)) return send(res, 200, '[]', 'application/json');
    return send(res, 200, fs.readFileSync(f, 'utf8'), 'application/json');
  }
  if (req.method === 'POST' && url.pathname === '/api/tasks') {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try { JSON.parse(data); fs.writeFileSync(path.join(ROOT, 'tasks.json'), data, 'utf8'); send(res, 200, '{"ok":true}', 'application/json'); }
      catch (e) { send(res, 400, JSON.stringify({ error: String(e) }), 'application/json'); }
    });
    return;
  }

  // --- estaticos ---
  let rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const guiCandidate = path.join(ROOT, 'gui', rel);
  if (fs.existsSync(guiCandidate) && fs.statSync(guiCandidate).isFile()) {
    const ext = path.extname(guiCandidate).toLowerCase();
    return send(res, 200, fs.readFileSync(guiCandidate), MIME[ext] || 'application/octet-stream');
  }
  const full = safePath(rel);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) return send(res, 404, 'not found');
  const ext = path.extname(full).toLowerCase();
  send(res, 200, fs.readFileSync(full), MIME[ext] || 'application/octet-stream');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('Puerto ' + PORT + ' en uso. Cierra otros procesos node y reintenta.');
    process.exit(1);
  }
  console.error(e);
  process.exit(1);
});
server.listen(PORT, () => {
  console.log('Harness Orchestrator GUI: http://localhost:' + PORT);
  console.log('CLIs disponibles:', AVAILABLE_CLIS.map(c => c.name).join(', ') || '(ninguno)');
  console.log('Skills dir:', skillsDir());
  console.log('Root:', ROOT);
});
