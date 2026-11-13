const path = '/api/v1/timing/monza-2024';
const catalogPath = '/api/v1/timing/sessions';
const lapsPath = catalogPath + '/9590/laps';
const sessionName = '2024 Italian Grand Prix · Race';

async function readCatalog(db, pathname) {
  const sessions = pathname === catalogPath;
  const query = sessions
    ? `SELECT r.session_key, r.id AS revision, r.provider, r.fetched_at
       FROM timing_active t JOIN timing_revision r ON r.id = t.revision
       WHERE t.singleton = 1`
    : `SELECT r.id AS revision, e.driver_number, e.driver, e.constructor,
              l.lap, l.total, l.quality
       FROM timing_active t JOIN timing_revision r ON r.id = t.revision
       JOIN timing_lap l ON l.revision = r.id
       JOIN timing_entry e ON e.driver_number = l.driver_number
       WHERE t.singleton = 1 AND r.session_key = 9590
       ORDER BY e.driver_number, l.lap`;
  const {results} = await db.prepare(query).all();
  const headers = {'Cache-Control': 'no-cache'};
  if (sessions) return Response.json({sessions: results.map(row => ({
    ...row, name: sessionName, laps_url: lapsPath, comparison_url: path
  }))}, {headers});
  if (!results.length) return unavailable();
  return Response.json({session_key: 9590, revision: results[0].revision,
    laps: results.map(({revision, ...lap}) => lap)}, {headers});
}

const unavailable = () => Response.json({error: 'Sector data is unavailable'}, {status: 503});

export function compare(a, b) {
  let cumulative = 0;
  return ['s1', 's2', 's3', 'total'].map((key, index) => {
    const delta = a[key] == null || b[key] == null ? null : a[key] - b[key];
    cumulative = cumulative === null || delta === null ? null : cumulative + delta;
    return {key, a: a[key], b: b[key], delta, cumulative: index === 3 ? delta : cumulative};
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (![path, catalogPath, lapsPath].includes(url.pathname)) return new Response(null, {status: 404});
    if (request.method !== 'GET') return new Response(null, {status: 405, headers: {Allow: 'GET'}});
    const keys = [...url.searchParams.keys()];
    if (url.pathname !== path) {
      if (keys.length) return Response.json({error: 'Unexpected query parameters'}, {status: 400});
      try {
        return await readCatalog(env.TIMING, url.pathname);
      } catch (error) {
        console.error('Timing catalog query failed', error);
        return unavailable();
      }
    }
    const a = url.searchParams.get('a');
    const b = url.searchParams.get('b');
    const valid = value => /^(?:[1-9]|[1-4][0-9]|5[0-3])$/.test(value ?? '');
    if (keys.length !== 2 || !valid(a) || !valid(b)) {
      return Response.json({error: 'Specify one lap from 1 to 53 for each driver'}, {status: 400});
    }
    try {
      const {results} = await env.TIMING.prepare(`
        SELECT r.id AS revision, r.provider, r.fetched_at, r.session_key,
               e.driver, e.constructor, l.driver_number, l.lap,
               l.total, l.s1, l.s2, l.s3, l.quality
        FROM timing_active t
        JOIN timing_revision r ON r.id = t.revision
        JOIN timing_lap l ON l.revision = r.id
        JOIN timing_entry e ON e.driver_number = l.driver_number
        WHERE t.singleton = 1
          AND ((l.driver_number = 1 AND l.lap = ?) OR (l.driver_number = 4 AND l.lap = ?))
        ORDER BY l.driver_number
      `).bind(Number(a), Number(b)).all();
      if (results.length !== 2) return unavailable();
      const [first, second] = results;
      const etag = `"${first.revision}-${a}-${b}"`;
      const headers = {ETag: etag, 'Cache-Control': 'private, no-cache'};
      if (request.headers.get('If-None-Match') === etag) return new Response(null, {status: 304, headers});
      return Response.json({session: sessionName, first, second,
        sectors: compare(first, second)}, {headers});
    } catch (error) {
      console.error('Timing query failed', error);
      return unavailable();
    }
  }
};
