const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() || ''

export const isAddressSearchConfigured = Boolean(mapboxToken)

function contextName(properties, key) {
  return properties?.context?.[key]?.name || ''
}

function contextCountryCode(properties) {
  return properties?.context?.country?.country_code?.toLowerCase() || ''
}

function mapFeature(feature) {
  const properties = feature.properties || {}
  const coordinates = properties.coordinates || {}
  const geometryCoordinates = feature.geometry?.coordinates || []
  const name = properties.name || feature.text || ''
  const city =
    contextName(properties, 'place') ||
    contextName(properties, 'locality') ||
    properties.context?.place?.text ||
    ''
  const region = contextName(properties, 'region') || properties.context?.region?.text || ''
  const country = contextName(properties, 'country') || properties.context?.country?.text || ''
  const postalCode =
    contextName(properties, 'postcode') || properties.context?.postcode?.text || ''
  const formattedAddress =
    properties.full_address ||
    [name, properties.place_formatted || feature.place_name].filter(Boolean).join(', ')

  return {
    addressLine1: name,
    city,
    country,
    countryCode: contextCountryCode(properties),
    formattedAddress,
    id: feature.id,
    label: formattedAddress,
    latitude: coordinates.latitude ?? geometryCoordinates[1] ?? null,
    longitude: coordinates.longitude ?? geometryCoordinates[0] ?? null,
    postalCode,
    region,
  }
}

export async function searchMapboxLocations(
  query,
  { countryCode = '', signal, types = 'place,region,country' } = {},
) {
  const normalizedQuery = query.trim()

  if (!mapboxToken || normalizedQuery.length < 3) {
    return []
  }

  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward')
  url.searchParams.set('access_token', mapboxToken)
  url.searchParams.set('autocomplete', 'true')
  url.searchParams.set('language', 'en')
  url.searchParams.set('limit', '5')
  url.searchParams.set('permanent', 'true')
  url.searchParams.set('q', normalizedQuery)
  url.searchParams.set('types', types)

  if (countryCode) {
    url.searchParams.set('country', countryCode)
  }

  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error('Address suggestions are temporarily unavailable.')
  }

  const payload = await response.json()
  return (payload.features || []).map(mapFeature).filter((item) => item.label)
}
