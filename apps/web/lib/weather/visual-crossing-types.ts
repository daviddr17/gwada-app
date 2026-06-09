/** Relevante Felder der Visual-Crossing-Timeline-JSON (nicht-flach). */

export type VisualCrossingCurrent = {
  datetime?: string
  temp?: number
  feelslike?: number
  humidity?: number
  precipprob?: number
  windspeed?: number
  winddir?: number
  uvindex?: number
  conditions?: string
  icon?: string
}

export type VisualCrossingDay = {
  datetime?: string
  temp?: number
  tempmax?: number
  tempmin?: number
  precipprob?: number
  sunrise?: string
  sunset?: string
  description?: string
  conditions?: string
  icon?: string
}

export type VisualCrossingTimelineResponse = {
  resolvedAddress?: string
  address?: string
  description?: string
  days?: VisualCrossingDay[]
  currentConditions?: VisualCrossingCurrent
}
