const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function stripCommentsAST(code, isJsx = false) {
  const sf = ts.createSourceFile(
    isJsx ? 'temp.tsx' : 'temp.ts',
    code,
    ts.ScriptTarget.Latest,
    true,
    isJsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const comments = [];

  function walk(node) {
    const l = ts.getLeadingCommentRanges(code, node.getFullStart());
    if (l) comments.push(...l);
    const t = ts.getTrailingCommentRanges(code, node.end);
    if (t) comments.push(...t);

    const children = node.getChildren(sf);
    for (const c of children) {
      walk(c);
    }
  }

  walk(sf);

  const unique = Array.from(
    new Map(comments.map((c) => [`${c.pos}-${c.end}`, c])).values()
  ).sort((a, b) => b.pos - a.pos);

  let result = code;
  for (const c of unique) {
    result = result.slice(0, c.pos) + result.slice(c.end);
  }

  const lines = result.split('\n');
  const cleaned = [];
  let prevEmpty = false;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed.trim() === '') {
      if (!prevEmpty) {
        cleaned.push('');
        prevEmpty = true;
      }
    } else {
      cleaned.push(trimmed);
      prevEmpty = false;
    }
  }

  return cleaned.join('\n');
}

function stripCSSComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function processDirectory(dir, extensions) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'coverage', '.next'].includes(entry.name)) continue;
      processDirectory(fullPath, extensions);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        let stripped = content;
        if (['.ts', '.tsx', '.js', '.mjs', '.cjs'].includes(ext)) {
          stripped = stripCommentsAST(content, ext === '.tsx' || ext === '.jsx');
        } else if (ext === '.css') {
          stripped = stripCSSComments(content);
        }

        if (stripped !== content) {
          fs.writeFileSync(fullPath, stripped, 'utf8');
          console.log(`Stripped comments: ${fullPath}`);
        }
      }
    }
  }
}

const targetDirs = [
  path.join(__dirname, '../orbit/src'),
  path.join(__dirname, '../orbitserver/src'),
  path.join(__dirname, '../orbitserver/scripts'),
  path.join(__dirname, '../shared/src'),
];

for (const dir of targetDirs) {
  console.log(`Processing ${dir}...`);
  processDirectory(dir, ['.ts', '.tsx', '.js', '.css', '.mjs', '.cjs']);
}

const rootFiles = [
  path.join(__dirname, '../orbit/vite.config.ts'),
  path.join(__dirname, '../orbitserver/vitest.config.ts'),
  path.join(__dirname, '../orbitserver/eslint.config.js'),
  path.join(__dirname, '../orbit/eslint.config.js'),
];

for (const f of rootFiles) {
  if (fs.existsSync(f)) {
    const content = fs.readFileSync(f, 'utf8');
    const stripped = stripCommentsAST(content, false);
    if (stripped !== content) {
      fs.writeFileSync(f, stripped, 'utf8');
      console.log(`Stripped comments: ${f}`);
    }
  }
}

console.log('Finished stripping comments with AST.');
