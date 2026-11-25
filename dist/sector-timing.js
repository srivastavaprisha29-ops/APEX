import {compare} from './timing-comparison.mjs';

const panel = document.querySelector('#sector-timing');
const form = document.querySelector('#sector-form');
const status = document.querySelector('#sector-status');
const results = document.querySelector('#sector-results');
const tableBody = results.querySelector('tbody');
const labels = {s1: 'Sector 1', s2: 'Sector 2', s3: 'Sector 3', total: 'Finish'};
const quality = {complete: 'complete timings', missing: 'missing timings',
  inconsistent: 'sector sum differs from lap time', pit_out: 'pit-out lap'};
const format = value => value === null ? 'Unavailable' : (value / 1000).toFixed(3);

const retry = document.querySelector('#sector-retry');
const submit = form.querySelector('button');
const caption = results.querySelector('caption');
const catalogUrl = new URL('./api/v1/timing/sessions', import.meta.url);
const fixtureUrl = new URL('./data/monza-sector-fixture.json', import.meta.url);
let source, loading = false;

async function load(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw Error('Timing request failed');
  return response.json();
}

async function discoverSource() {
  try {
    const catalog = await load(catalogUrl);
    const session = catalog.sessions.find(item => item.session_key === 9590);
    if (!session) throw Error('Monza session is unavailable');
    const inventory = await load(new URL(session.laps_url, catalogUrl));
    return {
      ...inventory,
      provider: session.provider,
      async compare(parameters) {
        const url = new URL(session.comparison_url, catalogUrl);
        url.search = parameters.toString();
        return load(url);
      }
    };
  } catch {
    const fixture = await load(fixtureUrl);
    const lapsByKey = new Map(fixture.laps.map(lap => [
      lap.driver_number + ':' + lap.lap, lap
    ]));
    return {
      ...fixture,
      compare(parameters) {
        const first = lapsByKey.get('1:' + parameters.get('a'));
        const second = lapsByKey.get('4:' + parameters.get('b'));
        if (!first || !second) throw Error('Sample lap is unavailable');
        return {first, second, sectors: compare(first, second)};
      }
    };
  }
}

function prompt(message) {
  status.textContent = (source?.provider === 'fixture' ? 'Synthetic sample data · ' : '') + message;
}

function populate(name, laps) {
  const picker = form.elements.namedItem(name);
  picker.replaceChildren(...laps.map(lap => {
    const option = document.createElement('option');
    option.value = lap.lap;
    option.textContent = 'Lap ' + lap.lap + ' · ' + format(lap.total)
      + (lap.total === null ? '' : ' s') + ' · ' + quality[lap.quality];
    return option;
  }));
  const preferred = laps.find(lap => lap.quality === 'complete') ?? laps[0];
  picker.value = preferred.lap;
}

async function discover() {
  if (loading) return;
  loading = true;
  panel.hidden = false;
  form.hidden = true;
  results.hidden = true;
  retry.hidden = true;
  status.textContent = 'Loading available laps…';
  try {
    source = await discoverSource();
    const first = source.laps.filter(lap => lap.driver_number === 1);
    const second = source.laps.filter(lap => lap.driver_number === 4);
    if (!first.length || !second.length) throw Error('Both drivers need recorded laps');
    populate('a', first);
    populate('b', second);
    form.hidden = false;
    prompt('Choose one lap per driver.');
  } catch {
    status.textContent = 'Sector lap data is unavailable here. The track replay is still available.';
    retry.hidden = false;
  } finally {
    loading = false;
  }
}

async function render(parameters) {
  results.hidden = true;
  prompt('Loading sector timings…');
  const data = await source.compare(parameters);
  if (data.first.revision !== source.revision || data.second.revision !== source.revision) {
    form.hidden = true;
    retry.hidden = false;
    status.textContent = 'Timing data has changed. Reload the lap list to compare the latest revision.';
    return;
  }
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
  const synthetic = first.provider === 'fixture';
  caption.textContent = synthetic ? 'Synthetic times and gaps in seconds' : 'Recorded times and gaps in seconds';
  status.textContent = [
    synthetic ? 'Synthetic sample data' : first.provider,
    'Verstappen lap ' + first.lap + ' (' + quality[first.quality] + ')',
    'Norris lap ' + second.lap + ' (' + quality[second.quality] + ')',
    first.fetched_at && 'Imported ' + new Date(first.fetched_at).toISOString(),
    'Revision ' + first.revision.slice(0, 12)
  ].filter(Boolean).join(' · ');
  results.hidden = false;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (loading) return;
  loading = true;
  submit.disabled = true;
  const pickers = [...form.querySelectorAll('select')];
  const parameters = new URLSearchParams(new FormData(form));
  pickers.forEach(picker => { picker.disabled = true; });
  try {
    await render(parameters);
  } catch {
    status.textContent = 'Sector timings are unavailable. Try again.';
  } finally {
    pickers.forEach(picker => { picker.disabled = false; });
    submit.disabled = false;
    loading = false;
  }
});

form.addEventListener('change', () => {
  if (!loading) {
    results.hidden = true;
    prompt('Compare to load the selected laps.');
  }
});
retry.addEventListener('click', discover);
for (const button of document.querySelectorAll('[data-tab="track"]')) {
  button.addEventListener('click', () => {
    if (panel.hidden) discover();
  });
}
