export type BuildStatus = "queued" | "building" | "success" | "failed";
export type BuildSource = "compiled" | "prebuilt";

export interface FirmwareBuild {
  id: number;
  baseVersion: string;
  env: string;
  overrides: string;
  buildFlags: string;
  source: BuildSource;
  status: BuildStatus;
  errorMessage: string | null;
  binaryFilename: string | null;
  binaryGzFilename: string | null;
  presetName: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PrebuiltVariant {
  variant: string;
  sizeBytes: number;
  downloadUrl: string;
}

export interface BuildPreset {
  id: number;
  name: string;
  baseVersion: string;
  env: string;
  overrides: string;
  buildFlags: string;
  createdAt: string;
}

export interface CreateBuildInput {
  baseVersion: string;
  env: string;
  overrides: string;
  buildFlags: string;
  presetName?: string;
}
