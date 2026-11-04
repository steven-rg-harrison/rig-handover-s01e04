import type { Night } from '../digest/types.js';

const dash = '—';

export function DigestPage({ data }: { data: Night }) {
  const rows = [...data.rows].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return (
    <>
      <h1>digest · {data.night}</h1>
      {data.badLines > 0 ? <p class="warn">{data.badLines} bad line(s) in the log</p> : null}
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const marked = r.retries >= 3 || r.lastStatus === 'fail';
              return (
                <tr class={marked ? 'flag' : undefined}>
                  <td>{r.job || dash}</td>
                  <td>{r.owner ?? dash}</td>
                  <td>{r.runs}</td>
                  <td>{r.retries}</td>
                  <td>{r.lastStatus ?? dash}</td>
                  <td>{r.lastError ?? dash}</td>
                  <td>{r.firstAt || dash}</td>
                  <td>{r.lastAt || dash}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
