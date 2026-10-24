import { Link } from 'react-router-dom'
import { MODULES, moduleByKey, type Row } from '../lib/modules'
import { useStore } from '../lib/store'
import { Icon, OptionPill, daysUntil, fmtDate } from './ui'

type Attention = { mod: 'waivers' | 'contracts'; row: Row; days: number }

export function Dashboard() {
  const { tables, labelFor, loading } = useStore()

  const attention: Attention[] = []
  for (const key of ['waivers', 'contracts'] as const) {
    const mod = moduleByKey(key)!
    for (const row of tables[key] ?? []) {
      const d = daysUntil(row[mod.expiryKey!])
      const status = String(row.status ?? '')
      if (d !== null && d <= 30 && !['expired', 'cancelled'].includes(status)) attention.push({ mod: key, row, days: d })
    }
  }
  attention.sort((a, b) => a.days - b.days)

  const unsigned = [
    ...(tables.waivers ?? []).filter((r) => ['draft', 'sent'].includes(String(r.status))).map((r) => ({ mod: 'waivers' as const, row: r })),
    ...(tables.contracts ?? []).filter((r) => ['draft', 'sent'].includes(String(r.status))).map((r) => ({ mod: 'contracts' as const, row: r })),
  ]

  const recent = MODULES.flatMap((m) => (tables[m.key] ?? []).map((r) => ({ mod: m, row: r })))
    .filter((x) => x.row.updated_at)
    .sort((a, b) => String(b.row.updated_at).localeCompare(String(a.row.updated_at)))
    .slice(0, 8)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <section className="module">
      <header className="module-head">
        <div>
          <h1>{greeting}</h1>
          <p className="blurb">{loading ? 'Loading the barn…' : attention.length ? `${attention.length} document${attention.length === 1 ? '' : 's'} need${attention.length === 1 ? 's' : ''} attention in the next 30 days.` : 'Nothing is expiring in the next 30 days.'}</p>
        </div>
      </header>

      <div className="stat-row">
        {MODULES.map((m) => (
          <Link key={m.key} to={`/${m.key}`} className="stat">
            <Icon name={m.icon} size={18} />
            <span className="stat-num">{tables[m.key]?.length ?? '–'}</span>
            <span className="stat-label">{m.label}</span>
          </Link>
        ))}
      </div>

      <div className="dash-grid">
        <div className="panel">
          <h2><Icon name="alert" size={16} /> Expiring soon</h2>
          {attention.length === 0 ? <p className="muted">All waivers and contracts are current.</p> : (
            <ul className="list">
              {attention.map(({ mod, row, days }) => (
                <li key={row.id}>
                  <Link to={`/${mod}`}>
                    <span className="list-title">{String(row.title)}</span>
                    <span className="muted small">{labelFor('clients', row.client_id)}</span>
                  </Link>
                  <span className={days < 0 ? 'date-bad' : 'date-warn'}>{days < 0 ? `${-days}d overdue` : days === 0 ? 'today' : `${days}d`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <h2><Icon name="file-signature" size={16} /> Awaiting signature</h2>
          {unsigned.length === 0 ? <p className="muted">Every document is signed.</p> : (
            <ul className="list">
              {unsigned.map(({ mod, row }) => (
                <li key={row.id}>
                  <Link to={`/${mod}`}>
                    <span className="list-title">{String(row.title)}</span>
                    <span className="muted small">{labelFor('clients', row.client_id)}</span>
                  </Link>
                  <OptionPill options={moduleByKey(mod)!.fields.find((f) => f.key === 'status')?.options} value={row.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel panel-wide">
          <h2><Icon name="edit" size={16} /> Recently updated</h2>
          {recent.length === 0 ? <p className="muted">Add your first rider, offering or waiver to get started.</p> : (
            <ul className="list">
              {recent.map(({ mod, row }) => (
                <li key={`${mod.key}-${row.id}`}>
                  <Link to={`/${mod.key}`}>
                    <span className="list-title">{String(row[mod.titleKey])}</span>
                    <span className="muted small">{mod.singular}</span>
                  </Link>
                  <span className="muted small">{fmtDate(row.updated_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
