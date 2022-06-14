/**
 * Defines potential error reasons
 */
export const FlagError = {
  MISSING_DISTINCT_ID: 'TARGETING_KEY_MISSING',
  MISSING_FEATURE_FLAG: 'FLAG_NOT_FOUND',
  SYSTEM_ERROR: 'GENERAL',
  UNSUPPORTED_FORMAT: 'TYPE_MISMATCH',
}

/**
 * Defines the reasons the flag got evaluated
 * to a specific value
 */
export const FlagResolution = {
  TARGETING_MATCH: 'TARGETING_MATCH',
  SPLIT: 'SPLIT',
  DISABLED: 'DISABLED',
  DEFAULT: 'DEFAULT',
  UNKNOWN: 'UNKNOWN',
}

/**
 * Name of the property for defining groups
 */
export const GROUPS_ATTRIBUTE = 'groups'
