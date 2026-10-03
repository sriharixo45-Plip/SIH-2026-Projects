export type GeographicReference = { latitude: number; longitude: number }

// Reference coordinates are geographical anchors, not confirmation of operational status.
export const POLAR_STATION_REFERENCES = {
  ncpor: { name: 'NCPOR / Central Operations', region: 'Goa, India', point: { latitude: 15.4909, longitude: 73.8278 } },
  maitri: { name: 'Maitri', region: 'Antarctica', point: { latitude: -70.7644, longitude: 11.7342 } },
  bharati: { name: 'Bharati', region: 'Antarctica', point: { latitude: -69.40683, longitude: 76.19533 } },
  himadri: { name: 'Himadri', region: 'Svalbard, Arctic', point: { latitude: 78.9232, longitude: 11.9233 } },
} as const satisfies Record<string, { name: string; region: string; point: GeographicReference }>

export const NETWORK_REFERENCES = {
  india: { latitude: 20.6, longitude: 78.9 },
  capeTown: { latitude: -33.9, longitude: 18.4 },
} satisfies Record<string, GeographicReference>
