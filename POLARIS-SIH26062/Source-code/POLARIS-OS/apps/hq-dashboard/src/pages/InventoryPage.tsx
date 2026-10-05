import { useMemo, useState } from 'react'
import type { InventoryStock, ItemCatalog, Station } from '../types'
import { StatusPill } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { formatDateTime, recordLabel, stationLabelById } from '../utils/display'

type Props = {
  inventoryStocks: InventoryStock[]
  dataError?: string
  catalogError?: string
  stations: Station[]
  itemCatalog?: ItemCatalog[]
}

export function InventoryPage({ inventoryStocks, dataError, catalogError, stations, itemCatalog = [] }: Props) {
  const catalogMap = new Map(itemCatalog.map(item => [item.item_catalog_id || item.item_id, item]))
  const [stationFilter, setStationFilter] = useState('all')
  const [conditionFilter, setConditionFilter] = useState('all')
  const [query, setQuery] = useState('')

  const uniqueStations = useMemo(() =>
    [...new Map(inventoryStocks.filter(s => s.station_id).map(s => [s.station_id, s])).entries()].map(([sid]) => {
      const station = stations.find(st => st.station_id === sid)
      return { id: sid!, label: station?.name || station?.code || sid! }
    }),
    [inventoryStocks, stations]
  )

  const enriched = useMemo(() => inventoryStocks.map(stock => {
    const qty = stock.quantity == null ? null : Number(stock.quantity)
    const safety = stock.safety_stock_minimum == null ? null : Number(stock.safety_stock_minimum)
    const threshold = stock.reorder_threshold == null ? null : Number(stock.reorder_threshold)
    const known = qty != null && Number.isFinite(qty)
    const safetyKnown = safety != null && Number.isFinite(safety)
    const thresholdKnown = threshold != null && Number.isFinite(threshold)
    const belowSafety = known && safetyKnown && qty < safety
    const belowReorder = known && thresholdKnown && qty < threshold

    let conditionKey = 'unknown'
    let condition = 'Unknown'
    let tone: 'neutral' | 'warning' | 'danger' | 'success' = 'neutral'

    if (!known) { conditionKey = 'unknown'; condition = 'Unknown'; tone = 'neutral' }
    else if (qty === 0) { conditionKey = 'critical'; condition = 'Critical — zero stock'; tone = 'danger' }
    else if (belowSafety) { conditionKey = 'critical'; condition = 'Critical — below safety'; tone = 'danger' }
    else if (belowReorder) { conditionKey = 'low'; condition = 'Low — below reorder threshold'; tone = 'warning' }
    else if (safetyKnown || thresholdKnown) { conditionKey = 'normal'; condition = 'Normal'; tone = 'success' }

    const rawItem = stock.item_name || (stock.item_catalog_id ? catalogMap.get(stock.item_catalog_id)?.name : null)
    const itemLabel = recordLabel(rawItem, stock.item_catalog_id, 'Item name unavailable')

    let fillPct = 0
    if (known && thresholdKnown && threshold > 0) {
      fillPct = Math.min(100, Math.round((qty / threshold) * 100))
    }

    return { ...stock, qty, safety, threshold, known, condition, conditionKey, tone, itemLabel, fillPct }
  }), [inventoryStocks, catalogMap])

  const filtered = useMemo(() => enriched.filter(s => {
    const matchStation = stationFilter === 'all' || s.station_id === stationFilter
    const matchCond = conditionFilter === 'all' || s.conditionKey === conditionFilter
    const matchQuery = !query || s.itemLabel.toLowerCase().includes(query.toLowerCase()) ||
      (s.item_category ?? '').toLowerCase().includes(query.toLowerCase())
    return matchStation && matchCond && matchQuery
  }), [enriched, stationFilter, conditionFilter, query])

  const kpi = useMemo(() => {
    const total = enriched.length
    const critical = enriched.filter(s => s.conditionKey === 'critical').length
    const low = enriched.filter(s => s.conditionKey === 'low').length
    const normal = enriched.filter(s => s.conditionKey === 'normal').length
    const unknown = enriched.filter(s => s.conditionKey === 'unknown').length
    return { total, critical, low, normal, unknown }
  }, [enriched])

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="op-page-header">
        <div className="op-page-header-left">
          <p className="op-page-eyebrow">
            STATION SUPPLY STATUS
            <span className="prov-chip api">API</span>
          </p>
          <h1 className="op-page-title">Inventory</h1>
          <p className="op-page-desc">Station supply levels, stock conditions and reorder status. Movement history is not provided by the inventory API.</p>
        </div>
        <div className="op-page-header-right">
          {dataError && <span className="prov-chip unavail">DATA UNAVAILABLE</span>}
        </div>
      </div>

      {/* KPI STRIP */}
      {!dataError && (
        <div className="op-kpi-strip">
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Total records</span>
            <span className="op-kpi-value">{kpi.total}</span>
            <span className="op-kpi-sub">inventory lines</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Normal</span>
            <span className="op-kpi-value kpi-success">{kpi.normal}</span>
            <span className="op-kpi-sub">adequate stock</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Low</span>
            <span className={`op-kpi-value${kpi.low > 0 ? ' kpi-warning' : ' kpi-muted'}`}>{kpi.low}</span>
            <span className="op-kpi-sub">below reorder</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Critical</span>
            <span className={`op-kpi-value${kpi.critical > 0 ? ' kpi-danger' : ' kpi-muted'}`}>{kpi.critical}</span>
            <span className="op-kpi-sub">zero or below safety</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Unknown</span>
            <span className="op-kpi-value kpi-muted">{kpi.unknown}</span>
            <span className="op-kpi-sub">no threshold data</span>
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      {!dataError && (
        <div className="op-filter-bar">
          <span className="op-filter-label">Station</span>
          <select className="select-input" value={stationFilter} onChange={e => setStationFilter(e.target.value)}>
            <option value="all">All stations</option>
            {uniqueStations.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <div className="op-filter-sep" />
          <span className="op-filter-label">Condition</span>
          <select className="select-input" value={conditionFilter} onChange={e => setConditionFilter(e.target.value)}>
            <option value="all">All conditions</option>
            <option value="critical">Critical</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="unknown">Unknown</option>
          </select>
          <div className="op-filter-sep" />
          <input className="text-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Item name or category…" aria-label="Search inventory" />
        </div>
      )}

      {/* CATALOG ERROR NOTE */}
      {catalogError && !dataError && (
        <div className="notice-banner" role="status">
          Item catalog unavailable. Stock item names are shown where present in the API response; unresolved catalog references are labeled as unavailable.
        </div>
      )}

      {/* MAIN CONTENT */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">SUPPLY REGISTER</p>
            <h2>{dataError ? 'Inventory data unavailable' : `Inventory records (${filtered.length})`}</h2>
          </div>
        </div>

        {dataError ? (
          <div className="panel-body">
            <div className="op-empty-state">
              <div className="op-empty-icon">⚠</div>
              <p className="op-empty-title">INVENTORY DATA UNAVAILABLE</p>
              <p className="op-empty-desc">{dataError}</p>
              <span className="op-empty-source">SOURCE: API · REQUEST FAILED</span>
            </div>
          </div>
        ) : inventoryStocks.length === 0 ? (
          <div className="panel-body">
            <div className="op-empty-state">
              <div className="op-empty-icon">📦</div>
              <p className="op-empty-title">NO INVENTORY RECORDS</p>
              <p className="op-empty-desc">No inventory records are currently available from the API.</p>
              <span className="op-empty-source">SOURCE: API</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel-body">
            <EmptyState message="No inventory records match the current filters." />
          </div>
        ) : (
          <div className="op-table-wrap">
            <table className="op-table">
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="col-right">Quantity</th>
                  <th className="col-right">Safety stock</th>
                  <th className="col-right">Reorder threshold</th>
                  <th>Condition</th>
                  <th>Last updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(stock => (
                  <tr
                    key={stock.stock_id}
                    className={stock.conditionKey === 'critical' ? 'is-critical' : stock.conditionKey === 'low' ? 'is-warning' : ''}
                  >
                    <td><span className="op-cell-primary">{stationLabelById(stock.station_id, stations)}</span></td>
                    <td>
                      <span className="op-cell-primary">{stock.itemLabel}</span>
                    </td>
                    <td><span className="op-cell-secondary">{stock.item_category || 'Not provided'}</span></td>
                    <td className="col-right">
                      <span className="op-cell-mono">
                        {stock.known ? stock.qty : <span className="op-cell-secondary">—</span>}
                      </span>
                    </td>
                    <td className="col-right">
                      <span className="op-cell-mono">{stock.safety ?? <span className="op-cell-secondary">—</span>}</span>
                    </td>
                    <td className="col-right">
                      <span className="op-cell-mono">{stock.threshold ?? <span className="op-cell-secondary">—</span>}</span>
                    </td>
                    <td>
                      <StatusPill status={stock.condition} tone={stock.tone} />
                    </td>
                    <td>
                      <span className="op-cell-mono" style={{ fontSize: '10px' }}>
                        {stock.last_updated && !Number.isNaN(Date.parse(stock.last_updated))
                          ? formatDateTime(stock.last_updated, true)
                          : <span className="op-cell-secondary">Not provided</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
