"""Tool schemas and PSI table inspection handlers for the AI research agent."""

import json
from typing import Any

from .constants import DOMAIN_TAGS, PARAM_PATTERNS
from .psi_data import fill_share

AGENT_TOOLS = [
    {
        "name": "list_psi_series",
        "description": (
            "Return an overview of all 22 PSI experimental tables "
            "(table id, series, psi_accession, source_file, test count, O2 min/max, hardware, and parameter coverage)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "min_o2": {"type": "number", "description": "Optional minimum max-O2 percentage filter (e.g. 30)."},
                "query": {"type": "string", "description": "Optional keyword filter on series name, focus, or columns."},
            },
        },
    },
    {
        "name": "inspect_psi_table",
        "description": (
            "Inspect one PSI table/CSV file by numeric table_id: returns source_file, columns, "
            "coverage gaps, distinct fuel/material values, numeric ranges, and sample rows."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "table_id": {"type": "integer", "description": "Numeric table id (1..22)."},
                "sample_count": {"type": "integer", "description": "Sample rows to inspect (default 5, max 10)."},
            },
            "required": ["table_id"],
        },
    },
    {
        "name": "search_psi_records",
        "description": "Search matching records inside one table_id or across all tables by keyword and/or min O2%.",
        "input_schema": {
            "type": "object",
            "properties": {
                "table_id": {"type": "integer", "description": "Optional table id to restrict search."},
                "keyword": {"type": "string", "description": "Optional substring in record values."},
                "min_o2": {"type": "number", "description": "Optional minimum O2% threshold on table O2."},
                "limit": {"type": "integer", "description": "Max matching rows (default 8, max 15)."},
            },
        },
    },
]


def _tool_coverage(table: dict[str, Any]) -> dict[str, str]:
    cov: dict[str, str] = {}
    o2_cols = (table.get("o2") or {}).get("cols") or []
    o2_sh = fill_share(table, o2_cols)
    cov["O2"] = "Missing" if o2_sh == 0 else ("Present" if o2_sh >= 0.95 else f"Partial {o2_sh:.0%}")
    for label, pat in PARAM_PATTERNS.items():
        cols = [c for c in table.get("columns", []) if pat.search(c)]
        sh = fill_share(table, cols)
        cov[label] = "Missing" if sh == 0 else ("Present" if sh >= 0.95 else f"Partial {sh:.0%}")
    return cov


def run_tool(name: str, tool_input: dict[str, Any], tables: list[dict[str, Any]]) -> tuple[str, str]:
    by_id = {t["id"]: t for t in tables}

    if name == "list_psi_series":
        min_o2 = tool_input.get("min_o2")
        query = str(tool_input.get("query") or "").strip().lower()
        items = []
        for t in tables:
            o2 = t.get("o2") or {}
            if min_o2 is not None and (o2.get("max") is None or o2["max"] < float(min_o2)):
                continue
            hw, role = DOMAIN_TAGS.get(t["series"], ("PSI", "Combustion"))
            hay = f"{t['series']} {t['psi_accession']} {hw} {role} {' '.join(t.get('columns', []))}".lower()
            if query and query not in hay:
                continue
            cov = _tool_coverage(t)
            items.append({
                "table_id": t["id"],
                "series": t["series"],
                "psi_accession": t["psi_accession"],
                "source_file": t.get("source_file"),
                "tests": t["row_count"],
                "o2_min": o2.get("min"),
                "o2_max": o2.get("max"),
                "o2_note": o2.get("note", ""),
                "hardware": hw,
                "focus": role,
                "present_params": [k for k, v in cov.items() if v != "Missing"],
            })
        return f"Catalog scan ({len(items)} series)", json.dumps({"count": len(items), "series": items}, ensure_ascii=False)

    if name == "inspect_psi_table":
        tid = int(tool_input.get("table_id", 0))
        t = by_id.get(tid)
        if not t:
            return f"Table #{tid} not found", json.dumps({"error": f"No table with id {tid}"})
        sample_n = max(1, min(int(tool_input.get("sample_count", 5)), 10))
        records = t.get("records") or []
        cols = t.get("columns", [])
        cats: dict[str, list[str]] = {}
        num_ranges: dict[str, dict[str, float]] = {}
        for col in cols:
            vals = [r.get(col) for r in records if r.get(col) not in (None, "")]
            if not vals:
                continue
            nums = [float(v) for v in vals if isinstance(v, (int, float)) and not isinstance(v, bool)]
            if len(nums) >= max(3, len(vals) // 2):
                num_ranges[col] = {"min": round(min(nums), 4), "max": round(max(nums), 4), "n": len(nums)}
            if any(k in col.lower() for k in ("fuel", "material", "sample type", "flame type", "atmosphere", "hardware", "test end", "self -ext", "direction")):
                cats[col] = sorted({str(v) for v in vals})[:12]

        step = max(1, len(records) // sample_n) if records else 1
        samples = [{k: v for k, v in records[i].items() if v not in (None, "")} for i in range(0, len(records), step)][:sample_n]
        payload = {
            "table_id": t["id"],
            "series": t["series"],
            "psi_accession": t["psi_accession"],
            "source_file": t.get("source_file"),
            "tests": t["row_count"],
            "o2": t.get("o2"),
            "columns": cols,
            "coverage": _tool_coverage(t),
            "numeric_ranges": num_ranges,
            "categorical_values": cats,
            "sample_rows": samples,
        }
        return f"Read {t.get('source_file', t['series'])} (#{t['id']} · {t['series']})", json.dumps(payload, ensure_ascii=False)

    if name == "search_psi_records":
        tid = tool_input.get("table_id")
        kw = str(tool_input.get("keyword") or "").strip().lower()
        min_o2 = tool_input.get("min_o2")
        limit = max(1, min(int(tool_input.get("limit", 8)), 15))
        pool = [by_id[int(tid)]] if (tid is not None and int(tid) in by_id) else tables
        matches, scanned = [], []
        for t in pool:
            o2 = t.get("o2") or {}
            if min_o2 is not None and (o2.get("max") is None or o2["max"] < float(min_o2)):
                continue
            scanned.append(t.get("source_file", t["series"]))
            for idx, r in enumerate(t.get("records") or [], 1):
                compact = {k: v for k, v in r.items() if v not in (None, "")}
                if kw and kw not in json.dumps(compact, ensure_ascii=False).lower():
                    continue
                matches.append({
                    "table_id": t["id"],
                    "series": t["series"],
                    "psi_accession": t["psi_accession"],
                    "source_file": t.get("source_file"),
                    "row": idx,
                    "data": compact,
                })
                if len(matches) >= limit:
                    break
            if len(matches) >= limit:
                break
        scope = scanned[0] if len(scanned) == 1 else f"{len(pool)} tables"
        return f"Search {scope} ({len(matches)} rows)", json.dumps({"matches": matches}, ensure_ascii=False)

    return f"Tool {name}", json.dumps({"error": f"Unknown tool: {name}"})


def format_tool_start(name: str, tool_input: dict[str, Any]) -> str:
    if name == "list_psi_series":
        q = str(tool_input.get("query") or "").strip()
        min_o2 = tool_input.get("min_o2")
        if q:
            return f'Scanning PSI catalog for "{q}"...'
        if min_o2 is not None:
            return f"Scanning PSI catalog (O₂ ≥ {min_o2}%)..."
        return "Scanning PSI catalog..."
    if name == "inspect_psi_table":
        tid = tool_input.get("table_id")
        return f"Inspecting PSI table #{tid}..." if tid is not None else "Inspecting PSI table..."
    if name == "search_psi_records":
        kw = str(tool_input.get("keyword") or "").strip()
        tid = tool_input.get("table_id")
        if kw and tid is not None:
            return f'Searching table #{tid} for "{kw}"...'
        if kw:
            return f'Searching PSI records for "{kw}"...'
        if tid is not None:
            return f"Searching table #{tid} records..."
        return "Searching PSI records..."
    return f"Running {name}..."


def format_tool_preview(name: str, result_json: str) -> str:
    try:
        data = json.loads(result_json)
    except Exception:
        return result_json[:280]
    if "error" in data:
        return str(data["error"])
    if name == "list_psi_series":
        names = [f"{s['series']} (#{s['table_id']})" for s in data.get("series", [])[:6]]
        more = max(0, data.get("count", 0) - len(names))
        return ", ".join(names) + (f" +{more} more" if more else "")
    if name == "inspect_psi_table":
        cols = data.get("columns", [])
        o2 = data.get("o2") or {}
        o2_s = f"O₂ {o2['min']:.1f}–{o2['max']:.1f}%" if o2.get("min") is not None else "O₂ none"
        return f"{data.get('tests')} tests · {o2_s} · {', '.join(cols[:5])}" + ("..." if len(cols) > 5 else "")
    if name == "search_psi_records":
        matches = data.get("matches", [])
        if not matches:
            return "0 matching rows"
        kv = ", ".join(f"{k}={v}" for k, v in list(matches[0].get("data", {}).items())[:4])
        return f"{len(matches)} rows · e.g. row {matches[0].get('row')}: {kv}"
    return result_json[:280]
