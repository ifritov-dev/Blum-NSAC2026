# Fire Safety in Space

A web dashboard for exploring NASA microgravity combustion experiments. It helps students, teachers and engineers find, compare and interpret experiments relevant to fire safety on the space station, the Moon and Mars.

Built by team Blum for the NASA Space Apps Challenge (Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data), using real data from NASA Physical Sciences Informatics (PSI).

## What it does

| Feature | What you get |
| --- | --- |
| Filters (sidebar) | Search by series name, minimum number of tests, only series with oxygen data, series whose maximum O₂ reaches a chosen level. |
| Oxygen chart | O₂ range per series (Recharts), with reference lines for Earth (21%) and the expected lunar level (30% or more). Bars that reach 30% are highlighted. |
| Gap map | For every series, shows which parameters (pressure, airflow, fuel/material, sample size, diluent, temperature, combustion result, cameras/sensors) are present, partial or missing. A summary table shows what is missing most often. Export to Excel or CSV. |
| Series comparison | Side-by-side comparison of 2 to 3 series: parameter coverage, differences highlighted, shared and unique columns. |
| Relevance ranking | Goal-based scoring (Lunar 30%+ O₂, Predictive modeling, Suppression, Smoke/aerosol detection) with hardware context (CIR/ACME, MDCA, MSG) and Earth spin-offs. |
| Series catalog and card | Overview of all 22 series, and a detailed card with the raw tests and per-column data completeness. |
| SI Research Agent | Real-time SSE streaming chat in the sidebar powered by Coarena Model API (`gpt-6-luna`) with thinking effort control, live tool trace (`list_psi_series`, `inspect_psi_table`, `search_psi_records`), quick prompts, grounded PSI answers (series + PSI accession), and thumbs feedback. |

### Reading the gap map

- **Present**: the parameter is filled in at least 95% of the tests of the series.
- **Partial N%**: the parameter exists but is filled in only some tests.
- **Missing**: the parameter is not in this PSI table.
- For the Moon column: **Yes** means the series reaches 30% O2 or more, **No** means it does not, **n/a** means the table has no oxygen data.

## Important limitations

We state these openly because the dashboard is only as good as the data behind it.

- **Missing does not mean not studied.** A parameter absent from a PSI table may be stored in other PSI files (condition tables, measurement files). The gap map shows gaps in this dataset, not gaps in science.
- **No partial gravity data.** PSI has no Moon (about 0.16 g) or Mars (about 0.38 g) experiments yet. They are expected from the LUCI and FM2 experiments.
- **Rocket propellants are out of scope** of this database.
- **Parameters are matched by column names** (regular expressions), because every series names and measures its columns differently. False positives and false negatives are possible, so spot-check the results.
- **Oxygen units are partly assumed.** Some tables give oxygen without units. The app detects percent versus fraction where it can and writes any assumption in the Note column of the catalog. A few series are flagged for manual verification against PSI (for example a zero minimum, or a column without units).
- The fuel lists in the dataset filters contain obvious data errors, so nothing is built on them.

## Data

- Source: [NASA PSI, combustion experiments](https://psi.nasa.gov/physci/repo/search?q=combustion).
- File: `experimental_dataset.json` with the top-level keys `meta`, `filters` and `tables`.
- 22 tables (series), 2,009 tests in total. Each table has `id`, `source_file`, `psi_accession`, `series`, `row_count`, `columns` and `records`.
- Columns, names and units differ between series. Two series names are duplicated (CFI-G and ACME / Flame Design have two tables each), so tables are told apart by `id`.
- Some column names contain a stray BOM character, which is cleaned on load.

Please refer to PSI for the terms of use of the data.

## How it works

The application consists of a **FastAPI** backend (`backend/`) serving a **React + TypeScript + Tailwind CSS** single-page application (`frontend/`), with Docker deployment support (`Dockerfile`, `heroku.yml`):

1. **Data layer (`backend/psi_data.py`, `backend/constants.py`)**: loads and caches `experimental_dataset.json`, cleans stray BOM characters in column names, detects oxygen columns (excluding flow rates), converts fractions to percent, calculates parameter coverage across 9 categories, and computes goal-based relevance rankings.
2. **API & SSE streaming (`backend/main.py`)**: serves `/api/dataset`, `/api/series/{id}`, `/api/export/{csv|xlsx}`, `/api/agent/models`, `/api/agent/stream` (Server-Sent Events), `/api/agent/feedback`, and the built React SPA from `frontend/dist`.
3. **SI Research Agent (`backend/agent.py`, `backend/agent_tools.py`)**: streams reasoning and tool calls via Coarena's Anthropic-compatible API (`https://coarena.ai/api`, default model `gpt-6-luna`), inspecting PSI tables on demand with `list_psi_series`, `inspect_psi_table`, and `search_psi_records`, citing exact series names, PSI accession numbers, and CSV source files, and submitting ratings to `POST https://coarena.ai/api/v1/feedback`.
4. **Frontend (`frontend/src/`)**: interactive sidebar (filters & SI agent chat with live trace, thinking effort selector, dark/light theme, mobile layout) plus Recharts O₂ range visualization, gap map with export, goal-based ranking, series comparison, catalog, and raw test inspector.

## Run it locally

Requires Python 3.13+ and Node.js 20+.

1. Install Python dependencies and build the frontend:

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
npm --prefix frontend ci
npm --prefix frontend run build
```

2. Run the server:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

For frontend hot-reload during development, run `npm --prefix frontend run dev` (proxies `/api` to `http://127.0.0.1:8000`).

### Project layout

```
backend/
  main.py                    FastAPI server, REST endpoints, SSE stream, SPA serving
  psi_data.py                PSI dataset loading, O₂ normalization, coverage, ranking, export
  agent.py                   Coarena streaming AI agent & feedback client
  agent_tools.py             PSI inspection tool schemas & handlers
  constants.py               Domain tags, parameter regexes, challenge context, ranking goals
frontend/
  src/                       React + TypeScript + Tailwind dashboard & AI chat UI
experimental_dataset.json    NASA PSI data (22 tables, 2,009 tests)
Dockerfile / heroku.yml      Container deployment configuration
requirements.txt             Python dependencies
.streamlit/secrets.toml      API key (local only, never committed)
```

### AI assistant setup (Coarena Model API)

Configure via environment variables or `.streamlit/secrets.toml` (in `.gitignore`):

```toml
COARENA_API_KEY = "your_coarena_key"
COARENA_BASE_URL = "https://coarena.ai/api"
COARENA_MODEL = "gpt-6-luna"
COARENA_EFFORT = "medium"
```

Never commit an API key. If a key was ever pushed to GitHub, revoke it in your Coarena account and create a new one.

## Security notes

- React renders markdown safely without raw HTML injection (`unsafe_allow_html` / `dangerouslySetInnerHTML` are not used for dataset content).
- API keys are read from environment variables or `.streamlit/secrets.toml`, never hardcoded.
- CSV/Excel exports guard against spreadsheet formula injection (cells starting with `=`, `+`, `-` or `@` are prefixed).
- Server errors return generic messages to clients without stack traces or internal file paths.
- AI requests enforce question length (`500` chars) and session limits (`20` questions), with dataset text and user queries wrapped in data tags to mitigate prompt injection.

## Demo scenarios

1. **Engineer**: which series cover lunar conditions? Use the oxygen chart, the Moon column of the gap map, relevance ranking, and the SI agent.
2. **Student**: compare two series, for example SAFFIRE-2 and BASS-II.
3. **Researcher**: open the gap map, export it to Excel/CSV, and ask the SI agent which parameters are missing for future experiments.

## Team

| Role | Person |
| --- | --- |
| Full-stack architecture, FastAPI backend, React UI & SI Agent | Team Blum |
| Initial Streamlit prototype & frontend design | Oleksandra Nedielko |
| Data, scientific verification & deployment | Team Blum |

## Resources

- [PSI, combustion search](https://psi.nasa.gov/physci/repo/search?q=combustion)
- [NASA Combustion Science](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/)
- [A Researcher's Guide to Combustion Science](https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/)