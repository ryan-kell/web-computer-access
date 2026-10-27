// Edit this file to personalize the site.
// Everything under `files` becomes the virtual home directory.
// Strings are files, objects are directories. URLs and emails become clickable.

const SITE = {
  user: 'ryan',
  host: 'portfolio',
  name: 'Ryan',
  title: 'Software Developer',
  location: 'Earth',

  files: {
    'about.txt': `Hi, I'm Ryan.

I'm a software developer who likes building things for the web,
tinkering with Linux, and learning how computers work under the hood.

Replace this text in content.js with your own bio.`,

    'skills.txt': `Languages   JavaScript, TypeScript, Python, Bash
Frontend    HTML, CSS, React
Backend     Node.js, SQL
Tools       Git, Linux, Docker, VS Code`,

    'contact.txt': `Email     you@example.com
GitHub    https://github.com/your-username
LinkedIn  https://linkedin.com/in/your-username`,

    projects: {
      'terminal-site.md': `# Terminal Site
The website you're looking at right now.
A personal site styled like a Linux terminal, written in plain HTML/CSS/JS.

Source: https://github.com/your-username/terminal-site`,

      'project-two.md': `# Project Two
A short description of what it does and why it's interesting.

Stack: Python, PostgreSQL
Link:  https://example.com`,
    },
  },
};
