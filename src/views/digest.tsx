import type { NightDigest } from '../digest/types.js';

const missing = '—';

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.badLines > 0 && (
        <p class="warn" role="status">{digest.badLines} malformed {digest.badLines === 1 ? 'line' : 'lines'} in the run log.</p>
      )}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">job</th><th scope="col">owner</th><th scope="col">runs</th>
                <th scope="col">retries</th><th scope="col">last status</th><th scope="col">last error</th>
                <th scope="col">first logged</th><th scope="col">last logged</th>
              </tr>
            </thead>
            <tbody>
              {digest.rows.map((row) => (
                <tr>
                  <td>{row.job}</td>
                  <td>{row.owner ?? missing}</td>
                  <td>{row.runs}</td>
                  <td class={row.retries >= 3 ? 'warn' : undefined}>
                    {row.retries}{row.retries >= 3 && <span> · warning: 3 or more retries</span>}
                  </td>
                  <td class={row.hasFailure ? 'warn' : undefined}>
                    {row.lastStatus}{row.hasFailure && <span> · warning: failed at least once</span>}
                  </td>
                  <td>{row.lastError ?? missing}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
