
export interface TaskRecord {
	upload_ts: number;
	completed_ts?: number;
  ttl: number;
  upload_path?: string;
  completed_path?: string;
  id: string;
}