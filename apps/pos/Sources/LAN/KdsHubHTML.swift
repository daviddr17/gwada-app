import Foundation

enum KdsHubHTML {
    /// Minimalistisches KDS im Browser über http://<kasse-ip>:8787/v1/kds
    static func page() -> Data {
        let html = """
        <!doctype html>
        <html lang="de">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Gwada KDS</title>
          <style>
            :root { color-scheme: light dark; --bg:#0f1115; --card:#1a1d24; --fg:#f4f4f5; --muted:#a1a1aa; --accent:#eab308; }
            * { box-sizing: border-box; }
            body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background:var(--bg); color:var(--fg); }
            header { display:flex; gap:12px; align-items:center; padding:14px 18px; border-bottom:1px solid #27272a; position:sticky; top:0; background:rgba(15,17,21,.92); backdrop-filter: blur(8px); }
            h1 { font-size:18px; margin:0; font-weight:700; letter-spacing:-.02em; }
            .muted { color:var(--muted); font-size:13px; }
            button { background:#27272a; color:var(--fg); border:0; border-radius:999px; padding:8px 12px; font-weight:600; }
            .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; padding:16px; }
            .card { background:var(--card); border-radius:16px; padding:14px; min-height:140px; border:1px solid #27272a; }
            .top { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
            .num { font-size:22px; font-weight:800; font-variant-numeric: tabular-nums; }
            .badge { font-size:11px; font-weight:800; padding:4px 8px; border-radius:999px; background:rgba(234,179,8,.18); color:var(--accent); }
            .line { font-weight:650; margin:6px 0 2px; }
            .detail { font-size:12px; color:var(--muted); }
          </style>
        </head>
        <body>
          <header>
            <h1>Gwada KDS</h1>
            <span class="muted" id="meta">Lokaler Hub</span>
            <span style="flex:1"></span>
            <button onclick="load()">Aktualisieren</button>
          </header>
          <div class="grid" id="grid"></div>
          <script>
            async function load() {
              const meta = document.getElementById('meta');
              const grid = document.getElementById('grid');
              try {
                const res = await fetch('/v1/kds/tickets');
                const data = await res.json();
                const tickets = data.tickets || [];
                meta.textContent = tickets.length ? (tickets.length + ' Tickets') : 'Keine Tickets — Bestellungen von der Kasse';
                grid.innerHTML = tickets.map(t => `
                  <article class="card">
                    <div class="top"><div class="num">#${t.orderNumber}</div><div class="badge">${(t.status||'').toUpperCase()}</div></div>
                    ${(t.lines||[]).map(l => `
                      <div class="line">${l.quantity}× ${escapeHtml(l.name)}</div>
                      <div class="detail">${escapeHtml(l.detail||'')}</div>
                    `).join('')}
                  </article>
                `).join('');
              } catch (e) {
                meta.textContent = 'Fehler beim Laden';
                grid.innerHTML = '';
              }
            }
            function escapeHtml(s) {
              return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
            }
            load();
            setInterval(load, 5000);
          </script>
        </body>
        </html>
        """
        return Data(html.utf8)
    }
}
