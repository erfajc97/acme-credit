# 0005 — Object storage: RustFS locally, S3 in AWS

- **Status:** accepted
- **Date:** 2026-10-21
- **Requirements:** R-09, R-10, R-53
- **Rules:** A9, AN12

## Context

Statements and exports are documents, not rows, so they belong in object storage. The plan named
MinIO. When F0 was built, the `minio/minio` and `minio/mc` images could not be pulled from Docker
Hub, quay.io or Bitnami: MinIO stopped publishing community images.

## Options considered

### A. Build MinIO from source in our own image

- **Pros:** keeps the name from the plan.
- **Cons:** an AGPL build in our pipeline; slow and fragile.

### B. SeaweedFS

- **Pros:** mature and S3-compatible.
- **Cons:** heavier configuration; no MinIO-like console.

### C. RustFS ✅ (chosen by the owner, 2026-10-21)

- **Pros:**
  - The S3 API is compatible with MinIO's.
  - It has a web console.
  - Apache-2.0 license.
  - The image pulls (`rustfs/rustfs:1.0.3`).
- **Cons:** a younger project.

## Decision

**C.**

- **Local:** compose runs `object-storage` (RustFS) on ports 9000/9001.
  `object-storage-init` (aws-cli 2.38.3) creates the bucket.
- **Code:** it only knows S3, through `@aws-sdk/client-s3` behind `StorageService` (AN12). The
  endpoint and credentials come from env.
- **AWS:** S3 with no endpoint override and IAM role credentials.

## Consequences

- Swapping the local store is a compose change only.
- Every mention of "MinIO" in the plan is now "object storage (RustFS locally, S3 in AWS)".

## Implementation

F0: `infra/docker-compose.yml`. F5: `StorageService` and statements.
