import json
import re
from io import BytesIO
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

st.set_page_config(page_title="Fire Safety in Space", layout="wide",
                   initial_sidebar_state="expanded")

# Path is built relative to this file, so the app works from any working directory
DATA_PATH = Path(__file__).parent / "experimental_dataset.json"

# ---------------------------------------------------------------------------
# Palette (page-wide colors live in .streamlit/config.toml; these are for
# charts and table highlighting)
# ---------------------------------------------------------------------------
BLUE = "#2E86C1"
LIGHT_BLUE = "#D6EAF8"
RED = "#D64545"
LIGHT_RED = "#F9D6D5"
ORANGE = "#F28C28"
LIGHT_ORANGE = "#FDEBD0"
NAVY = "#12263A"

STYLE_GOOD = f"background-color: {LIGHT_BLUE}; color: {NAVY}"
STYLE_PARTIAL = f"background-color: {LIGHT_ORANGE}; color: {NAVY}"
STYLE_BAD = f"background-color: {LIGHT_RED}; color: {NAVY}"


# ---------------------------------------------------------------------------
# Data loading and O2 detection
# ---------------------------------------------------------------------------

def clean(s):
    # Removes the stray BOM marker that shows up as "ï»¿" in some column names
    return str(s).replace("ï»¿", "").replace("\ufeff", "").strip()


# Columns that look like oxygen concentration vs. columns that must be excluded
# (e.g. "O2 flow rate (mg/s)" is a flow, not a concentration)
O2_INCLUDE = re.compile(r"\bX?O2\b|oxygen|\bO\s+initial|O₂", re.I)
O2_EXCLUDE = re.compile(r"\brate\b|mg/s|sccm", re.I)


def to_num(v):
    # Extracts the first number from a value; returns None if there is none
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    if isinstance(v, str):
        m = re.search(r"-?\d+(?:\.\d+)?", v.replace(",", "."))
        if m:
            return float(m.group())
    return None


def col_to_percent(name, vals):
    # Percent/% columns are already percentages; Fraction/XO2 are fractions (x100)
    n = name.lower()
    if "percent" in n or "%" in n:
        return vals, ""
    if "fraction" in n or re.match(r"x\s*o2", n):
        return [v * 100 for v in vals], ""
    if vals and max(vals) <= 1:
        return [v * 100 for v in vals], f"{name}: units assumed (fraction)"
    return vals, f"{name}: units assumed (%)"


def o2_profile(t):
    # Returns {cols, min, max, note} describing oxygen in one table
    cols = [c for c in t["columns"] if O2_INCLUDE.search(c) and not O2_EXCLUDE.search(c)]
    allv, notes = [], []
    for c in cols:
        vals = [to_num(r.get(c)) for r in t["records"]]
        vals = [v for v in vals if v is not None]
        if not vals:
            continue
        vals, note = col_to_percent(c, vals)
        allv += vals
        if note:
            notes.append(note)
    kept = [v for v in allv if 0 <= v <= 100]
    if len(kept) < len(allv):
        notes.append("values outside 0-100 discarded")
    zeros = sum(1 for v in kept if v == 0)
    if zeros:
        notes.append(f"zeros: {zeros}")
    if not kept:
        return {"cols": cols, "min": None, "max": None,
                "note": "; ".join(notes) or "no oxygen column found"}
    return {"cols": cols, "min": min(kept), "max": max(kept), "note": "; ".join(notes)}


@st.cache_data
def load_data(path, mtime):
    # Cached: Streamlit reruns the whole script on every click, so we read and
    # process the JSON only once. `mtime` makes the cache reset if the file changes.
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for t in data["tables"]:
        t["columns"] = [clean(c) for c in t["columns"]]
        t["records"] = [{clean(k): v for k, v in r.items()} for r in t["records"]]
        t["o2"] = o2_profile(t)
    return data


try:
    data = load_data(str(DATA_PATH), DATA_PATH.stat().st_mtime)
    meta = data["meta"]
    tables = data["tables"]
    if not tables:
        raise ValueError("no tables")
except (OSError, ValueError, KeyError, TypeError):
    # Generic message on purpose: no stack trace or file paths shown to the user
    st.error("Could not load the dataset. Make sure experimental_dataset.json "
             "is next to app.py and contains valid data.")
    st.stop()


# ---------------------------------------------------------------------------
# Page title and dataset overview
# ---------------------------------------------------------------------------

st.title("Fire Safety in Space")
st.caption("Explore NASA PSI microgravity combustion experiments to support fire safety "
           "on the space station, the Moon and Mars.")

total_tests = sum(t["row_count"] for t in tables)
moon_series_total = sum(1 for t in tables if t["o2"]["max"] is not None and t["o2"]["max"] >= 30)
k1, k2, k3 = st.columns(3)
k1.metric("Series in dataset", len(tables))
k2.metric("Tests in total", f"{total_tests:,}")
k3.metric("Series reaching 30% O₂", moon_series_total)


# ---------------------------------------------------------------------------
# Sidebar: filters
# ---------------------------------------------------------------------------

def reset_filters():
    # Runs as a button callback, before widgets are drawn on the next rerun
    st.session_state["search"] = ""
    st.session_state["min_tests"] = 0
    st.session_state["only_o2"] = False
    st.session_state["o2_threshold"] = 0


# The sidebar stays visible while the main page is scrolled, so the AI chat
# (second tab) can be used right next to the data.
with st.sidebar:
    st.title("Explore")
    found_box = st.empty()  # filled below, once the filtered list is known
    # Tab labels accept markdown: bold text, theme colors and Material icons (not emojis)
    tab_filters, tab_ai = st.tabs([
        ":material/tune: :blue[**Filters**]",
        ":material/smart_toy: :orange[**AI assistant**]",
    ])

    with tab_filters:
        st.subheader("Search")
        search = st.text_input("Series name", key="search", max_chars=100,
                               placeholder="for example: SAFFIRE")

        st.subheader("Oxygen")
        only_o2 = st.checkbox("Only series with O₂ data", key="only_o2")
        o2_threshold = st.slider("Series max O₂ at least, %", 0, 100, 0, key="o2_threshold",
                                 help="Keeps series whose highest O₂ value reaches this level. "
                                      "Set 30 to see series relevant for lunar conditions.")

        st.subheader("Size")
        max_tests = max(t["row_count"] for t in tables)
        min_tests = st.slider("Minimum tests in a series", 0, max_tests, 0, key="min_tests")

        st.button("Reset filters", on_click=reset_filters, use_container_width=True)

        st.divider()
        with st.expander("About this data"):
            st.markdown(
                "Source: NASA Physical Sciences Informatics (PSI), combustion experiments. "
                "[Open PSI](https://psi.nasa.gov/physci/repo/search?q=combustion)"
            )
            st.markdown(
                "Not in a PSI table does not mean not studied: condition and measurement "
                "tables are stored in other PSI files. Partial gravity data (Moon, Mars) "
                "is not in PSI yet."
            )

    # -----------------------------------------------------------------------
    # AI assistant: PLACEHOLDER for the teammate working on ai.py
    #
    # Contract suggestion:
    #   ai.py exposes  ask(question: str, tables: list) -> str
    #   (returns plain text/markdown; may return None or raise: the code below
    #   catches it and shows a generic error)
    #
    # Security notes for whoever implements this:
    #   - API key only from st.secrets["ANTHROPIC_API_KEY"] or an env variable,
    #     never hardcoded and never committed (.streamlit/secrets.toml is gitignored)
    #   - limit question length, set max_tokens and a timeout, rate-limit per session
    #   - treat dataset text and the question as DATA, not instructions (prompt injection)
    #   - do not send the whole dataset: pre-select relevant series in code first
    #   - render the answer with st.markdown WITHOUT unsafe_allow_html=True
    #   - show a generic error to the user, never a traceback or the key
    # -----------------------------------------------------------------------
    with tab_ai:
        st.subheader("Ask about the experiments")
        st.info("Coming soon: ask questions about the experiments. "
                "Answers will be based only on PSI data.")

        # from ai import ask
        #
        # MAX_QUESTION_LEN = 500
        # MAX_QUESTIONS_PER_SESSION = 20
        #
        # # Chat history lives in session_state as (role, text) pairs
        # history = st.session_state.setdefault("chat_history", [])
        # for role, text in history:
        #     with st.chat_message(role):
        #         if role == "assistant":
        #             st.markdown(text)  # no unsafe_allow_html
        #         else:
        #             st.text(text)  # user text shown as plain text
        #
        # question = st.chat_input("Ask about the experiments", max_chars=MAX_QUESTION_LEN)
        # if question:
        #     if len(history) // 2 >= MAX_QUESTIONS_PER_SESSION:
        #         st.warning("Question limit reached for this session.")
        #     else:
        #         history.append(("user", question))
        #         with st.spinner("Thinking..."):
        #             try:
        #                 answer = ask(question, tables)
        #             except Exception:
        #                 answer = None  # log details server-side, never show them to the user
        #         history.append(("assistant", answer or "Could not get an answer. Please try again."))
        #         st.rerun()


def passes(t):
    if search.lower() not in t["series"].lower():
        return False
    if t["row_count"] < min_tests:
        return False
    hi = t["o2"]["max"]
    if only_o2 and hi is None:
        return False
    if o2_threshold > 0 and (hi is None or hi < o2_threshold):
        return False
    return True


filtered = [t for t in tables if passes(t)]
found_box.metric("Series found", f"{len(filtered)} / {len(tables)}")

if not filtered:
    st.info("No series match these filters.")
    st.stop()


# ---------------------------------------------------------------------------
# O2 chart
# ---------------------------------------------------------------------------

st.subheader("Oxygen by series", divider="blue")
with_o2 = [t for t in filtered if t["o2"]["min"] is not None]
no_o2 = [t["series"] for t in filtered if t["o2"]["min"] is None]

if with_o2:
    los, his = [], []
    for t in with_o2:
        lo, hi = t["o2"]["min"], t["o2"]["max"]
        if hi - lo < 1:  # widen single-value series so the bar is visible
            lo, hi = lo - 0.5, hi + 0.5
        los.append(lo)
        his.append(hi)

    fig = go.Figure(go.Bar(
        x=[f'{t["series"]} #{t["id"]}' for t in with_o2],
        y=[h - l for l, h in zip(los, his)],
        base=los,
        # Orange = series reaches the lunar level (30%+), blue = stays below
        marker_color=[ORANGE if t["o2"]["max"] >= 30 else BLUE for t in with_o2],
        customdata=[[round(t["o2"]["min"], 1), round(t["o2"]["max"], 1)] for t in with_o2],
        hovertemplate="%{x}<br>O₂: %{customdata[0]}–%{customdata[1]} %<extra></extra>",
    ))
    fig.add_hrect(y0=30, y1=100, fillcolor=ORANGE, opacity=0.10, line_width=0,
                  annotation_text="Moon: 30%+", annotation_position="top left",
                  annotation_font_color=ORANGE)
    fig.add_hline(y=21, line_dash="dash", line_color=RED,
                  annotation_text="Earth: 21%", annotation_font_color=RED)
    fig.update_yaxes(title="O₂ concentration, %", range=[0, 100], gridcolor=LIGHT_BLUE)
    fig.update_layout(plot_bgcolor="white", font_color=NAVY, margin=dict(t=30, b=10))
    st.plotly_chart(fig, use_container_width=True)

    n_moon = sum(1 for t in with_o2 if t["o2"]["max"] >= 30)
    # Only numbers are interpolated here, so the markdown color syntax is safe
    st.markdown(f"**{n_moon} of {len(with_o2)}** series (with known O₂) reach :orange[30% or more] "
                "(orange bars).")
else:
    st.info("No series with known O₂ under these filters.")

# Reference conditions, shown next to the chart that uses the 21% and 30% lines
st.caption("Reference conditions: Earth 21% O₂ at 14.7 psi; lunar base (expected) 30% O₂ or more "
           "at up to 10.2 psi; spacesuit 100% O₂ at 4.3 psi. The more oxygen, the easier materials "
           "ignite, so it matters to know how they behave under lunar conditions.")

if no_o2:
    st.caption("No oxygen in the PSI table columns (not shown on the chart): " + ", ".join(no_o2))


# ---------------------------------------------------------------------------
# Gap map
# NOTE: this block must stay ABOVE the comparison and series card sections,
# because they reuse PARAMS, fill_share and cell_label.
# ---------------------------------------------------------------------------

st.subheader("Gap map: what is missing from the tables", divider="red")
st.caption("Missing = this parameter is not in the PSI table (it does not mean it was not measured, "
           "only that it is absent from this data). "
           "Partial = the parameter exists but is filled in only some of the tests. "
           "n/a = the table has no oxygen, so it is unknown. "
           "Parameters are matched by column names, so spot-check the results.")

PARAMS = {
    "O₂": None,  # taken from the oxygen calculation above
    "Pressure": re.compile(r"pressure|^p(init|final|mean)\b|^approx p\b", re.I),
    "Airflow": re.compile(r"air flow|air rate|air display|fan|velocity|flow restrictor", re.I),
    "Fuel/material": re.compile(r"fuel|material|fiber|sample type", re.I),
    "Sample/burner size": re.compile(r"thickness|length|width|diameter|nozzle|burner size", re.I),
    "Diluent (N₂/He/CO₂)": re.compile(r"nitrogen|helium|\bn2\b|\bhe\b|n initial|he initial|co2|gas mixture", re.I),
    "Temperature": re.compile(r"temp|^tad\b", re.I),
    "Combustion result": re.compile(r"burn time|burn length|spread|extinction|burning rate|ignited|hot ignition", re.I),
    "Cameras/sensors": re.compile(r"camera|radiometer|frames", re.I),
}


def fill_share(t, cols):
    # Share of tests where at least one of the given columns is filled
    if not cols or not t["records"]:
        return 0.0
    ok = sum(1 for r in t["records"] if any(r.get(c) not in (None, "") for c in cols))
    return ok / len(t["records"])


def cell_label(x):
    if x == 0:
        return "Missing"
    if x >= 0.95:
        return "Present"
    return f"Partial {x:.0%}"


cov_rows, shown_rows = [], []
for t in filtered:
    num = {}
    for p, pat in PARAMS.items():
        cols = t["o2"]["cols"] if pat is None else [c for c in t["columns"] if pat.search(c)]
        num[p] = fill_share(t, cols)
    cov_rows.append(num)

    hi = t["o2"]["max"]
    moon = "n/a" if hi is None else ("Yes" if hi >= 30 else "No")
    row = {"Series": f'{t["series"]} #{t["id"]}', "Tests": t["row_count"]}
    row.update({p: cell_label(v) for p, v in num.items()})
    row["O₂ ≥ 30% (Moon)"] = moon
    shown_rows.append(row)

shown = pd.DataFrame(shown_rows).set_index("Series")


def color(v):
    # Maps a cell label to a background color: blue = good, orange = partial, red = bad
    s = str(v)
    if s.startswith("Missing") or s == "No":
        return STYLE_BAD
    if s.startswith("Partial"):
        return STYLE_PARTIAL
    if s.startswith("Present") or s == "Yes":
        return STYLE_GOOD
    return ""


st.dataframe(shown.style.map(color, subset=[c for c in shown.columns if c != "Tests"]),
             use_container_width=True, height=(len(shown) + 1) * 35 + 3)

summary = pd.DataFrame({
    "Parameter": list(PARAMS),
    "Series without it": [sum(1 for r in cov_rows if r[p] == 0) for p in PARAMS],
    "Tests in those series": [sum(t["row_count"] for t, r in zip(filtered, cov_rows) if r[p] == 0)
                              for p in PARAMS],
}).sort_values("Series without it", ascending=False)
st.markdown("**What is missing most often:**")
st.dataframe(summary, use_container_width=True, hide_index=True)


def csv_safe(v):
    # Guards against CSV/formula injection: Excel treats cells starting with
    # = + - @ as formulas, so we prefix them with an apostrophe
    s = str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@") else s


export_df = shown.reset_index().map(csv_safe)

# CSV: some spreadsheet programs (e.g. with Ukrainian/Russian regional settings) expect
# semicolons and show a comma-separated file in a single column, so we also offer .xlsx
csv = export_df.to_csv(index=False).encode("utf-8-sig")

xlsx_buf = BytesIO()
with pd.ExcelWriter(xlsx_buf, engine="openpyxl") as writer:
    export_df.to_excel(writer, index=False, sheet_name="Gap map")

dl1, dl2, _ = st.columns([1, 1, 3])
dl1.download_button("Download gap map (Excel)", xlsx_buf.getvalue(), "gap_map.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
dl2.download_button("Download gap map (CSV)", csv, "gap_map.csv", "text/csv")

st.warning("**Partial gravity** (Moon ≈0.16 g, Mars ≈0.38 g): per the NASA challenge description, "
           "PSI has no such data yet. It is expected from LUCI and FM2.")


# ---------------------------------------------------------------------------
# Series comparison
# ---------------------------------------------------------------------------

st.subheader("Compare series", divider="blue")
cmp_labels = {f'{t["series"]} · {t["psi_accession"]} · #{t["id"]}': t for t in filtered}
picked = st.multiselect("Pick 2–3 series to compare", list(cmp_labels), max_selections=3)

if len(picked) >= 2:
    sel = [cmp_labels[p] for p in picked]

    rows = {"Tests": [str(t["row_count"]) for t in sel]}
    rows["O₂, %"] = [
        "not in table" if t["o2"]["min"] is None
        else f'{t["o2"]["min"]:.1f}–{t["o2"]["max"]:.1f}'
        for t in sel
    ]
    for p, pat in PARAMS.items():
        if pat is None:  # oxygen is already shown above
            continue
        rows[p] = [cell_label(fill_share(t, [c for c in t["columns"] if pat.search(c)])) for t in sel]

    table = pd.DataFrame(rows, index=picked).T

    def mark_diff(row):
        same = row.nunique() == 1
        return [""] * len(row) if same else [STYLE_PARTIAL] * len(row)

    st.dataframe(table.style.apply(mark_diff, axis=1), use_container_width=True)
    st.caption("Rows highlighted in orange are where the series differ.")

    # st.text (not st.markdown) so odd characters in column names cannot break formatting
    common = set.intersection(*[set(t["columns"]) for t in sel])
    st.markdown("**Shared columns:**")
    st.text(", ".join(sorted(common)) or "none")
    for name, t in zip(picked, sel):
        only = [c for c in t["columns"] if c not in common]
        st.markdown("**Only in this series:**")
        st.text(f"{name}\n{', '.join(only) or '—'}")
else:
    st.info("Pick at least 2 series.")


# ---------------------------------------------------------------------------
# Series catalog
# ---------------------------------------------------------------------------

st.subheader("Series catalog", divider="blue")
catalog = pd.DataFrame([{
    "Series": t["series"],
    "PSI": t["psi_accession"],
    "Tests": t["row_count"],
    "O₂ min, %": None if t["o2"]["min"] is None else round(t["o2"]["min"], 1),
    "O₂ max, %": None if t["o2"]["max"] is None else round(t["o2"]["max"], 1),
    "O₂ column": ", ".join(t["o2"]["cols"]) or "none",
    "Note": t["o2"]["note"],
    "Column count": len(t["columns"]),
    "Columns": ", ".join(t["columns"]),
} for t in filtered])
st.dataframe(catalog, use_container_width=True, hide_index=True)


# ---------------------------------------------------------------------------
# Series card
# ---------------------------------------------------------------------------

st.subheader("Series card", divider="blue")
labels = [f'{t["series"]} · {t["psi_accession"]} · table #{t["id"]} ({t["row_count"]} tests)'
          for t in filtered]
choice = st.selectbox("Pick a series", labels)
t = filtered[labels.index(choice)]
st.write("Source file:", t["source_file"])
st.dataframe(pd.DataFrame(t["records"]), use_container_width=True, hide_index=True)

st.markdown("**Data completeness by column** (red = some cells are empty)")
comp = pd.DataFrame({
    "Column": t["columns"],
    "Filled, % of tests": [round(100 * fill_share(t, [c])) for c in t["columns"]],
})
st.dataframe(
    comp.style.map(lambda v: STYLE_BAD if v < 100 else "", subset=["Filled, % of tests"]),
    use_container_width=True, hide_index=True,
)