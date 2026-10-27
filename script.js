const terminal = document.getElementById('terminal');
const output = document.getElementById('output');
const input = document.getElementById('input');
const promptEl = document.getElementById('prompt');
const titleEl = document.getElementById('title');

const THEMES = ['green', 'amber', 'dracula', 'light'];
const history = [];
let historyIndex = 0;
let cwd = []; // path segments relative to ~

// ---------- helpers ----------

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function linkify(text) {
  return escapeHtml(text)
    .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`)
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, (email) => `<a href="mailto:${email}">${email}</a>`);
}

function print(html = '', className = '') {
  const line = document.createElement('div');
  if (className) line.className = className;
  line.innerHTML = html;
  output.appendChild(line);
}

function printText(text, className) {
  print(linkify(text), className);
}

function cmdLink(cmd, label = cmd) {
  return `<a href="#" data-cmd="${escapeHtml(cmd)}">${escapeHtml(label)}</a>`;
}

function cwdString() {
  return '~' + cwd.map((s) => '/' + s).join('');
}

function promptHtml() {
  return `<span class="user">${SITE.user}@${SITE.host}</span>:<span class="path">${escapeHtml(cwdString())}</span>$ `;
}

function renderPrompt() {
  promptEl.innerHTML = promptHtml();
  titleEl.textContent = `${SITE.user}@${SITE.host}: ${cwdString()}`;
}

function scrollToBottom() {
  terminal.scrollTop = terminal.scrollHeight;
}

// ---------- virtual filesystem ----------

function resolve(path = '') {
  const segs = path.startsWith('~') || path.startsWith('/') ? [] : [...cwd];
  for (const part of path.replace(/^~/, '').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') segs.pop();
    else segs.push(part);
  }
  return segs;
}

function getNode(segs) {
  let node = SITE.files;
  for (const seg of segs) {
    if (typeof node !== 'object' || !(seg in node)) return undefined;
    node = node[seg];
  }
  return node;
}

const isDir = (node) => typeof node === 'object';

function sortedEntries(dir) {
  return Object.keys(dir).sort((a, b) => isDir(dir[b]) - isDir(dir[a]) || a.localeCompare(b));
}

function entryHtml(name, node, base) {
  const path = base ? `${base}/${name}` : name;
  return isDir(node)
    ? `<span class="dir">${cmdLink('cd ' + path, name + '/')}</span>`
    : cmdLink('cat ' + path, name);
}

// ---------- commands ----------

const commands = {
  help: {
    desc: 'show this help',
    run() {
      const rows = Object.entries(commands)
        .filter(([, c]) => !c.hidden)
        .map(([name, c]) => `<span>${cmdLink(name)}</span><span class="muted">${c.desc}</span>`)
        .join('');
      print(`<div class="cmd-table">${rows}</div>`);
      print('<span class="muted">Tab autocompletes, ↑/↓ browse history, Ctrl+L clears. Click anything underlined.</span>');
    },
  },

  ls: {
    desc: 'list directory contents',
    run(args) {
      const target = args.find((a) => !a.startsWith('-'));
      const node = getNode(resolve(target));
      if (node === undefined) return printText(`ls: cannot access '${target}': No such file or directory`, 'error');
      if (!isDir(node)) return printText(target);
      const base = target ? target.replace(/\/$/, '') : '';
      print(`<div class="ls">${sortedEntries(node).map((n) => `<span>${entryHtml(n, node[n], base)}</span>`).join('')}</div>`);
    },
  },

  cd: {
    desc: 'change directory',
    run([target = '~']) {
      const segs = resolve(target);
      const node = getNode(segs);
      if (node === undefined) return printText(`cd: ${target}: No such file or directory`, 'error');
      if (!isDir(node)) return printText(`cd: ${target}: Not a directory`, 'error');
      cwd = segs;
    },
  },

  cat: {
    desc: 'print file contents',
    run(args) {
      if (!args.length) return printText('cat: missing file operand', 'error');
      for (const target of args) {
        const node = getNode(resolve(target));
        if (node === undefined) printText(`cat: ${target}: No such file or directory`, 'error');
        else if (isDir(node)) printText(`cat: ${target}: Is a directory`, 'error');
        else printText(node);
      }
    },
  },

  tree: {
    desc: 'show directory tree',
    run() {
      const lines = ['<span class="dir">~</span>'];
      const walk = (dir, prefix, base) => {
        const names = sortedEntries(dir);
        names.forEach((name, i) => {
          const last = i === names.length - 1;
          lines.push(`<span class="muted">${prefix}${last ? '└── ' : '├── '}</span>${entryHtml(name, dir[name], base)}`);
          if (isDir(dir[name])) walk(dir[name], prefix + (last ? '    ' : '│   '), base ? `${base}/${name}` : `~/${name}`);
        });
      };
      walk(SITE.files, '', '~');
      print(lines.join('\n'));
    },
  },

  pwd: {
    desc: 'print working directory',
    run() { printText(`/home/${SITE.user}` + cwd.map((s) => '/' + s).join('')); },
  },

  whoami: {
    desc: 'who is this?',
    run() { printText(`${SITE.name} — ${SITE.title}`); },
  },

  neofetch: {
    desc: 'system info',
    run() {
      const art = [
        '    .--.    ',
        '   |o_o |   ',
        '   |:_/ |   ',
        '  //   \\ \\  ',
        ' (|     | ) ',
        "/'\\_   _/`\\ ",
        '\\___)=(___/ ',
      ];
      const info = [
        `<span class="accent">${SITE.user}@${SITE.host}</span>`,
        '-'.repeat(SITE.user.length + SITE.host.length + 1),
        `<span class="accent">Name</span>: ${escapeHtml(SITE.name)}`,
        `<span class="accent">Role</span>: ${escapeHtml(SITE.title)}`,
        `<span class="accent">Location</span>: ${escapeHtml(SITE.location)}`,
        `<span class="accent">Shell</span>: websh 1.0`,
        `<span class="accent">Uptime</span>: ${Math.floor(performance.now() / 1000)}s`,
      ];
      const lines = art.map((a, i) => `<span class="accent">${escapeHtml(a)}</span>   ${info[i] ?? ''}`);
      print(lines.join('\n'));
    },
  },

  theme: {
    desc: `change colors (${THEMES.join(', ')})`,
    run([name]) {
      if (!name) {
        return print('Available themes: ' + THEMES.map((t) => cmdLink('theme ' + t, t)).join(' '));
      }
      if (!THEMES.includes(name)) return printText(`theme: unknown theme '${name}'`, 'error');
      setTheme(name);
      try { localStorage.setItem('theme', name); } catch {}
    },
  },

  echo: {
    desc: 'print text',
    run(args) { printText(args.join(' ')); },
  },

  date: {
    desc: 'print the date',
    run() { printText(new Date().toString()); },
  },

  history: {
    desc: 'show command history',
    run() { printText(history.map((c, i) => `${String(i + 1).padStart(4)}  ${c}`).join('\n')); },
  },

  clear: {
    desc: 'clear the screen',
    run() { output.innerHTML = ''; },
  },

  sudo: {
    hidden: true,
    run() { printText(`${SITE.user} is not in the sudoers file. This incident will be reported.`, 'error'); },
  },

  exit: {
    hidden: true,
    run() { printText('There is no escape. Try `help` instead.', 'muted'); },
  },
};

// ---------- input handling ----------

function runCommand(line) {
  print(promptHtml() + escapeHtml(line));
  const trimmed = line.trim();
  if (trimmed) {
    history.push(trimmed);
    const [name, ...args] = trimmed.split(/\s+/);
    const cmd = commands[name];
    if (cmd) cmd.run(args);
    else printText(`${name}: command not found. Type 'help' for a list of commands.`, 'error');
  }
  historyIndex = history.length;
  renderPrompt();
  scrollToBottom();
}

function commonPrefix(words) {
  return words.reduce((a, b) => {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return a.slice(0, i);
  });
}

function complete() {
  const value = input.value;
  const parts = value.split(/\s+/);
  const last = parts[parts.length - 1];
  let candidates;
  let prefix;

  if (parts.length === 1) {
    prefix = '';
    candidates = Object.keys(commands).filter((c) => !commands[c].hidden && c.startsWith(last)).map((c) => c + ' ');
  } else {
    const slash = last.lastIndexOf('/');
    prefix = last.slice(0, slash + 1);
    const base = last.slice(slash + 1);
    const dir = getNode(resolve(prefix));
    if (!isDir(dir)) return;
    candidates = Object.keys(dir).filter((n) => n.startsWith(base)).map((n) => n + (isDir(dir[n]) ? '/' : ' '));
  }

  if (!candidates.length) return;
  const head = value.slice(0, value.length - last.length) + prefix;
  if (candidates.length === 1) {
    input.value = head + candidates[0];
  } else {
    print(promptHtml() + escapeHtml(value));
    printText(candidates.map((c) => c.trim()).join('  '), 'muted');
    input.value = head + commonPrefix(candidates);
    scrollToBottom();
  }
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    runCommand(input.value);
    input.value = '';
  } else if (e.key === 'Tab') {
    e.preventDefault();
    complete();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIndex > 0) input.value = history[--historyIndex];
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    historyIndex = Math.min(historyIndex + 1, history.length);
    input.value = history[historyIndex] ?? '';
  } else if (e.key === 'l' && e.ctrlKey) {
    e.preventDefault();
    output.innerHTML = '';
  } else if (e.key === 'c' && e.ctrlKey && !window.getSelection().toString()) {
    print(promptHtml() + escapeHtml(input.value) + '^C');
    input.value = '';
    scrollToBottom();
  }
});

output.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-cmd]');
  if (!link) return;
  e.preventDefault();
  runCommand(link.dataset.cmd);
  input.focus();
});

// Focus the input when clicking the terminal, but don't steal text selections.
terminal.addEventListener('mouseup', () => {
  if (!window.getSelection().toString()) input.focus();
});

// ---------- boot ----------

function setTheme(name) {
  if (name === 'green') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = name;
}

try {
  const saved = localStorage.getItem('theme');
  if (THEMES.includes(saved)) setTheme(saved);
} catch {}

document.title = `${SITE.name} — Terminal`;
renderPrompt();
print(`Welcome to <span class="accent">${escapeHtml(SITE.name)}</span>'s corner of the internet.`);
print(`Type ${cmdLink('help')} to see available commands, or try ${cmdLink('ls')}, ${cmdLink('cat about.txt')}, ${cmdLink('neofetch')}.\n`);
input.focus();
