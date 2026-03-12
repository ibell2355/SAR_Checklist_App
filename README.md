# PSAR Team Lead Checklist

A mobile-first, offline-friendly PWA checklist tool for Search and Rescue Team Leads. Built as a field memory aid for pre-departure procedures.

## Quick Start

```bash
# Start local dev server (requires Python 3)
npm start
# Then open http://127.0.0.1:4173
```

Or serve with any static file server pointed at the project root.

## How It Works

### Checklist Configuration (YAML)

Checklists are defined in YAML files under `config/`. The app reads these at startup — **edit checklist content without changing app code**.

**Current checklists:**
- `config/pre_departure.yaml` — Team Lead Pre-Departure Checklist

**YAML structure:**
```yaml
id: checklist_id
title: Checklist Title
subtitle: Optional subtitle
version: 1

sections:
  section_id:
    title: SECTION TITLE
    items:
      item_id:
        type: checkbox          # checkbox | text | team_list
        label: Item description
        important: true         # optional — visually emphasize
        helper: Tooltip text    # optional — helper text below item
        report: true            # optional — include in report output
        placeholder: hint text  # optional — for text inputs
        roles: [role1, role2]   # for team_list type only
```

**Supported item types:**
| Type | Description |
|------|-------------|
| `checkbox` | Standard check-off item |
| `text` | Short text input field |
| `team_list` | Team member list with name + role assignment |

### Adding a New Checklist

1. Create a new YAML file in `config/` (e.g., `config/segment.yaml`)
2. Follow the structure above
3. Update `src/main.js` to load the new config
4. Add a route and button for the new checklist
5. Update `service-worker.js` APP_SHELL to include the new YAML file
6. Bump `CACHE_NAME` in the service worker

### Branding Assets

All brand assets live in `assets/`:

| File | Purpose |
|------|---------|
| `psar_logo.png` | App logo (header, landing page) |
| `icon-192.png` | PWA home screen icon (192x192) |
| `icon-512.png` | PWA install/splash icon (512x512) |

Source brand materials are in `Docs/` for reference.

### Offline & Resume Behavior

- **Service worker** pre-caches all app files on first visit
- **IndexedDB** persists checklist state with 250ms debounced saves
- Closing and reopening the app restores your in-progress checklist
- Only one active checklist session at a time
- Reset clears all progress (with confirmation)

### Theme

Light/dark theme toggle on the landing page. Preference saved in localStorage.

## Project Structure

```
SAR_Checklist_App/
├── index.html              # App entry point
├── manifest.webmanifest    # PWA manifest
├── service-worker.js       # Offline caching
├── package.json            # Version & scripts
├── assets/                 # Logo, icons
├── config/                 # YAML checklist definitions
│   └── pre_departure.yaml
├── src/
│   ├── main.js             # Routing, state, events, persistence
│   ├── ui/
│   │   ├── render.js       # View rendering functions
│   │   └── styles.css      # All styles (light/dark themes)
│   ├── model/
│   │   └── configLoader.js # YAML config loader
│   ├── storage/
│   │   └── db.js           # IndexedDB persistence
│   └── utils/
│       └── simpleYaml.js   # Lightweight YAML parser
└── Docs/                   # Source brand materials & checklist doc
```

## Deployment

This is a static site. Deploy to any static hosting:

1. Run `npm run stamp` to update the build date
2. Upload all files to your hosting provider
3. Ensure the server serves `manifest.webmanifest` with the correct MIME type
4. Generate a QR code for your deployment URL and replace the placeholder on the landing page

### QR Code Setup

The landing page includes a placeholder QR graphic. To add a real QR code:
1. Generate a QR code PNG for your deployment URL
2. Save it as `assets/qrcode.png`
3. Update the QR placeholder in `src/ui/render.js` (`renderLanding` function) to reference the image
4. Add `./assets/qrcode.png` to the APP_SHELL array in `service-worker.js`
5. Bump `CACHE_NAME`

## Important Note

This tool is a **memory aid** for team leads. It does not replace required notebook documentation or official SAR procedures.
