import { LoaderCircle, MapPin, Plus, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  isAddressSearchConfigured,
  searchMapboxLocations,
} from '../api/addressSearch'

function useLocationSuggestions(query, countryCode, types) {
  const [suggestions, setSuggestions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const isActive = isAddressSearchConfigured && query.trim().length >= 3

  useEffect(() => {
    const controller = new AbortController()

    if (!isActive) {
      return () => controller.abort()
    }

    const timeout = window.setTimeout(async () => {
      setIsLoading(true)
      setError('')

      try {
        const results = await searchMapboxLocations(query, {
          countryCode,
          signal: controller.signal,
          types,
        })
        setSuggestions(results)
      } catch (searchError) {
        if (searchError.name !== 'AbortError') {
          setError(searchError.message)
          setSuggestions([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }, 400)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [countryCode, isActive, query, types])

  return {
    error: isActive ? error : '',
    isLoading: isActive && isLoading,
    setSuggestions,
    suggestions: isActive ? suggestions : [],
  }
}

export function AddressSearchInput({ countryCode, onSelect }) {
  const [query, setQuery] = useState('')
  const { error, isLoading, setSuggestions, suggestions } = useLocationSuggestions(
    query,
    countryCode,
    'address,street',
  )

  return (
    <div className="location-combobox">
      <div className="location-search-control">
        <Search aria-hidden="true" size={18} />
        <input
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          autoComplete="street-address"
          placeholder="Start typing your street address"
          role="combobox"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setSuggestions([])
            }
          }}
        />
        {isLoading && <LoaderCircle aria-label="Searching addresses" className="spin" size={18} />}
      </div>
      {suggestions.length > 0 && (
        <div className="location-suggestions" role="listbox">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              role="option"
              type="button"
              onClick={() => {
                onSelect(suggestion)
                setQuery('')
                setSuggestions([])
              }}
            >
              <MapPin aria-hidden="true" size={17} />
              <span>{suggestion.label}</span>
            </button>
          ))}
        </div>
      )}
      {error && <small className="field-error">{error}</small>}
      {!isAddressSearchConfigured && (
        <small>Address suggestions need a Mapbox public token. You can still enter the fields manually.</small>
      )}
    </div>
  )
}

export function PreferredLocationInput({ countryCode, onChange, values }) {
  const [query, setQuery] = useState('')
  const { error, isLoading, setSuggestions, suggestions } = useLocationSuggestions(
    query,
    countryCode,
    'place,region,country',
  )

  function addLocation(label) {
    const value = label.trim()

    if (!value) {
      return
    }

    if (!values.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      onChange([...values, value])
    }

    setQuery('')
    setSuggestions([])
  }

  return (
    <div className="preferred-location-input">
      <div className="location-search-control">
        <Search aria-hidden="true" size={18} />
        <input
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          placeholder="Add a city, province/state, or country"
          role="combobox"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addLocation(query)
            }

            if (event.key === 'Escape') {
              setSuggestions([])
            }
          }}
        />
        {isLoading ? (
          <LoaderCircle aria-label="Searching locations" className="spin" size={18} />
        ) : (
          <button
            aria-label="Add preferred location"
            disabled={!query.trim()}
            type="button"
            onClick={() => addLocation(query)}
          >
            <Plus aria-hidden="true" size={17} />
          </button>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="location-suggestions" role="listbox">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              role="option"
              type="button"
              onClick={() => addLocation(suggestion.label)}
            >
              <MapPin aria-hidden="true" size={17} />
              <span>{suggestion.label}</span>
            </button>
          ))}
        </div>
      )}
      {error && <small className="field-error">{error}</small>}
      <div className="tag-input-values" aria-label="Selected preferred locations">
        {values.map((value) => (
          <span className="tag-chip" key={value}>
            {value}
            <button
              aria-label={`Remove ${value}`}
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              <X aria-hidden="true" size={15} />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
