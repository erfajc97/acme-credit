# Statements and exports (ADR-0005: RustFS locally, S3 here with IAM role credentials).
resource "aws_s3_bucket" "statements" {
  bucket = "${local.name}-statements-${local.account_id}"
}

resource "aws_s3_bucket_ownership_controls" "statements" {
  bucket = aws_s3_bucket.statements.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "statements" {
  bucket = aws_s3_bucket.statements.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "statements" {
  bucket = aws_s3_bucket.statements.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "statements" {
  bucket = aws_s3_bucket.statements.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.main.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "statements" {
  bucket = aws_s3_bucket.statements.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.statements_noncurrent_retention_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

data "aws_iam_policy_document" "statements_bucket" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.statements.arn,
      "${aws_s3_bucket.statements.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "statements" {
  bucket = aws_s3_bucket.statements.id
  policy = data.aws_iam_policy_document.statements_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.statements]
}
