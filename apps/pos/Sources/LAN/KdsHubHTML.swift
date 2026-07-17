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
            header { display:flex; gap:12px; align-items:center; padding:14px 18px; border-bottom:1px solid #27272a; position:sticky; top:0; background:rgba(15,17,21,.92); backdrop-filter: blur(8px); z-index:2; }
            h1 { font-size:18px; margin:0; font-weight:700; letter-spacing:-.02em; }
            .muted { color:var(--muted); font-size:13px; }
            button { background:#27272a; color:var(--fg); border:0; border-radius:999px; padding:8px 12px; font-weight:600; cursor:pointer; }
            .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; padding:16px; }
            .card { background:var(--card); border-radius:16px; padding:14px; min-height:140px; border:1px solid #27272a; cursor:pointer; transition: transform .08s ease, border-color .12s ease, opacity .12s ease; text-align:left; width:100%; color:inherit; font:inherit; }
            .card:active { transform: scale(.985); }
            .card.busy { opacity:.72; pointer-events:none; }
            .top { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px; }
            .num { font-size:22px; font-weight:800; font-variant-numeric: tabular-nums; }
            .badge { font-size:11px; font-weight:800; padding:4px 8px; border-radius:999px; transition: background .12s ease, color .12s ease; }
            .line { font-weight:650; margin:6px 0 2px; }
            .detail { font-size:12px; color:var(--muted); }
            .hint { font-size:11px; color:var(--muted); margin-top:10px; }
          </style>
        </head>
        <body>
          <header>
            <h1>Gwada KDS</h1>
            <span class="muted" id="meta">Lokaler Hub · Tippen = nächster Status</span>
            <span style="flex:1"></span>
            <button type="button" onclick="load()">Aktualisieren</button>
          </header>
          <div class="grid" id="grid"></div>
          <script>
            let tickets = [];
            let statuses = [];
            const advancing = new Set();

            function hexToRgba(hex, a) {
              const h = String(hex || '#eab308').replace('#','');
              if (h.length !== 6) return 'rgba(234,179,8,' + a + ')';
              const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
              return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
            }
            function escapeHtml(s) {
              return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
            }
            function escapeAttr(s) {
              return String(s).replace(/['"\\\\]/g, '');
            }
            function statusList() {
              return (statuses || []).filter(s => s.isActive !== false)
                .slice()
                .sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0));
            }
            function applyOptimistic(orderId) {
              const list = statusList();
              const idx = tickets.findIndex(t => t.orderId === orderId);
              if (idx < 0) return;
              const t = tickets[idx];
              let cur = -1;
              if (t.statusId) cur = list.findIndex(s => s.id === t.statusId);
              if (cur < 0) cur = list.findIndex(s => String(s.name||'').toLowerCase() === String(t.statusName || t.status || '').toLowerCase());
              const next = list[cur + 1];
              if (!next) {
                tickets.splice(idx, 1);
              } else {
                t.statusId = next.id;
                t.status = next.name;
                t.statusName = next.name;
                t.statusColor = next.color;
                tickets[idx] = t;
              }
              render();
            }
            async function advance(orderId) {
              if (advancing.has(orderId)) return;
              advancing.add(orderId);
              applyOptimistic(orderId);
              try {
                const res = await fetch('/v1/kds/tickets/advance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId }),
                });
                const data = await res.json().catch(() => ({}));
                if (data && data.done) {
                  tickets = tickets.filter(t => t.orderId !== orderId);
                  render();
                } else if (data && data.ticket) {
                  const t = data.ticket;
                  const i = tickets.findIndex(x => x.orderId === orderId);
                  if (i >= 0) {
                    tickets[i].statusId = t.statusId || tickets[i].statusId;
                    tickets[i].statusName = t.statusName || t.status || tickets[i].statusName;
                    tickets[i].status = tickets[i].statusName;
                    tickets[i].statusColor = t.statusColor || tickets[i].statusColor;
                    render();
                  }
                }
              } catch (e) {
                await load();
              } finally {
                advancing.delete(orderId);
                render();
              }
            }
            function render() {
              const meta = document.getElementById('meta');
              const grid = document.getElementById('grid');
              meta.textContent = tickets.length
                ? (tickets.length + ' Tickets · Tippen = nächster Status')
                : 'Keine Tickets — Bestellungen von der Kasse';
              grid.innerHTML = tickets.map(t => {
                const color = t.statusColor || '#eab308';
                const label = t.statusName || t.status || '';
                const busy = advancing.has(t.orderId);
                return `
                <button type="button" class="card${busy ? ' busy' : ''}" style="border-color:${hexToRgba(color,0.45)}" onclick="advance('${escapeAttr(t.orderId)}')">
                  <div class="top">
                    <div class="num">#${t.orderNumber}</div>
                    <div class="badge" style="background:${hexToRgba(color,0.2)};color:${color}">${escapeHtml(label).toUpperCase()}</div>
                  </div>
                  ${(t.lines||[]).map(l => `
                    <div class="line">${l.quantity}× ${escapeHtml(l.name)}</div>
                    <div class="detail">${escapeHtml(l.detail||'')}</div>
                  `).join('')}
                  <div class="hint">${busy ? 'Wird gespeichert …' : 'Tippen → nächster Status'}</div>
                </button>
              `}).join('');
            }
            async function load() {
              const meta = document.getElementById('meta');
              try {
                const res = await fetch('/v1/kds/tickets');
                const data = await res.json();
                tickets = data.tickets || [];
                if (Array.isArray(data.statuses) && data.statuses.length) {
                  statuses = data.statuses;
                }
                render();
              } catch (e) {
                meta.textContent = 'Fehler beim Laden';
                document.getElementById('grid').innerHTML = '';
              }
            }
            load();
            setInterval(() => {
              if (advancing.size === 0) load();
            }, 5000);
          </script>
        </body>
        </html>
        """
        return Data(html.utf8)
    }
}
