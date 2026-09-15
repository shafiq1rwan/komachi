// Komachi — the little dark message pill at the bottom of the screen
const el = document.getElementById('toast');
let timer = 0;
export function toast(msg) { el.textContent = msg; el.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => el.classList.remove('show'), 2600); }
