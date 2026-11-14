"""FastAPI server serving PSI dataset API, AI SSE agent, and React SPA."""

import asyncio
import json
import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import FRONTEND_DIST_DIR, get_api_key, get_default_effort, get_default_model
from .agent import list_models, send_feedback, stream_agent
from .psi_data import build_summary_payload, export_gap_map, load_dataset

logger = logging.getLogger(__name__)
app = FastAPI(title="Fire Safety in Space")


class HistoryTurn(BaseModel):
    role: str
    content: str


class AgentStreamRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    model: str | None = None
    effort: str | None = None
    history: list[HistoryTurn] = Field(default_factory=list)


class FeedbackRequest(BaseModel):
    request_id: str = Field(min_length=1)
    rating: str | None = None


def _filter_tables(
    tables: list[dict[str, Any]],
    search: str = "",
    min_tests: int = 0,
    only_o2: bool = False,
    o2_threshold: float = 0.0,
) -> list[dict[str, Any]]:
    q = search.strip().lower()
    out: list[dict[str, Any]] = []
    for t in tables:
        if q and q not in t["series"].lower():
            continue
        if t["row_count"] < min_tests:
            continue
        hi = t["o2"]["max"]
        if only_o2 and hi is None:
            continue
        if o2_threshold > 0 and (hi is None or hi < o2_threshold):
            continue
        out.append(t)
    return out


@app.get("/api/health")
def health() -> dict[str, Any]:
    data = load_dataset()
    return {
        "status": "ok",
        "total_tables": len(data["tables"]),
        "total_records": sum(t["row_count"] for t in data["tables"]),
        "ai_configured": bool(get_api_key()),
    }


@app.get("/api/dataset")
def get_dataset() -> dict[str, Any]:
    return build_summary_payload(load_dataset())


@app.get("/api/series/{table_id}")
def get_series_detail(table_id: int) -> dict[str, Any]:
    data = load_dataset()
    for t in data["tables"]:
        if t["id"] == table_id:
            return {
                "id": t["id"],
                "series": t["series"],
                "psi_accession": t["psi_accession"],
                "source_file": t["source_file"],
                "row_count": t["row_count"],
                "columns": t["columns"],
                "records": t["records"],
                "column_completeness": t["column_completeness"],
                "o2": t["o2"],
            }
    raise HTTPException(status_code=404, detail="Series not found")


@app.get("/api/export/{fmt}")
def download_gap_map(
    fmt: str,
    search: str = Query(default=""),
    min_tests: int = Query(default=0, ge=0),
    only_o2: bool = Query(default=False),
    o2_threshold: float = Query(default=0.0, ge=0.0, le=100.0),
) -> Response:
    if fmt not in ("csv", "xlsx"):
        raise HTTPException(status_code=400, detail="Unsupported format")
    tables = _filter_tables(load_dataset()["tables"], search, min_tests, only_o2, o2_threshold)
    content, media_type, filename = export_gap_map(tables, fmt)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/agent/models")
def agent_models() -> dict[str, Any]:
    return {
        "configured": bool(get_api_key()),
        "default_model": get_default_model(),
        "default_effort": get_default_effort(),
        "models": list_models(),
    }


@app.post("/api/agent/stream")
async def agent_stream(req: AgentStreamRequest) -> StreamingResponse:
    if not get_api_key():
        raise HTTPException(status_code=503, detail="Coarena API key is not configured.")
    tables = load_dataset()["tables"]
    history = [{"role": h.role, "content": h.content} for h in req.history]

    async def event_iter():
        try:
            async for ev in stream_agent(
                req.question,
                tables,
                model=req.model,
                history=history,
                effort=req.effort,
            ):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("AI agent stream error")
            err = {"type": "error", "message": "Could not get an answer right now. Check your API key or try again."}
            yield f"data: {json.dumps(err)}\n\n"

    return StreamingResponse(
        event_iter(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/agent/feedback")
def agent_feedback(req: FeedbackRequest) -> dict[str, bool]:
    if req.rating not in ("up", "down", None):
        raise HTTPException(status_code=400, detail="Invalid rating")
    return {"ok": send_feedback(req.request_id, req.rating)}


assets_dir = FRONTEND_DIST_DIR / "assets"
if assets_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


@app.get("/{full_path:path}")
def serve_spa(full_path: str) -> Response:
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    index_file = FRONTEND_DIST_DIR / "index.html"
    if not index_file.is_file():
        return Response("Frontend not built yet. Run `npm --prefix frontend run build`.", status_code=503)
    target = FRONTEND_DIST_DIR / full_path
    if full_path and target.is_file():
        return FileResponse(str(target))
    return FileResponse(str(index_file))
