// Komachi — notices: a small cream card with a bell that slides in under the brand card (top left), kept clear of the town centre
const el = document.getElementById('toast');
let timer = 0;
export function toast(msg) { el.textContent = msg; el.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => el.classList.remove('show'), 3400); }
