import html as html_lib
import json
import logging
import re
from io import BytesIO
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from ai import (
    DOMAIN_TAGS,
    get_api_key,
    get_default_effort,
    get_default_model,
    list_models,
    send_feedback,
    stream_agent,
)

logger = logging.getLogger(__name__)

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
# Sidebar layout & styling (compact fixed header, full-height bottom-docked
# AI composer, zero horizontal/vertical scrollbars, clean slate-indigo theme,
# and compact collapsible reasoning/trace timeline)
# ---------------------------------------------------------------------------

st.markdown(
    """
    <style>
    /* --- Sidebar shell & zero-horizontal-overflow guarantee --- */
    section[data-testid="stSidebar"] {
        transition: width 0.2s ease, min-width 0.2s ease;
        background: #F4F7FB !important;
        border-right: 1px solid #E2E8F0 !important;
        overflow-x: hidden !important;
    }
    section[data-testid="stSidebar"] * {
        box-sizing: border-box;
        max-width: 100%;
    }
    section[data-testid="stSidebar"]:has([role="tab"][aria-selected="true"]:nth-of-type(2)) {
        min-width: 520px !important;
        width: 520px !important;
    }
    section[data-testid="stSidebar"] [data-testid="stSidebarContent"] {
        display: flex !important;
        flex-direction: column !important;
        height: 100vh !important;
        max-height: 100vh !important;
        padding: 0 0.85rem !important;
        overflow-x: hidden !important;
        overflow-y: hidden !important;
    }
    /* Hide every scrollbar visually across the entire sidebar while keeping scroll working */
    section[data-testid="stSidebar"] * {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
    }
    section[data-testid="stSidebar"] *::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
    }
    /* Ultra-compact top collapse header bar */
    section[data-testid="stSidebar"] [data-testid="stSidebarHeader"] {
        flex: 0 0 auto !important;
        padding: 0.15rem 0 0 0 !important;
        margin: 0 !important;
        min-height: 1.45rem !important;
        height: 1.55rem !important;
        background: #F4F7FB !important;
        z-index: 20;
    }
    section[data-testid="stSidebar"] [data-testid="stSidebarHeader"] button {
        width: 1.5rem !important;
        height: 1.5rem !important;
        min-height: 1.5rem !important;
        padding: 0 !important;
    }
    /* User content fills remaining viewport height */
    section[data-testid="stSidebar"] [data-testid="stSidebarUserContent"] {
        flex: 1 1 0% !important;
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important;
        padding: 0 0 0.55rem 0 !important;
        overflow: hidden !important;
    }
    section[data-testid="stSidebar"] [data-testid="stSidebarUserContent"] > div {
        flex: 1 1 0% !important;
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important;
    }
    section[data-testid="stSidebar"] [data-testid="stSidebarUserContent"] > div > [data-testid="stVerticalBlock"] {
        flex: 1 1 0% !important;
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important;
        gap: 0.25rem !important;
    }
    /* Compact fixed title row ("Explore PSI" + count) */
    section[data-testid="stSidebar"] [data-testid="stSidebarUserContent"] > div > [data-testid="stVerticalBlock"] > [data-testid="stLayoutWrapper"]:first-child {
        flex: 0 0 auto !important;
        margin: 0 !important;
        padding: 0 !important;
    }
    section[data-testid="stSidebar"] [data-testid="stSidebarUserContent"] > div > [data-testid="stVerticalBlock"] > [data-testid="stLayoutWrapper"]:first-child [data-testid="stVerticalBlock"] {
        flex: 0 0 auto !important;
    }
    section[data-testid="stSidebar"] [data-testid="stSidebarUserContent"] > div > [data-testid="stVerticalBlock"] > [data-testid="stLayoutWrapper"]:first-child [data-testid="stMarkdown"],
    section[data-testid="stSidebar"] [data-testid="stSidebarUserContent"] > div > [data-testid="stVerticalBlock"] > [data-testid="stLayoutWrapper"]:first-child [data-testid="stElementContainer"] {
        height: auto !important;
        min-height: 1.35rem !important;
    }
    section[data-testid="stSidebar"] .psi-header-title {
        font-size: 0.96rem;
        font-weight: 700;
        color: #0F172A;
        letter-spacing: -0.01em;
        line-height: 1.25;
        margin: 0;
    }
    section[data-testid="stSidebar"] .psi-header-count {
        font-size: 0.76rem;
        font-weight: 500;
        color: #64748B;
        text-align: right;
        line-height: 1.25;
        white-space: nowrap;
    }
    /* Tabs shell: stretch to bottom of sidebar */
    section[data-testid="stSidebar"] [data-testid="stTabs"] {
        flex: 1 1 0% !important;
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important;
    }
    section[data-testid="stSidebar"] [data-testid="stTabs"] > div:has([role="tablist"]) {
        flex: 1 1 0% !important;
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important;
    }
    /* Thin, compact segmented tab bar */
    section[data-testid="stSidebar"] [role="tablist"] {
        flex: 0 0 auto !important;
        display: flex !important;
        gap: 0.25rem !important;
        background: #E2E8F0 !important;
        padding: 0.18rem !important;
        border-radius: 9px !important;
        border-bottom: none !important;
        margin: 0 0 0.25rem 0 !important;
        min-height: 0 !important;
        overflow-x: hidden !important;
    }
    section[data-testid="stSidebar"] [role="tab"] {
        flex: 1 1 0 !important;
        justify-content: center !important;
        border-radius: 7px !important;
        padding: 0.22rem 0.5rem !important;
        min-height: 1.65rem !important;
        height: 1.65rem !important;
        font-size: 0.8rem !important;
        line-height: 1.1 !important;
        border: none !important;
        margin: 0 !important;
        color: #475569 !important;
        background: transparent !important;
        transition: background-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
    }
    section[data-testid="stSidebar"] [role="tab"] p {
        font-size: 0.8rem !important;
        line-height: 1.1 !important;
        margin: 0 !important;
    }
    section[data-testid="stSidebar"] [role="tab"]::after,
    section[data-testid="stSidebar"] [role="tab"]::before {
        display: none !important;
        content: none !important;
    }
    section[data-testid="stSidebar"] [role="tab"][aria-selected="true"] {
        background: #FFFFFF !important;
        color: #0F172A !important;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08) !important;
    }
    section[data-testid="stSidebar"] [data-baseweb="tab-highlight"] {
        display: none !important;
    }
    /* Active tab panel fills remaining vertical space */
    section[data-testid="stSidebar"] [role="tabpanel"]:not([hidden]) {
        flex: 1 1 0% !important;
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important;
        padding-top: 0.2rem !important;
        overflow-x: hidden !important;
    }
    /* Filters panel scrolls vertically if needed without showing scrollbar */
    section[data-testid="stSidebar"] [role="tabpanel"]:first-of-type:not([hidden]) {
        overflow-y: auto !important;
    }
    section[data-testid="stSidebar"] [role="tabpanel"]:not([hidden]) > [data-testid="stVerticalBlock"] {
        flex: 1 1 0% !important;
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important;
        gap: 0.35rem !important;
    }
    /* AI Chat scrollable container: takes ALL remaining space above bottom composer */
    section[data-testid="stSidebar"] [role="tabpanel"]:not([hidden]) > [data-testid="stVerticalBlock"] > [data-testid="stLayoutWrapper"]:has([data-testid="stButton"], [data-testid="stChatMessage"]) {
        flex: 1 1 0% !important;
        min-height: 0 !important;
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
    }
    section[data-testid="stSidebar"] [role="tabpanel"]:not([hidden]) > [data-testid="stVerticalBlock"] > [data-testid="stLayoutWrapper"]:has([data-testid="stButton"], [data-testid="stChatMessage"]) > [data-testid="stVerticalBlock"] {
        flex: 1 1 0% !important;
        height: 100% !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding-right: 0.1rem !important;
    }
    /* Quick prompt buttons */
    section[data-testid="stSidebar"] [data-testid="stButton"] button {
        border-radius: 10px !important;
        border: 1px solid #DCE3EE !important;
        background: #FFFFFF !important;
        color: #1E293B !important;
        font-size: 0.8rem !important;
        padding: 0.38rem 0.55rem !important;
        transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    section[data-testid="stSidebar"] [data-testid="stButton"] button:hover {
        border-color: #93C5FD !important;
        background: #F8FAFC !important;
        color: #1D4ED8 !important;
    }
    /* Bottom-docked composer + compact footer */
    section[data-testid="stSidebar"] [data-testid="stElementContainer"]:has([data-testid="stChatInput"]) {
        flex: 0 0 auto !important;
        margin-top: auto !important;
    }
    section[data-testid="stSidebar"] [data-testid="stChatInput"] {
        border-radius: 14px !important;
        border: 1px solid #CBD5E1 !important;
        background: #FFFFFF !important;
        box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05) !important;
        padding: 0.1rem 0.25rem !important;
    }
    section[data-testid="stSidebar"] [data-testid="stChatInput"]:focus-within {
        border-color: #3B82F6 !important;
        box-shadow: 0 2px 12px rgba(37, 99, 235, 0.12) !important;
    }
    section[data-testid="stSidebar"] [data-testid="stChatInput"] textarea {
        font-size: 0.88rem !important;
        color: #0F172A !important;
    }
    section[data-testid="stSidebar"] [role="tabpanel"]:not([hidden]) > [data-testid="stVerticalBlock"] > [data-testid="stLayoutWrapper"]:last-child {
        flex: 0 0 auto !important;
    }
    section[data-testid="stSidebar"] [data-testid="stPopover"] button {
        border: none !important;
        background: transparent !important;
        padding: 0.12rem 0.4rem !important;
        min-height: 1.55rem !important;
        font-size: 0.76rem !important;
        color: #475569 !important;
        white-space: nowrap !important;
    }
    section[data-testid="stSidebar"] [data-testid="stPopover"] button:hover {
        background: #E2E8F0 !important;
        color: #0F172A !important;
    }
    /* Chat messages: clean user pill + crisp assistant markdown */
    section[data-testid="stSidebar"] [data-testid="stChatMessage"] {
        overflow-x: hidden !important;
    }
    section[data-testid="stSidebar"] [data-testid="stChatMessage"]:has([data-testid="stChatMessageAvatarUser"]) {
        background: #E8F0FE !important;
        border: 1px solid #D0E0FB !important;
        border-radius: 13px !important;
        padding: 0.48rem 0.75rem !important;
        margin-left: 2rem !important;
        margin-bottom: 0.35rem !important;
    }
    section[data-testid="stSidebar"] [data-testid="stChatMessage"]:has([data-testid="stChatMessageAvatarUser"]) p {
        font-size: 0.86rem !important;
        color: #0F172A !important;
        line-height: 1.4 !important;
    }
    section[data-testid="stSidebar"] [data-testid="stChatMessage"]:has([data-testid="stChatMessageAvatarAssistant"]) {
        background: transparent !important;
        border: none !important;
        padding: 0.1rem 0.05rem !important;
        margin-bottom: 0.45rem !important;
    }
    section[data-testid="stSidebar"] [data-testid="stChatMessage"] [data-testid="stMarkdownContainer"] {
        font-size: 0.86rem !important;
        line-height: 1.48 !important;
        color: #1E293B !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
    }
    section[data-testid="stSidebar"] [data-testid="stChatMessage"] [data-testid="stMarkdownContainer"] p,
    section[data-testid="stSidebar"] [data-testid="stChatMessage"] [data-testid="stMarkdownContainer"] li {
        font-size: 0.86rem !important;
        line-height: 1.48 !important;
    }
    section[data-testid="stSidebar"] [data-testid="stChatMessage"] [data-testid="stMarkdownContainer"] code {
        word-break: break-word !important;
        white-space: pre-wrap !important;
        font-size: 0.75rem !important;
        background: #EEF2F7 !important;
        color: #1E3A8A !important;
        padding: 0.06rem 0.28rem !important;
        border-radius: 4px !important;
    }
    section[data-testid="stSidebar"] [data-testid="stChatMessage"] [data-testid="stMarkdownContainer"] pre {
        white-space: pre-wrap !important;
        word-break: break-word !important;
        overflow-x: hidden !important;
    }
    section[data-testid="stSidebar"] table {
        width: 100% !important;
        table-layout: fixed !important;
        font-size: 0.75rem !important;
        line-height: 1.3 !important;
        word-break: break-word !important;
    }
    /* --- Minimalist Claude-style trace & thinking (<details> tree, no horizontal overflow) --- */
    .trace-root {
        margin: 0 0 0.35rem 0;
        font-size: 0.78rem;
        color: #64748B;
    }
    .trace-root > summary {
        list-style: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.14rem 0.35rem 0.14rem 0;
        font-size: 0.77rem;
        font-weight: 500;
        color: #64748B;
        user-select: none;
        transition: color 0.15s ease;
    }
    .trace-root > summary::-webkit-details-marker { display: none; }
    .trace-root > summary:hover { color: #1E293B; }
    .trace-chev {
        display: inline-block;
        font-size: 0.78rem;
        transition: transform 0.15s ease;
        color: #94A3B8;
    }
    .trace-root[open] > summary .trace-chev { transform: rotate(90deg); }
    .trace-box {
        margin-top: 0.25rem;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        background: #FFFFFF;
        overflow: hidden;
    }
    .trace-row {
        padding: 0.36rem 0.62rem;
        border-top: 1px solid #F1F5F9;
        font-size: 0.76rem;
        line-height: 1.38;
        color: #475569;
        overflow-wrap: anywhere;
    }
    .trace-row:first-child { border-top: none; }
    .trace-row-title {
        color: #334155;
        font-weight: 500;
    }
    .trace-row-sub {
        color: #64748B;
        font-size: 0.72rem;
        margin-top: 0.08rem;
    }
    /* Collapsible thinking block inside trace: shows first 3 lines faded until clicked */
    .think-wrap {
        padding: 0.36rem 0.62rem;
        border-top: 1px solid #F1F5F9;
        background: #FAFBFD;
    }
    .think-wrap:first-child { border-top: none; }
    .think-toggle { display: block; }
    .think-toggle > summary {
        list-style: none;
        cursor: pointer;
        position: relative;
        font-size: 0.73rem;
        line-height: 1.42;
        color: #475569;
    }
    .think-toggle > summary::-webkit-details-marker { display: none; }
    .think-preview {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        font-size: 0.725rem;
        line-height: 1.42;
        color: #475569;
        -webkit-mask-image: linear-gradient(180deg, #000 45%, transparent 100%);
        mask-image: linear-gradient(180deg, #000 45%, transparent 100%);
    }
    .think-toggle[open] > summary .think-preview {
        display: none;
    }
    .think-hint {
        display: inline-block;
        margin-top: 0.16rem;
        font-size: 0.69rem;
        font-weight: 500;
        color: #2563EB;
    }
    .think-toggle[open] > summary .think-hint {
        color: #64748B;
        margin-bottom: 0.25rem;
    }
    .think-full {
        font-size: 0.725rem;
        line-height: 1.45;
        color: #334155;
        overflow-wrap: anywhere;
    }
    .think-full p { margin: 0 0 0.28rem 0; }
    .think-full p:last-child { margin-bottom: 0; }
    .think-full ul, .think-full ol { margin: 0.15rem 0 0.28rem 1.05rem; padding: 0; }
    .think-full li { margin-bottom: 0.12rem; }
    .think-full code {
        font-size: 0.69rem;
        background: #EEF2F7;
        color: #1E3A8A;
        padding: 0.04rem 0.22rem;
        border-radius: 3px;
    }
    .think-full strong { color: #0F172A; font-weight: 600; }
    /* Live streaming thinking clamp (3 lines max while streaming) */
    .live-think-box {
        font-size: 0.725rem;
        line-height: 1.4;
        color: #475569;
        background: #F8FAFC;
        border-left: 2px solid #93C5FD;
        padding: 0.3rem 0.55rem;
        border-radius: 4px;
        margin-bottom: 0.3rem;
        overflow-wrap: anywhere;
    }
    /* Filter panel expander styling */
    section[data-testid="stSidebar"] [data-testid="stExpander"] {
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        background: #FFFFFF;
        overflow: hidden;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# ---------------------------------------------------------------------------
# Sidebar: filters & AI research agent
# ---------------------------------------------------------------------------

def reset_filters():
    # Runs as a button callback, before widgets are drawn on the next rerun
    st.session_state["search"] = ""
    st.session_state["min_tests"] = 0
    st.session_state["only_o2"] = False
    st.session_state["o2_threshold"] = 0


def _inline_md_to_html(text: str) -> str:
    escaped = html_lib.escape(text, quote=True)
    escaped = re.sub(r"`([^`\n]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^\*\n]+)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"(?<!\*)\*([^\*\n]+)\*(?!\*)", r"<em>\1</em>", escaped)
    return escaped


def _thinking_md_to_html(text: str) -> str:
    lines = (text or "").strip().splitlines()
    blocks: list[str] = []
    list_items: list[str] = []
    list_tag = "ul"

    def flush_list():
        nonlocal list_items
        if list_items:
            blocks.append(f"<{list_tag}>{''.join(list_items)}</{list_tag}>")
            list_items = []

    for raw in lines:
        line = raw.strip()
        if not line:
            flush_list()
            continue
        m_ul = re.match(r"^[-*•]\s+(.+)$", line)
        m_ol = re.match(r"^\d+[.)]\s+(.+)$", line)
        m_h = re.match(r"^#{1,6}\s+(.+)$", line)
        if m_ul:
            if list_items and list_tag != "ul":
                flush_list()
            list_tag = "ul"
            list_items.append(f"<li>{_inline_md_to_html(m_ul.group(1))}</li>")
        elif m_ol:
            if list_items and list_tag != "ol":
                flush_list()
            list_tag = "ol"
            list_items.append(f"<li>{_inline_md_to_html(m_ol.group(1))}</li>")
        elif m_h:
            flush_list()
            blocks.append(f"<p><strong>{_inline_md_to_html(m_h.group(1))}</strong></p>")
        else:
            flush_list()
            blocks.append(f"<p>{_inline_md_to_html(line)}</p>")

    flush_list()
    return "".join(blocks)


def _render_agent_trace(steps, thinking_text, duration_s=None):
    if not steps and not thinking_text:
        return
    step_count = len(steps or [])
    dur_str = f" · {duration_s:.0f}s" if duration_s else ""
    if step_count:
        last_label = steps[-1]["label"]
        headline = f"{last_label} ({step_count} steps{dur_str})"
    else:
        headline = f"Thought{dur_str}"

    rows_html: list[str] = []
    if thinking_text:
        think_html = _thinking_md_to_html(thinking_text)
        plain_preview = _inline_md_to_html(re.sub(r"\s+", " ", thinking_text).strip())
        rows_html.append(
            "<div class='think-wrap'>"
            "<details class='think-toggle'>"
            "<summary>"
            f"<div class='think-preview'>{plain_preview}</div>"
            "<span class='think-hint'>Show full reasoning</span>"
            "</summary>"
            f"<div class='think-full'>{think_html}</div>"
            "</details>"
            "</div>"
        )

    for s in (steps or []):
        title = html_lib.escape(s.get("label", ""))
        preview = html_lib.escape(s.get("preview", ""))
        sub_html = f"<div class='trace-row-sub'>{preview}</div>" if preview else ""
        rows_html.append(
            "<div class='trace-row'>"
            f"<div class='trace-row-title'>› {title}</div>"
            f"{sub_html}"
            "</div>"
        )

    st.markdown(
        "<details class='trace-root'>"
        "<summary>"
        f"<span>{html_lib.escape(headline)}</span>"
        "<span class='trace-chev'>›</span>"
        "</summary>"
        f"<div class='trace-box'>{''.join(rows_html)}</div>"
        "</details>",
        unsafe_allow_html=True,
    )


# The sidebar stays visible while the main page is scrolled, so the AI chat
# (second tab) can be used right next to the data.
with st.sidebar:
    h_left, h_right = st.columns([3, 2], vertical_alignment="center")
    h_left.markdown("<div class='psi-header-title'>Explore PSI</div>", unsafe_allow_html=True)
    found_box = h_right.empty()  # filled below, once the filtered list is known

    # Tab labels accept markdown: bold text and Material icons (not emojis)
    tab_filters, tab_ai = st.tabs([
        ":material/tune: **Filters**",
        ":material/smart_toy: **AI Agent**",
    ])

    with tab_filters:
        st.caption("Filter the 22 PSI combustion series by name, oxygen, or size.")
        search = st.text_input("Series name", key="search", max_chars=100,
                               placeholder="e.g. SAFFIRE, FLEX, CFI-G")

        only_o2 = st.checkbox("Only series with O₂ data", key="only_o2")
        o2_threshold = st.slider("Series max O₂ at least, %", 0, 100, 0, key="o2_threshold",
                                 help="Keeps series whose highest O₂ value reaches this level. "
                                      "Set 30 to see series relevant for lunar conditions.")

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

    with tab_ai:
        MAX_QUESTION_LEN = 500
        MAX_QUESTIONS_PER_SESSION = 20

        available_models = list_models()
        model_ids = [m["id"] for m in available_models]
        model_labels = {m["id"]: m["display_name"] for m in available_models}
        model_efforts = {m["id"]: m.get("efforts", []) for m in available_models}
        default_model = get_default_model()
        default_idx = model_ids.index(default_model) if default_model in model_ids else 0

        history = st.session_state.setdefault("chat_history", [])
        chosen_model = st.session_state.get("ai_model", model_ids[default_idx])
        efforts = model_efforts.get(chosen_model) or []
        default_effort = get_default_effort()
        chosen_effort = st.session_state.get(
            "ai_effort",
            default_effort if default_effort in efforts else (efforts[0] if efforts else None),
        )

        if not get_api_key():
            st.warning(
                "Coarena API key is not configured. Add `COARENA_API_KEY` to "
                "`.streamlit/secrets.toml` (or environment variables)."
            )

        quick_prompts = [
            ("Moon base (30%+ O₂)", "Rank the PSI series most relevant for a lunar base at 30%+ O2 and <=10.2 psi."),
            ("Suppression & smoke", "Which PSI series cover fire suppression and smoke/aerosol detection?"),
            ("Modeling gaps", "What parameters are most often missing for predictive flammability modeling?"),
            ("CIR vs MSG rigs", "Compare the test conditions and fuels across CIR/ACME, MDCA, and MSG series."),
        ]

        chat_box = st.container(border=False)
        with chat_box:
            if not history:
                st.caption("Ask about NASA PSI microgravity combustion tables. The agent inspects CSV files and streams its reasoning.")
                qp_cols = st.columns(2)
                queued_prompt = None
                for idx, (btn_label, prompt_text) in enumerate(quick_prompts):
                    if qp_cols[idx % 2].button(btn_label, key=f"qp_{idx}", use_container_width=True):
                        queued_prompt = prompt_text
            else:
                queued_prompt = None

            for idx, entry in enumerate(history):
                role = entry["role"]
                text = entry["text"]
                with st.chat_message(role):
                    if role == "assistant":
                        _render_agent_trace(
                            entry.get("steps"),
                            entry.get("thinking"),
                            entry.get("duration_s"),
                        )
                        st.markdown(text)  # no unsafe_allow_html
                        req_id = entry.get("request_id")
                        if req_id:
                            fb_val = st.feedback("thumbs", key=f"fb_{idx}")
                            prev_fb = entry.get("feedback")
                            if fb_val is not None and fb_val != prev_fb:
                                rating = "up" if fb_val == 1 else "down"
                                if send_feedback(req_id, rating):
                                    entry["feedback"] = fb_val
                                    st.toast("Feedback sent to Coarena.")
                    else:
                        st.text(text)  # user text shown as plain text

        # Bottom-pinned composer + real footer bar (model, effort, clear)
        typed_question = st.chat_input("Write a message...", max_chars=MAX_QUESTION_LEN)
        f_note, f_settings, f_clear = st.columns([1.4, 2.8, 0.8], vertical_alignment="center")
        f_note.caption("PSI data only")
        model_short = model_labels.get(chosen_model, chosen_model)
        effort_tag = f" · {chosen_effort.title()}" if chosen_effort else ""
        with f_settings.popover(f"{model_short}{effort_tag}", use_container_width=True):
            chosen_model = st.selectbox(
                "Model (Coarena)",
                model_ids,
                index=default_idx,
                format_func=lambda mid: model_labels.get(mid, mid),
                key="ai_model",
            )
            efforts = model_efforts.get(chosen_model) or []
            if efforts:
                effort_idx = efforts.index(default_effort) if default_effort in efforts else 0
                chosen_effort = st.selectbox(
                    "Thinking effort",
                    efforts,
                    index=effort_idx,
                    key="ai_effort",
                )
            else:
                chosen_effort = None
        if history and f_clear.button("Clear", key="clear_chat", use_container_width=True):
            st.session_state["chat_history"] = []
            st.rerun()

        question = typed_question or queued_prompt
        if question:
            if not get_api_key():
                st.error("API key is missing. Add COARENA_API_KEY in .streamlit/secrets.toml.")
            elif sum(1 for m in history if m["role"] == "user") >= MAX_QUESTIONS_PER_SESSION:
                st.warning("Question limit reached for this session.")
            else:
                history.append({"role": "user", "text": question})
                prior_turns = [
                    {"role": m["role"], "content": m["text"]}
                    for m in history[:-1]
                ]
                with chat_box:
                    with st.chat_message("user"):
                        st.text(question)
                    with st.chat_message("assistant"):
                        status_box = st.status("Planning & reasoning...", expanded=True)
                        with status_box:
                            think_slot = st.empty()
                            steps_slot = st.empty()
                        answer_slot = st.empty()

                        live_steps = []
                        live_thinking = []
                        live_text = []
                        final_meta = None
                        try:
                            for ev in stream_agent(
                                question,
                                tables,
                                model=chosen_model,
                                history=prior_turns,
                                effort=chosen_effort,
                            ):
                                etype = ev["type"]
                                elapsed = ev.get("elapsed_s", 0)
                                if etype == "status":
                                    status_box.update(label=f"{ev['text']} · {elapsed:.0f}s", state="running")
                                elif etype == "tool_start":
                                    live_steps.append(f"⏳ `{ev['name']}`...")
                                    steps_slot.markdown("\n".join(f"- {s}" for s in live_steps))
                                elif etype == "tool_done":
                                    line = f"› **{ev['label']}**"
                                    if ev.get("preview"):
                                        line += f" — {ev['preview']}"
                                    if live_steps:
                                        live_steps[-1] = line
                                    else:
                                        live_steps.append(line)
                                    steps_slot.markdown("\n".join(f"- {s}" for s in live_steps))
                                elif etype == "thinking_delta":
                                    live_thinking.append(ev["delta"])
                                    snippet = "".join(live_thinking).strip()
                                    think_slot.markdown(
                                        f"<div class='live-think-box'>{_thinking_md_to_html(snippet[-700:])}</div>",
                                        unsafe_allow_html=True,
                                    )
                                elif etype == "text_delta":
                                    live_text.append(ev["delta"])
                                    answer_slot.markdown("".join(live_text) + "▌")
                                elif etype == "done":
                                    final_meta = ev
                            dur = final_meta.get("duration_s", 0) if final_meta else 0
                            cnt = len(final_meta.get("steps", [])) if final_meta else 0
                            status_box.update(
                                label=f"Done · {cnt} steps · {dur:.0f}s",
                                state="complete",
                                expanded=False,
                            )
                        except Exception:
                            logger.exception("AI assistant streaming failed")
                            status_box.update(label="Agent error", state="error", expanded=False)
                            final_meta = None

                if final_meta:
                    history.append({
                        "role": "assistant",
                        "text": final_meta["text"],
                        "thinking": final_meta.get("thinking", ""),
                        "steps": final_meta.get("steps", []),
                        "duration_s": final_meta.get("duration_s"),
                        "request_id": final_meta.get("request_id"),
                        "feedback": None,
                    })
                else:
                    history.append({
                        "role": "assistant",
                        "text": "Could not get an answer right now. Check your API key or try again.",
                        "thinking": "",
                        "steps": [],
                        "duration_s": None,
                        "request_id": None,
                        "feedback": None,
                    })
                st.rerun()


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
found_box.markdown(f"<div class='psi-header-count'>{len(filtered)} / {len(tables)} series</div>", unsafe_allow_html=True)

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
# Relevance ranking & interpretation by exploration goal
# ---------------------------------------------------------------------------

st.subheader("Rank series by fire-safety goal", divider="blue")
goal = st.selectbox(
    "Exploration & safety scenario",
    [
        "Lunar base / pressurized rover (30%+ O₂, flammability)",
        "Predictive flammability modeling (parameter completeness)",
        "Fire suppression & dilution (CO₂ / He / N₂)",
        "Smoke, aerosol & dust detection",
    ],
)


def _rank_row(t, cov):
    hw, role = DOMAIN_TAGS.get(t["series"], ("PSI", "Combustion"))
    hi_o2 = t["o2"]["max"]
    present_cnt = sum(1 for v in cov.values() if v >= 0.95)
    partial_cnt = sum(1 for v in cov.values() if 0 < v < 0.95)

    if goal.startswith("Lunar base"):
        score = (50 if (hi_o2 is not None and hi_o2 >= 30) else (15 if hi_o2 is not None else 0))
        score += round(20 * cov["Pressure"] + 15 * cov["Fuel/material"] + 15 * cov["Airflow"])
        if t["series"] in ("SAFFIRE-1", "SAFFIRE-2", "SAFFIRE-3", "BASS", "BASS-II", "ACME / BRE", "CFI-G"):
            score += 10
        why = (
            f"O₂ max {hi_o2:.1f}% (reaches 30%+ lunar target)" if (hi_o2 is not None and hi_o2 >= 30)
            else (f"O₂ max {hi_o2:.1f}% (below 30%)" if hi_o2 is not None else "O₂ absent in table")
        )
    elif goal.startswith("Predictive"):
        score = round(100 * (present_cnt + 0.5 * partial_cnt) / len(PARAMS))
        score += min(t["row_count"] // 25, 10)
        why = f"{present_cnt}/{len(PARAMS)} parameter groups >=95% filled across {t['row_count']} tests"
    elif goal.startswith("Fire suppression"):
        has_dil = cov["Diluent (N₂/He/CO₂)"] > 0
        score = round(45 * cov["Diluent (N₂/He/CO₂)"] + 25 * cov["Combustion result"] + 15 * cov["Pressure"])
        if t["series"] in ("FLEX", "FLEX-2", "ACME / s-Flame", "ACME / Flame Design"):
            score += 15
        why = "Includes diluent (N₂/He/CO₂) and extinction/combustion columns" if has_dil else "No diluent column in table"
    else:
        score = 80 if t["series"] in ("SAME", "SAME-R", "DAFT") else 0
        score += round(15 * cov["Airflow"] + 10 * cov["Fuel/material"])
        why = "Dedicated smoke/aerosol/dust detection study" if t["series"] in ("SAME", "SAME-R", "DAFT") else "Combustion study (not aerosol detection)"

    return {
        "Score": min(score, 100),
        "Series": f'{t["series"]} #{t["id"]}',
        "PSI": t["psi_accession"],
        "Hardware": hw,
        "Focus": role,
        "Tests": t["row_count"],
        "Why it ranks here": why,
    }


ranked_df = pd.DataFrame([_rank_row(t, cov) for t, cov in zip(filtered, cov_rows)])
ranked_df = ranked_df.sort_values(["Score", "Tests"], ascending=[False, False]).reset_index(drop=True)
st.dataframe(ranked_df, use_container_width=True, hide_index=True)

with st.expander("Hardware context & Earth applications"):
    st.markdown(
        "- **CIR / ACME** (`ACME / BRE`, `CLD Flame`, `E-FIELD Flames`, `Flame Design`, `s-Flame`, `CFI-G`): "
        "gaseous flames in the Combustion Integrated Rack; `E-FIELD Flames` uses electric fields to mimic partial gravity, "
        "and `CFI-G` reaches up to 85% O₂.\n"
        "- **CIR / MDCA** (`FLEX`, `FLEX-2`, `CFI`): liquid fuel droplets; `FLEX` tests atmosphere dilution with CO₂ and He.\n"
        "- **MSG** (`BASS`, `BASS-II`, `SPICE`, `SLICE`) & `SAFFIRE-1/-2/-3`: solid materials (fabrics, PMMA) and co-flow flames.\n"
        "- **Earth spin-offs**: fine-water-mist extinguishers from ISS research, improved terrestrial smoke detectors (`SAME`/`SAME-R`), "
        "and protective firefighter gear."
    )


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