// Guard run by `npm run lint`: finds a `//` comment that has swallowed code, i.e. a comment written into the middle of a
// one-line statement chain so everything after it on the line stopped running (it has happened several times in patches).
// It flags comment text that contains `; <statement>` patterns such as `; if (`, `; return`, `; name = ` or `; call(`.
import { readFileSync, readdirSync } from 'node:fs';

const code = /(\)|\]|\w)\s*;\s*(if \(|for \(|const |let |return\b|[a-zA-Z_$][\w$.]*(\[[^\]]*\])?\s*(=[^=]|\+=|\())/;
let found = 0;
for (const f of readdirSync('src').filter(f => f.endsWith('.js'))) {
  readFileSync('src/' + f, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const k = line.indexOf('//'); if (k < 0) return;
    const before = line.slice(0, k);
    if ((before.match(/'/g) || []).length % 2 || (before.match(/`/g) || []).length % 2 || /https?:$/.test(before)) return;   // inside a string or a URL
    if (code.test(line.slice(k + 2))) { found++; console.log(`src/${f}:${i + 1}: code after a // comment: ${line.slice(k).trim().slice(0, 120)}`); }
  });
}
if (found) { console.log(`\n${found} line(s) look like a comment swallowed code: move the comment to the end of the line or its own line.`); process.exit(1); }
