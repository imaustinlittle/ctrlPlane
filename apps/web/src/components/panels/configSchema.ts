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
      placeholder: 'e.g. Atlanta, GA',
      description: 'City name for weather display',
      defaultValue: 'Atlanta, GA',
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
    {
      key: 'timeWindow',
      label: 'Time window',
      type: 'select',
      defaultValue: 5,
      description: 'How much history to show in the scrolling chart',
      options: [
        { value: '1',  label: '1 minute' },
        { value: '3',  label: '3 minutes' },
        { value: '5',  label: '5 minutes' },
        { value: '10', label: '10 minutes' },
      ],
    },
  ],
}

export const STORAGE_SCHEMA: ConfigSchema = {
  fields: [
    {
      key: 'mounts',
      label: 'Mount points',
      type: 'tag-list',
      description: 'Which mount points to display. Leave empty to show all.',
      placeholder: 'e.g. / or /data',
    },
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

const arrFields = (port: number): ConfigField[] => [
  { key: 'url',    label: 'URL',     type: 'url',      placeholder: `http://192.168.1.x:${port}`, required: true },
  { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Settings → General → Security', required: true },
]

export const SONARR_SCHEMA: ConfigSchema = { fields: arrFields(8989) }
export const RADARR_SCHEMA: ConfigSchema = { fields: arrFields(7878) }
export const LIDARR_SCHEMA: ConfigSchema = { fields: arrFields(8686) }

export const QBITTORRENT_SCHEMA: ConfigSchema = {
  fields: [
    { key: 'url',      label: 'URL',      type: 'url',      placeholder: 'http://192.168.1.x:8080', required: true },
    { key: 'username', label: 'Username', type: 'text',     placeholder: 'admin', defaultValue: 'admin' },
    { key: 'password', label: 'Password', type: 'password', placeholder: 'WebUI password', required: true },
  ],
}

export const SABNZBD_SCHEMA: ConfigSchema = {
  fields: [
    { key: 'url',    label: 'URL',     type: 'url',      placeholder: 'http://192.168.1.x:8080', required: true },
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Config → General → API Key', required: true },
  ],
}

export const OPNSENSE_SCHEMA: ConfigSchema = {
  fields: [
    { key: 'url',       label: 'URL',        type: 'url',      placeholder: 'https://192.168.1.1', required: true },
    { key: 'apiKey',    label: 'API Key',    type: 'password', placeholder: 'System → Access → Users → API key', required: true },
    { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: 'API secret', required: true },
  ],
}

export const PIHOLE_SCHEMA: ConfigSchema = {
  fields: [
    { key: 'url',    label: 'URL',       type: 'url',      placeholder: 'http://192.168.1.x', required: true },
    { key: 'apiKey', label: 'API Token', type: 'password', placeholder: 'Settings → API → Show API token', required: true },
  ],
}

export const ADGUARDHOME_SCHEMA: ConfigSchema = {
  fields: [
    { key: 'url',      label: 'URL',      type: 'url',      placeholder: 'http://192.168.1.x:3000', required: true },
    { key: 'username', label: 'Username', type: 'text',     placeholder: 'admin', defaultValue: 'admin' },
    { key: 'password', label: 'Password', type: 'password', placeholder: 'AdGuard login password', required: true },
  ],
}

export const PLEX_SCHEMA: ConfigSchema = {
  fields: [
    { key: 'url',   label: 'URL',          type: 'url',      placeholder: 'http://192.168.1.x:32400', required: true },
    { key: 'token', label: 'Access Token', type: 'password', placeholder: 'X-Plex-Token from plex.tv/web → Account → XML', required: true },
  ],
}

export const TAUTULLI_SCHEMA: ConfigSchema = {
  fields: [
    { key: 'url',    label: 'URL',     type: 'url',      placeholder: 'http://192.168.1.x:8181', required: true },
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Settings → Web Interface → API key', required: true },
  ],
}

export const CALENDAR_SCHEMA: ConfigSchema = {
  fields: [
    {
      key:         'feedUrl',
      label:       'iCal Feed URL',
      type:        'url',
      placeholder: 'https://calendar.google.com/calendar/ical/…/basic.ics',
      description: 'Google: Settings → your calendar → "Secret address in iCal format". Apple: share calendar → copy link.',
      required:    true,
    },
    {
      key:          'days',
      label:        'Look-ahead (days)',
      type:         'number',
      defaultValue: 30,
      min:          1,
      max:          365,
      step:         1,
      description:  'How many days ahead to show events',
    },
    {
      key:         'label',
      label:       'Calendar name',
      type:        'text',
      placeholder: 'e.g. Work, Family',
      description: 'Shown in the widget header',
    },
  ],
}

// ── Schema registry ───────────────────────────────────────────────────────────
// Maps widget type → its config schema

export const WIDGET_SCHEMAS: Record<string, ConfigSchema> = {
  sysmetrics:    { fields: [] },
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
  sonarr:        SONARR_SCHEMA,
  radarr:        RADARR_SCHEMA,
  lidarr:        LIDARR_SCHEMA,
  qbittorrent:   QBITTORRENT_SCHEMA,
  sabnzbd:       SABNZBD_SCHEMA,
  opnsense:      OPNSENSE_SCHEMA,
  pihole:        PIHOLE_SCHEMA,
  adguardhome:   ADGUARDHOME_SCHEMA,
  plex:          PLEX_SCHEMA,
  tautulli:      TAUTULLI_SCHEMA,
  calendar:      CALENDAR_SCHEMA,
}
