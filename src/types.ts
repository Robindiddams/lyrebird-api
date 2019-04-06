
export interface TaskRecord {
	started_ts: number;
	completed_ts?: number;
  ttl: number;
  status: string;
  completed_path?: string;
  id: string;
}

export interface modelResp {
  success: boolean;
  message?: string;
}