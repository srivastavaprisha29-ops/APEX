export function compare(a, b) {
  let cumulative = 0;
  return ['s1', 's2', 's3', 'total'].map((key, index) => {
    const delta = a[key] == null || b[key] == null ? null : a[key] - b[key];
    cumulative = cumulative === null || delta === null ? null : cumulative + delta;
    return {key, a: a[key], b: b[key], delta, cumulative: index === 3 ? delta : cumulative};
  });
}
