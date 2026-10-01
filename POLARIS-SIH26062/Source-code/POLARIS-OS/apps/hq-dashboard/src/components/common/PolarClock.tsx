import { useEffect, useState } from 'react'

const STATION_LONGITUDES = {
  maitri: 11.7342,
  bharati: 76.1953,
} as const

function solarOffset(longitude: number): number {
  return longitude * 240_000
}

function solarUtcOffsetLabel(longitude: number): string {
  const totalMinutes = Math.round(longitude * 4)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `UTC+${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatUtcTime(timestamp: number, hour12: boolean): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12,
  }).format(timestamp)
}

function formatUtcDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(timestamp)
}

export function PolarClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const istTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(now)
  const clocks = [
    { key: 'ist', name: 'IST', time: istTime, date: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(now), detail: 'Indian Standard Time', offset: 'UTC+05:30' },
    ...Object.entries(STATION_LONGITUDES).map(([name, longitude]) => {
      const stationTimestamp = now + solarOffset(longitude)
      return {
        key: name,
        name: name.toUpperCase(),
        time: formatUtcTime(stationTimestamp, true),
        date: formatUtcDate(stationTimestamp),
        detail: 'Local Solar Time',
        offset: solarUtcOffsetLabel(longitude),
      }
    }),
  ]

  return <div className="polar-clocks" aria-label="Reference clocks">
    {clocks.map((clock) => <div className="polar-clock" key={clock.key} title={clock.key === 'ist' ? clock.detail : `${clock.detail}, calculated from station longitude relative to UTC. This is a geographic reference, not an official operating timezone.`}>
      <strong className="polar-clock-name">{clock.name}</strong>
      <time className="polar-clock-time" dateTime={new Date(clock.key === 'ist' ? now : now + solarOffset(STATION_LONGITUDES[clock.key as keyof typeof STATION_LONGITUDES])).toISOString()}>{clock.time}</time>
      <span className="polar-clock-date">{clock.date}</span>
      <span className="polar-clock-detail">{clock.key === 'ist' ? clock.detail : `${clock.detail} · ${clock.offset}`}</span>
    </div>)}
  </div>
}
