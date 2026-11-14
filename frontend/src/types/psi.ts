export interface CoverageCell {
  share: number;
  label: string;
}

export interface O2Profile {
  cols: string[];
  min: number | null;
  max: number | null;
  note: string;
}

export interface ColumnCompleteness {
  column: string;
  filled_pct: number;
}

export interface SeriesSummary {
  id: number;
  series: string;
  psi_accession: string;
  source_file: string;
  row_count: number;
  columns: string[];
  o2: O2Profile;
  coverage: Record<string, CoverageCell>;
  hardware: string;
  focus: string;
  column_completeness: ColumnCompleteness[];
}

export interface SeriesDetail {
  id: number;
  series: string;
  psi_accession: string;
  source_file: string;
  row_count: number;
  columns: string[];
  records: Record<string, unknown>[];
  column_completeness: ColumnCompleteness[];
  o2: O2Profile;
}

export interface GoalOption {
  id: string;
  label: string;
}

export interface RankingRow {
  table_id: number;
  score: number;
  series: string;
  psi: string;
  hardware: string;
  focus: string;
  tests: number;
  why: string;
}

export interface DatasetPayload {
  meta: Record<string, unknown>;
  param_order: string[];
  goals: GoalOption[];
  rankings: Record<string, RankingRow[]>;
  series: SeriesSummary[];
}

export interface FilterState {
  search: string;
  onlyO2: boolean;
  o2Threshold: number;
  minTests: number;
}
