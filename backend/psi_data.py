"""PSI dataset loading, oxygen normalization, coverage, ranking, and export."""

from io import BytesIO
import json
from pathlib import Path
import re
from typing import Any

import pandas as pd

from . import DATA_PATH
from .constants import DOMAIN_TAGS, O2_EXCLUDE, O2_INCLUDE, PARAM_PATTERNS, RANKING_GOALS

_DATA_CACHE: dict[str, Any] = {"mtime": None, "data": None}


def clean_col(value: Any) -> str:
    return str(value).replace("ï»¿", "").replace("﻿", "").strip()


def to_num(value: Any) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", "."))
        if match:
            return float(match.group())
    return None


def col_to_percent(name: str, vals: list[float]) -> tuple[list[float], str]:
    lower = name.lower()
    if "percent" in lower or "%" in lower:
        return vals, ""
    if "fraction" in lower or re.match(r"x\s*o2", lower):
        return [v * 100 for v in vals], ""
    if vals and max(vals) <= 1:
        return [v * 100 for v in vals], f"{name}: units assumed (fraction)"
    return vals, f"{name}: units assumed (%)"


def o2_profile(table: dict[str, Any]) -> dict[str, Any]:
    cols = [c for c in table["columns"] if O2_INCLUDE.search(c) and not O2_EXCLUDE.search(c)]
    all_vals: list[float] = []
    notes: list[str] = []
    for col in cols:
        vals = [to_num(r.get(col)) for r in table["records"]]
        nums = [v for v in vals if v is not None]
        if not nums:
            continue
        scaled, note = col_to_percent(col, nums)
        all_vals.extend(scaled)
        if note:
            notes.append(note)

    kept = [v for v in all_vals if 0 <= v <= 100]
    if len(kept) < len(all_vals):
        notes.append("values outside 0-100 discarded")
    zeros = sum(1 for v in kept if v == 0)
    if zeros:
        notes.append(f"zeros: {zeros}")
    if not kept:
        return {"cols": cols, "min": None, "max": None, "note": "; ".join(notes) or "no oxygen column found"}
    return {"cols": cols, "min": round(min(kept), 2), "max": round(max(kept), 2), "note": "; ".join(notes)}


def fill_share(table: dict[str, Any], cols: list[str]) -> float:
    records = table.get("records") or []
    if not cols or not records:
        return 0.0
    ok = sum(1 for r in records if any(r.get(c) not in (None, "") for c in cols))
    return ok / len(records)


def cell_label(share: float) -> str:
    if share == 0:
        return "Missing"
    if share >= 0.95:
        return "Present"
    return f"Partial {share:.0%}"


def table_coverage(table: dict[str, Any]) -> dict[str, dict[str, Any]]:
    cov: dict[str, dict[str, Any]] = {}
    o2_cols = (table.get("o2") or {}).get("cols") or []
    o2_share = fill_share(table, o2_cols)
    cov["O₂"] = {"share": o2_share, "label": cell_label(o2_share)}
    for param, pattern in PARAM_PATTERNS.items():
        cols = [c for c in table.get("columns", []) if pattern.search(c)]
        share = fill_share(table, cols)
        cov[param] = {"share": share, "label": cell_label(share)}
    return cov


def rank_series(tables: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = {}
    param_count = 1 + len(PARAM_PATTERNS)
    for goal in RANKING_GOALS:
        gid = goal["id"]
        rows: list[dict[str, Any]] = []
        for t in tables:
            hw, role = DOMAIN_TAGS.get(t["series"], ("PSI", "Combustion"))
            cov = t["coverage"]
            hi_o2 = t["o2"]["max"]
            present_cnt = sum(1 for v in cov.values() if v["share"] >= 0.95)
            partial_cnt = sum(1 for v in cov.values() if 0 < v["share"] < 0.95)

            if gid == "lunar":
                score = 50 if (hi_o2 is not None and hi_o2 >= 30) else (15 if hi_o2 is not None else 0)
                score += round(
                    20 * cov["Pressure"]["share"]
                    + 15 * cov["Fuel/material"]["share"]
                    + 15 * cov["Airflow"]["share"]
                )
                if t["series"] in ("SAFFIRE-1", "SAFFIRE-2", "SAFFIRE-3", "BASS", "BASS-II", "ACME / BRE", "CFI-G"):
                    score += 10
                why = (
                    f"O₂ max {hi_o2:.1f}% (reaches 30%+ lunar target)"
                    if (hi_o2 is not None and hi_o2 >= 30)
                    else (f"O₂ max {hi_o2:.1f}% (below 30%)" if hi_o2 is not None else "O₂ absent in table")
                )
            elif gid == "modeling":
                score = round(100 * (present_cnt + 0.5 * partial_cnt) / param_count)
                score += min(t["row_count"] // 25, 10)
                why = f"{present_cnt}/{param_count} parameter groups >=95% filled across {t['row_count']} tests"
            elif gid == "suppression":
                has_dil = cov["Diluent (N₂/He/CO₂)"]["share"] > 0
                score = round(
                    45 * cov["Diluent (N₂/He/CO₂)"]["share"]
                    + 25 * cov["Combustion result"]["share"]
                    + 15 * cov["Pressure"]["share"]
                )
                if t["series"] in ("FLEX", "FLEX-2", "ACME / s-Flame", "ACME / Flame Design"):
                    score += 15
                why = (
                    "Includes diluent (N₂/He/CO₂) and extinction/combustion columns"
                    if has_dil
                    else "No diluent column in table"
                )
            else:
                score = 80 if t["series"] in ("SAME", "SAME-R", "DAFT") else 0
                score += round(15 * cov["Airflow"]["share"] + 10 * cov["Fuel/material"]["share"])
                why = (
                    "Dedicated smoke/aerosol/dust detection study"
                    if t["series"] in ("SAME", "SAME-R", "DAFT")
                    else "Combustion study (not aerosol detection)"
                )

            rows.append({
                "table_id": t["id"],
                "score": min(score, 100),
                "series": f'{t["series"]} #{t["id"]}',
                "psi": t["psi_accession"],
                "hardware": hw,
                "focus": role,
                "tests": t["row_count"],
                "why": why,
            })
        rows.sort(key=lambda r: (r["score"], r["tests"]), reverse=True)
        result[gid] = rows
    return result


def load_dataset(path: Path = DATA_PATH) -> dict[str, Any]:
    mtime = path.stat().st_mtime
    if _DATA_CACHE["data"] is not None and _DATA_CACHE["mtime"] == mtime:
        return _DATA_CACHE["data"]

    with path.open(encoding="utf-8") as f:
        raw = json.load(f)

    tables = raw.get("tables") or []
    if not tables:
        raise ValueError("Dataset contains no tables")

    for t in tables:
        t["columns"] = [clean_col(c) for c in t.get("columns", [])]
        t["records"] = [{clean_col(k): v for k, v in r.items()} for r in t.get("records", [])]
        t["o2"] = o2_profile(t)
        t["coverage"] = table_coverage(t)
        hw, role = DOMAIN_TAGS.get(t["series"], ("PSI", "Combustion"))
        t["hardware"] = hw
        t["focus"] = role
        t["column_completeness"] = [
            {"column": c, "filled_pct": round(100 * fill_share(t, [c]))}
            for c in t["columns"]
        ]

    _DATA_CACHE["mtime"] = mtime
    _DATA_CACHE["data"] = raw
    return raw


def build_summary_payload(data: dict[str, Any]) -> dict[str, Any]:
    tables = data["tables"]
    series_list = [
        {
            "id": t["id"],
            "series": t["series"],
            "psi_accession": t["psi_accession"],
            "source_file": t["source_file"],
            "row_count": t["row_count"],
            "columns": t["columns"],
            "o2": t["o2"],
            "coverage": t["coverage"],
            "hardware": t["hardware"],
            "focus": t["focus"],
            "column_completeness": t["column_completeness"],
        }
        for t in tables
    ]
    return {
        "meta": data.get("meta", {}),
        "param_order": ["O₂", *PARAM_PATTERNS.keys()],
        "goals": RANKING_GOALS,
        "rankings": rank_series(tables),
        "series": series_list,
    }


def _csv_safe(value: Any) -> str:
    s = str(value)
    return "'" + s if s[:1] in ("=", "+", "-", "@") else s


def export_gap_map(tables: list[dict[str, Any]], fmt: str) -> tuple[bytes, str, str]:
    param_names = ["O₂", *PARAM_PATTERNS.keys()]
    rows: list[dict[str, Any]] = []
    for t in tables:
        hi = t["o2"]["max"]
        moon = "n/a" if hi is None else ("Yes" if hi >= 30 else "No")
        row: dict[str, Any] = {"Series": f'{t["series"]} #{t["id"]}', "Tests": t["row_count"]}
        for p in param_names:
            row[p] = t["coverage"][p]["label"]
        row["O₂ ≥ 30% (Moon)"] = moon
        rows.append(row)

    df = pd.DataFrame(rows).map(_csv_safe)
    if fmt == "csv":
        return df.to_csv(index=False).encode("utf-8-sig"), "text/csv; charset=utf-8", "gap_map.csv"

    buf = BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Gap map")
    return (
        buf.getvalue(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "gap_map.xlsx",
    )
