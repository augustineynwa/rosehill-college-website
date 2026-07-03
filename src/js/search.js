/** Client-side site search over the render-time index. */
export async function initSearch() {
  const input = document.querySelector('[data-search-input]');
  const results = document.querySelector('[data-search-results]');
  const status = document.querySelector('[data-search-status]');
  if (!input || !results) return;

  const index = await fetch('/search-index.json').then((r) => r.json()).catch(() => []);
  const params = new URLSearchParams(location.search);

  function run(q) {
    results.innerHTML = '';
    const query = q.trim().toLowerCase();
    if (query.length < 2) { status.textContent = ''; return; }
    const terms = query.split(/\s+/);
    const hits = index
      .map((page) => {
        const hay = (page.title + ' ' + page.description + ' ' + page.text).toLowerCase();
        let score = 0;
        for (const t of terms) {
          if (!hay.includes(t)) return null;
          score += page.title.toLowerCase().includes(t) ? 5 : 1;
        }
        return { page, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    status.textContent = hits.length
      ? `${hits.length} result${hits.length === 1 ? '' : 's'} for “${q.trim()}”`
      : `No results for “${q.trim()}” — try a different word.`;

    for (const { page } of hits) {
      const li = document.createElement('li');
      li.className = 'search-result';
      const a = document.createElement('a');
      a.href = page.href;
      a.className = 'search-result__link';
      const h = document.createElement('h3');
      h.textContent = page.title;
      const p = document.createElement('p');
      p.textContent = page.description;
      a.append(h, p);
      li.append(a);
      results.append(li);
    }
  }

  input.addEventListener('input', () => run(input.value));
  if (params.get('query')) {
    input.value = params.get('query');
    run(input.value);
  }
  input.focus();
}
