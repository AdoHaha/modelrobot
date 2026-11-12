const cell = value => /[,"\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;

// Read the current editor contents, not the animation controller's cached
// column list. Capture only those joint columns and never replace existing rows.
export function appendPose(csv, values, parse, interval = .06) {
  if (!values.size) throw new Error('CSV needs at least one movable joint column.');
  if (![...values.values()].every(Number.isFinite)) throw new Error('Current joint values must be finite numbers.');
  if (!csv.trim()) {
    return ['time', ...values.keys()].map(cell).join(',') + '\n0,' + [...values.values()].join(',') + '\n';
  }
  const rows = parse(csv.trim()), header = rows[0], timed = header[0] === 'time';
  const names = timed ? header.slice(1) : header;
  if (!names.length) throw new Error('CSV needs at least one movable joint column.');
  const unknown = names.filter(name => !values.has(name));
  if (unknown.length) throw new Error('Unknown, fixed or dependent joints: ' + unknown.join(', '));
  if (new Set(names).size !== names.length || !rows.slice(1).every(row => row.length === header.length && row.every(value => value.trim() !== '' && Number.isFinite(Number(value))) && (!timed || Number(row[0]) >= 0))) {
    throw new Error('Check the CSV: use joint names and equal-length rows of numbers.');
  }
  const next = names.map(name => values.get(name));
  if (timed) {
    const lastTime = rows.length > 1 ? rows.slice(1).reduce((last, row) => Math.max(last, Number(row[0])), -Infinity) : -interval;
    const time = Number((lastTime + interval).toPrecision(15));
    if (!Number.isFinite(time) || time <= lastTime) throw new Error('Cannot create a later finite CSV time.');
    next.unshift(time);
  }
  const newline = csv.includes('\r\n') ? '\r\n' : csv.includes('\r') && !csv.includes('\n') ? '\r' : '\n';
  const prefix = csv.replace(/(?:(?:\r\n|\r|\n)[\t ]*)+$/, '');
  return prefix + newline + next.join(',') + newline;
}
