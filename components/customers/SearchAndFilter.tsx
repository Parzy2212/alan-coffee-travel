'use client'

const GOLD   = '#c9a84c'
const BORDER = 'rgba(255,255,255,0.1)'

export type CustomerFilter = 'all' | 'vip' | 'regular' | 'birthday'
export type CustomerSort   = 'recent' | 'spend' | 'points'

interface SearchAndFilterProps {
  search:    string
  filter:    CustomerFilter
  sort:      CustomerSort
  onSearch:  (v: string) => void
  onFilter:  (v: CustomerFilter) => void
  onSort:    (v: CustomerSort) => void
  onSubmit?: () => void
}

export function SearchAndFilter({ search, filter, sort, onSearch, onFilter, onSort, onSubmit }: SearchAndFilterProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
      {/* Search row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit?.() }}
          placeholder="ค้นหาชื่อ หรือ เบอร์โทร..."
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            border: `1px solid ${BORDER}`, backgroundColor: '#151515',
            color: '#fff', fontSize: 14,
          }}
        />
        <button
          onClick={onSubmit}
          style={{
            padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}12`,
            color: GOLD, fontSize: 13, fontWeight: 700,
          }}
        >ค้นหา</button>
      </div>

      {/* Filter + Sort row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* Filter chips */}
        {(['all', 'vip', 'regular', 'birthday'] as CustomerFilter[]).map(f => {
          const labels: Record<CustomerFilter, string> = { all: 'ทั้งหมด', vip: 'VIP', regular: 'ปกติ', birthday: 'วันเกิดวันนี้' }
          const on = filter === f
          return (
            <button key={f} onClick={() => onFilter(f)} style={{
              padding: '6px 14px', borderRadius: 99, cursor: 'pointer', fontSize: 12, fontWeight: on ? 700 : 400,
              border: `1px solid ${on ? GOLD : BORDER}`,
              backgroundColor: on ? `${GOLD}18` : 'transparent',
              color: on ? GOLD : 'rgba(255,255,255,0.45)',
              transition: 'all 0.12s',
            }}>{labels[f]}</button>
          )
        })}

        <div style={{ flex: 1 }} />

        {/* Sort select */}
        <select
          value={sort}
          onChange={e => onSort(e.target.value as CustomerSort)}
          style={{
            padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
            border: `1px solid ${BORDER}`, backgroundColor: '#151515',
            color: 'rgba(255,255,255,0.6)', fontSize: 12,
          }}
        >
          <option value="recent">ล่าสุด</option>
          <option value="spend">ยอดซื้อสูงสุด</option>
          <option value="points">คะแนนสูงสุด</option>
        </select>
      </div>
    </div>
  )
}
