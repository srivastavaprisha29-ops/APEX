const panel = document.querySelector('#sector-timing');
const form = document.querySelector('#sector-form');
const status = document.querySelector('#sector-status');
const results = document.querySelector('#sector-results');
const tableBody = results.querySelector('tbody');
const labels = {s1: 'Sector 1', s2: 'Sector 2', s3: 'Sector 3', total: 'Finish'};
const quality = {complete: 'complete timings', missing: 'missing timings',
  inconsistent: 'sector sum differs from lap time', pit_out: 'pit-out lap'};
const format = value => value === null ? 'Unavailable' : (value / 1000).toFixed(3);

async function load(parameters) {
  const response = await fetch('/api/v1/timing/monza-2024?' + parameters,
    {signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw Error('Timing request failed');
  return response.json();
}

async function render(parameters) {
  results.hidden = true;
  status.textContent = 'Loading sector timings…';
  const data = await load(parameters);
  tableBody.replaceChildren(...data.sectors.map(row => {
    const tr = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = labels[row.key];
    tr.append(heading);
    for (const value of [row.a, row.b, row.delta, row.cumulative]) {
      const cell = tr.insertCell();
      cell.textContent = format(value);
    }
    return tr;
  }));
  const {first, second} = data;
  status.textContent = [
    first.provider === 'fixture' ? 'Synthetic test data' : first.provider,
    'Verstappen lap ' + first.lap + ' (' + quality[first.quality] + ')',
    'Norris lap ' + second.lap + ' (' + quality[second.quality] + ')',
    'Imported ' + new Date(first.fetched_at).toISOString(),
    'Revision ' + first.revision.slice(0, 12)
  ].join(' · ');
  results.hidden = false;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await render(new URLSearchParams(new FormData(form)));
  } catch {
    status.textContent = 'Sector timings are unavailable. Try again.';
  } finally {
    button.disabled = false;
  }
});

for (const button of document.querySelectorAll('[data-tab="track"]')) {
  button.addEventListener('click', async () => {
    if (!panel.hidden) return;
    try {
      await render(new URLSearchParams({a: 1, b: 1}));
      panel.hidden = false;
    } catch {
      // The static demo can continue using its existing lap results.
    }
  }, {once: true});
}
