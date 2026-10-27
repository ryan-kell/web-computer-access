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

  sound: {
    desc: `sound mode (${Sound.MODES.join(', ')})`,
    run([mode]) {
      if (!mode) {
        printText(`Sound is set to ${Sound.getMode()}.`);
        return print('Options: ' + Sound.MODES.map((m) => cmdLink('sound ' + m, m)).join(' '));
      }
      if (!Sound.setMode(mode)) printText(`sound: unknown mode '${mode}'`, 'error');
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
  if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') Sound.click();

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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Phases: off → warming → menu → switching. Each step adds a class to #crt-intro
// that drives the CSS animations.
function playIntro() {
  const intro = document.getElementById('crt-intro');
  const osdInput = document.getElementById('osd-input');
  const osdSound = intro.querySelector('.osd-sound');
  const options = [...osdSound.querySelectorAll('[data-sound]')];
  const canvas = document.getElementById('crt-noise');
  const ctx = canvas.getContext('2d');
  const beamCtx = document.getElementById('crt-beam-noise').getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  let frame;
  let phase = 'off';
  let selected = 0;

  const drawNoise = () => {
    const px = image.data;
    for (let i = 0; i < px.length; i += 4) {
      px[i] = px[i + 1] = px[i + 2] = Math.random() * 255;
      px[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    beamCtx.putImageData(image, 0, 0);
    frame = requestAnimationFrame(drawNoise);
  };

  const select = (i) => {
    selected = (i + options.length) % options.length;
    options.forEach((option, j) => {
      option.classList.toggle('selected', j === selected);
      option.setAttribute('aria-checked', j === selected);
    });
  };

  const finish = () => {
    if (!intro.isConnected) return;
    cancelAnimationFrame(frame);
    Sound.stopHiss();
    intro.remove();
    window.removeEventListener('keydown', onKey, true);
    document.querySelector('.window').classList.remove('tune-in');
    input.focus();
  };

  const powerOn = async () => {
    phase = 'warming';
    intro.classList.add('on');
    Sound.powerOn();
    drawNoise();
    await wait(2500);
    if (intro.isConnected) Sound.setHiss(0.02, 2);
  };

  const confirm = async () => {
    phase = 'switching';
    Sound.setMode(options[selected].dataset.sound);
    Sound.blip(1400);
    intro.classList.add('chosen');

    await wait(500);
    if (!intro.isConnected) return;
    intro.classList.add('confirmed');
    osdInput.textContent = 'INPUT 2';
    Sound.blip(1000);

    await wait(1000);
    if (!intro.isConnected) return;
    intro.classList.add('switching');
    Sound.setHiss(0.08, 0.25);

    await wait(600);
    if (!intro.isConnected) return;
    intro.classList.add('tuned');
    document.querySelector('.window').classList.add('tune-in');
    Sound.stopHiss(1.5);

    await wait(800);
    finish();
  };

  // While the intro is up, it owns the keyboard so nothing is typed into the terminal.
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    const ok = e.key === 'Enter' || e.key === ' ';
    if (e.key === 'Escape') finish();
    else if (phase === 'off' && ok) powerOn();
    else if (phase === 'menu') {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { select(selected - 1); Sound.blip(900); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { select(selected + 1); Sound.blip(900); }
      else if (ok) confirm();
    }
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return finish();

  select(0);
  osdSound.addEventListener('animationend', (e) => {
    if (e.animationName === 'osd-in' && phase === 'warming') {
      phase = 'menu';
      intro.classList.add('menu');
    }
  });
  intro.addEventListener('click', (e) => {
    const option = e.target.closest('[data-sound]');
    if (e.target.closest('#intro-skip')) finish();
    else if (phase === 'off') powerOn();
    else if (phase === 'menu' && option) {
      select(options.indexOf(option));
      confirm();
    }
  });
  window.addEventListener('keydown', onKey, true);
}

playIntro();
document.title = `${SITE.name} — Terminal`;
renderPrompt();
print(`Welcome to <span class="accent">${escapeHtml(SITE.name)}</span>'s corner of the internet.`);
print(`Type ${cmdLink('help')} to see available commands, or try ${cmdLink('ls')}, ${cmdLink('cat about.txt')}, ${cmdLink('neofetch')}.\n`);
input.focus();
