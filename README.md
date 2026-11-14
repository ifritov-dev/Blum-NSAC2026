# Fire Safety in Space

A web dashboard for exploring NASA microgravity combustion experiments. It helps students, teachers and engineers find, compare and interpret experiments relevant to fire safety on the space station, the Moon and Mars.

Built by team Blum for the NASA Space Apps Challenge (Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data), using real data from NASA Physical Sciences Informatics (PSI).

## What it does

| Feature | What you get |
| --- | --- |
| Filters (sidebar) | Search by series name, minimum number of tests, only series with oxygen data, series whose maximum O2 reaches a chosen level. |
| Oxygen chart | O2 range per series, with reference lines for Earth (21%) and the expected lunar level (30% or more). Bars that reach 30% are highlighted. |
| Gap map | For every series, shows which parameters (pressure, airflow, fuel/material, sample size, diluent, temperature, combustion result, cameras/sensors) are present, partial or missing. A summary table shows what is missing most often. Export to Excel or CSV. |
| Series comparison | Side-by-side comparison of 2 to 3 series: parameter coverage, differences highlighted, shared and unique columns. |
| Series catalog and card | Overview of all series, and a detailed card with the raw tests and per-column data completeness. |
| AI assistant | A chat in the sidebar that answers questions only from the dataset, naming the series and PSI accession number. **Status: in progress** (the place and the connection code are prepared in `app.py`). |

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

The whole app is one Streamlit script, `app.py`, organized in blocks:

1. Load and clean the data (cached with `st.cache_data`; the cache resets if the file changes).
2. Detect oxygen columns by name, exclude flow rates (such as "O2 flow rate"), and convert fractions to percent.
3. Sidebar filters.
4. Oxygen chart (Plotly).
5. Gap map. This block must stay above the comparison and series card, which reuse its helpers.
6. Series comparison, catalog and series card.

The AI assistant lives in `ai.py` and is called as `ask(question, tables)`. It must answer only from the data, name the series and PSI accession, and say so when the data is missing.

## Run it locally

Requires Python 3.13.

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

Run it from the project folder, in a terminal (not with an IDE run button), so that `.streamlit/config.toml` and the data file are found.

### Project layout

```
app.py                       the dashboard
ai.py                        AI assistant (in progress)
experimental_dataset.json    PSI data
requirements.txt             dependencies
.streamlit/config.toml       colors and theme
.streamlit/secrets.toml      API key (never committed)
```

### AI assistant setup

Create `.streamlit/secrets.toml` (it is in `.gitignore`):

```
ANTHROPIC_API_KEY = "your key"
```

Never commit a key. If a key was ever pushed to GitHub, revoke it in the Anthropic console and create a new one.

## Security notes

- The app never renders raw HTML (`unsafe_allow_html` is not used), so dataset text cannot inject markup.
- The API key is read from Streamlit secrets or an environment variable, never from code.
- Exports guard against spreadsheet formula injection (cells starting with `=`, `+`, `-` or `@` are prefixed).
- Data loading errors show a generic message, not a stack trace or file paths. For a public deployment also set `showErrorDetails = "none"` under `[client]` in `.streamlit/config.toml`.
- AI requests are limited (question length, answers per session, token and time limits), and dataset text is passed to the model as data, not as instructions.

## Demo scenarios

1. **Engineer**: which series cover lunar conditions? Use the oxygen chart, the Moon column of the gap map, and the AI chat.
2. **Student**: compare two series, for example SAFFIRE-2 and BASS-II.
3. **Researcher**: open the gap map, export it, and see which parameters are missing for future experiments.

## Team

| Role | Person |
| --- |  |
| Data and scientific verification | TODO |
| Frontend (Streamlit) | Oleksandra Nedielko |
| AI assistant (`ai.py`) | TODO |
| The chart, presentation, README | TODO |

## Resources

- [PSI, combustion search](https://psi.nasa.gov/physci/repo/search?q=combustion)
- [NASA Combustion Science](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/)
- [A Researcher's Guide to Combustion Science](https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/)