import { useEffect, useMemo, useState } from "react";
import { fetchDataset } from "../api/client";
import type { DatasetPayload, FilterState, SeriesSummary } from "../types/psi";

const DEFAULT_FILTERS: FilterState = {
  search: "",
  onlyO2: false,
  o2Threshold: 0,
  minTests: 0,
};

export function useDashboard() {
  const [data, setData] = useState<DatasetPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  useEffect(() => {
    let active = true;
    fetchDataset()
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) {
          setError(
            "Could not load the dataset. Make sure experimental_dataset.json is present and valid.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const maxTests = useMemo(() => {
    if (!data?.series.length) return 469;
    return Math.max(...data.series.map((s) => s.row_count));
  }, [data]);

  const filteredSeries = useMemo<SeriesSummary[]>(() => {
    if (!data) return [];
    const q = filters.search.trim().toLowerCase();
    return data.series.filter((t) => {
      if (q && !t.series.toLowerCase().includes(q)) return false;
      if (t.row_count < filters.minTests) return false;
      const hi = t.o2.max;
      if (filters.onlyO2 && hi === null) return false;
      if (filters.o2Threshold > 0 && (hi === null || hi < filters.o2Threshold)) return false;
      return true;
    });
  }, [data, filters]);

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  return {
    data,
    loading,
    error,
    filters,
    setFilters,
    resetFilters,
    maxTests,
    filteredSeries,
  };
}
