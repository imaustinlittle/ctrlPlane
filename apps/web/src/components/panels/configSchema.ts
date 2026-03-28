// ── Field definitions ─────────────────────────────────────────────────────────
// Each widget exports a ConfigSchema that describes its editable fields.
// The ConfigPanel renders the right input for each field automatically.

export type FieldType =
  | 'text'
  | 'url'
  | 'password'
  | 'number'
  | 'toggle'
  | 'select'
  | 'color'
  | 'textarea'
  | 'url-list'         // list of {name, url, emoji} items
  | 'tag-list'         // simple list of strings
  | 'ha-entity-picker' // multi-select from live HA entity list

export interface SelectOption {
  value: string
  label: string
}

export interface ConfigField {
  key:         string
  label:       string
  type:        FieldType
  description?: string
  placeholder?: string
  defaultValue?: unknown
  options?:    SelectOption[]   // for 'select' type
  min?:        number           // for 'number' type
  max?:        number
  step?:       number
  required?:   boolean
}

export interface ConfigSchema {
  fields: ConfigField[]
}

// ── Widget config schemas ─────────────────────────────────────────────────────

export const CLOCK_SCHEMA: ConfigSchema = {
  fields: [
    {
      key: 'timezone',
      label: 'Timezone',
      type: 'select',
      description: 'Which timezone to display',
      defaultValue: 'local',
      options: [
        { value: 'local',                  label: 'Local time' },
        { value: 'America/New_York',       label: 'Eastern (ET)' },
        { value: 'America/Chicago',        label: 'Central (CT)' },
        { value: 'America/Denver',         label: 'Mountain (MT)' },
        { value: 'America/Los_Angeles',    label: 'Pacific (PT)' },
        { value: 'Europe/London',          label: 'London (GMT/BST)' },
        { value: 'Europe/Paris',           label: 'Paris (CET)' },
        { value: 'Asia/Tokyo',             label: 'Tokyo (JST)' },
        { value: 'Asia/Shanghai',          label: 'Shanghai (CST)' },
        { value: 'Australia/Sydney',       label: 'Sydney (AEDT)' },
        { value: 'UTC',                    label: 'UTC' },
      ],
    },
    {
      key: 'showSeconds',
      label: 'Show seconds',
      type: 'toggle',
      defaultValue: true,
    },
    {
      key: 'hour12',
      label: '12-hour time',
      type: 'toggle',
      defaultValue: false,
      description: 'Display AM/PM instead of 24-hour format',
    },
    {
      key: 'ntpUrl',
      label: 'Time sync URL (optional)',
      type: 'url',
      placeholder: 'http://worldtimeapi.org/api/ip',
      description: 'HTTP endpoint returning { unixtime } or { utc_datetime }. Leave blank to use system clock. Compatible with worldtimeapi.org or a self-hosted time API.',
    },
  ],
}

export const WEATHER_SCHEMA: ConfigSchema = {
  fields: [
    {
      key: 'location',
      label: 'Location',
      type: 'text',
      placeholder: 'e.g. Smyrna, GA',
      description: 'City name for weather display',
      defaultValue: 'Smyrna, GA',
    },
    {
      key: 'units',
      label: 'Units',
      type: 'select',
      defaultValue: 'imperial',
      options: [
        { value: 'imperial', label: 'Imperial (°F, mph)' },
        { value: 'metric',   label: 'Metric (°C, km/h)' },
      ],
    },
  ],
}

export const GAUGE_SCHEMA: ConfigSchema = {
  fields: [
    {
      key: 'label',
      label: 'Label',
      type: 'text',
      placeholder: 'e.g. CPU',
      description: 'Displayed in the widget header',
      defaultValue: 'CPU',
    },
    {
      key: 'metric',
      label: 'Metric',
      type: 'select',
      defaultValue: 'cpu',
      options: [
        { value: 'cpu',  label: 'CPU usage' },
        { value: 'ram',  label: 'Memory usage' },
        { value: 'temp', label: 'CPU temperature' },
      ],
    },
    {
      key: 'color',
      label: 'Color',
      type: 'select',
      defaultValue: 'green',
      options: [
        { value: 'green',  label: 'Green' },
        { value: 'blue',   label: 'Blue' },
        { value: 'purple', label: 'Purple' },
        { value: 'yellow', label: 'Yellow' },
        { value: 'red',    label: 'Red' },
      ],
    },
    {
      key: 'subtitle',
      label: 'Subtitle',
      type: 'text',
      placeholder: 'e.g. 16 cores · 3.2 GHz',
      description: 'Small text shown below the value',
    },
  ],
}

export const SERVICES_SCHEMA: ConfigSchema = {
  fields: [
    {
      key: 'services',
      label: 'Services',
      type: 'url-list',
      description: 'Services to monitor. Each entry needs a name and URL.',
    },
  ],
}

export const LINKS_SCHEMA: ConfigSchema = {
  fields: [
    {
      key: 'links',
      label: 'Links',
      type: 'url-list',
      description: 'Icon can be an emoji (📺) or an image URL (https://... or /local/image.png). Widget resizes automatically.',
    },
  ],
}

export const NETWORK_SCHEMA: ConfigSchema = {
  fields: [
    {
      key: 'interface',
      label: 'Network interface',
      type: 'text',
      placeholder: 'e.g. eth0',
      description: 'Interface name from /proc/net/dev (e.g. eth0, ens3, wlan0)',
      defaultValue: 'eth0',
    },
  ],
}

export const STORAGE_SCHEMA: ConfigSchema = {
  fields: [
    {
      key: 'showLabels',
      label: 'Show mount path',
      type: 'toggle',
      defaultValue: true,
      description: 'Show the mount path alongside the label',
    },
    {
      key: 'warnAt',
      label: 'Warning threshold (%)',
      type: 'number',
      defaultValue: 80,
      min: 50,
      max: 99,
      step: 5,
      description: 'Bar turns yellow above this percentage',
    },
    {
      key: 'criticalAt',
      label: 'Critical threshold (%)',
      type: 'number',
      defaultValue: 90,
      min: 60,
      max: 99,
      step: 5,
      description: 'Bar turns red above this percentage',
    },
  ],
}

export const CONTAINERS_SCHEMA: ConfigSchema = {
  fields: [
    {
      key: 'integrationName',
      label: 'Integration instance',
      type: 'text',
      placeholder: 'Leave blank to use the first configured Docker instance',
      description: 'Only needed if you have multiple Docker integrations configured.',
    },
    {
      key: 'showStopped',
      label: 'Show stopped containers',
      type: 'toggle',
      defaultValue: true,
    },
    {
      key: 'showCpu',
      label: 'Show CPU column',
      type: 'toggle',
      defaultValue: true,
    },
  ],
}

export const HOMEASSISTANT_SCHEMA: ConfigSchema = {
  fields: [
    {
      key: 'integrationName',
      label: 'Integration instance',
      type: 'text',
      placeholder: 'Leave blank to use the first configured instance',
      description: 'Only needed if you have multiple Home Assistant integrations configured.',
    },
    {
      key: 'selectedEntities',
      label: 'Entities',
      type: 'ha-entity-picker',
      description: 'Choose which entities to display. Leave empty to show all.',
    },
    {
      key: 'showDomain',
      label: 'Show domain label',
      type: 'toggle',
      defaultValue: false,
      description: 'Display the entity domain (e.g. sensor, light) next to each name',
    },
  ],
}

export const ALERTS_SCHEMA: ConfigSchema = {
  fields: [
    {
      key: 'showAcknowledged',
      label: 'Show acknowledged alerts',
      type: 'toggle',
      defaultValue: false,
    },
    {
      key: 'maxItems',
      label: 'Max alerts shown',
      type: 'number',
      defaultValue: 10,
      min: 3,
      max: 50,
      step: 1,
    },
  ],
}

// ── Schema registry ───────────────────────────────────────────────────────────
// Maps widget type → its config schema

export const WIDGET_SCHEMAS: Record<string, ConfigSchema> = {
  clock:         CLOCK_SCHEMA,
  weather:       WEATHER_SCHEMA,
  gauge:         GAUGE_SCHEMA,
  services:      SERVICES_SCHEMA,
  links:         LINKS_SCHEMA,
  network:       NETWORK_SCHEMA,
  storage:       STORAGE_SCHEMA,
  containers:    CONTAINERS_SCHEMA,
  alerts:        ALERTS_SCHEMA,
  homeassistant: HOMEASSISTANT_SCHEMA,
}
