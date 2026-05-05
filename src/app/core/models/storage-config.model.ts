/** Matches the backend `StorageDriver` enum. */
export enum StorageDriver {
  LocalDisk            = 0,
  AmazonS3             = 1,
  AzureBlob            = 2,
  GoogleCloudStorage   = 3,
}

/** Human-readable labels for each driver. */
export const DRIVER_LABELS: Record<StorageDriver, string> = {
  [StorageDriver.LocalDisk]:          'Local Disk',
  [StorageDriver.AmazonS3]:           'Amazon S3',
  [StorageDriver.AzureBlob]:          'Azure Blob Storage',
  [StorageDriver.GoogleCloudStorage]: 'Google Cloud Storage',
};

/** Matches `StorageConfigDto` on the server. Sensitive fields are masked. */
export interface StorageConfigDto {
  id:                    string;
  tenantId:              string | null;
  name:                  string;
  driver:                StorageDriver;
  isActive:              boolean;
  // LocalDisk
  basePath:              string | null;
  // S3
  awsAccessKey:          string | null;
  awsSecretKey:          string | null;    // masked: "***XXXX"
  awsRegion:             string | null;
  awsBucket:             string | null;
  awsEndpoint:           string | null;
  // Azure
  azureConnectionString: string | null;    // masked
  azureContainerName:    string | null;
  // GCS
  gcsServiceAccountJson: string | null;    // masked
  gcsBucket:             string | null;
  // Shared
  maxFileSizeBytes:      number;
  allowedContentTypes:   string;
  // Audit
  createdAt:             string;
  updatedAt:             string | null;
}

/** Matches `CreateStorageConfigRequest` / `UpdateStorageConfigRequest`. */
export interface StorageConfigRequest {
  name:                  string;
  driver:                StorageDriver;
  isActive:              boolean;
  basePath?:             string | null;
  awsAccessKey?:         string | null;
  awsSecretKey?:         string | null;
  awsRegion?:            string | null;
  awsBucket?:            string | null;
  awsEndpoint?:          string | null;
  azureConnectionString?: string | null;
  azureContainerName?:   string | null;
  gcsServiceAccountJson?: string | null;
  gcsBucket?:            string | null;
  maxFileSizeBytes?:     number | null;
  allowedContentTypes?:  string | null;
}

/** Matches `TestConnectionResult`. */
export interface TestConnectionResult {
  success:    boolean;
  message:    string;
  latencyMs:  number | null;
}
