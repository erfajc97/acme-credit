# web (customer) and admin (back office): Astro static builds on private S3 buckets behind
# CloudFront with Origin Access Control. Separate buckets and distributions keep the two attack
# surfaces apart (plan.md decision 8); admin can also sit behind a WAF IP allowlist (waf.tf).

locals {
  sites = {
    web   = { domain = var.web_domain, web_acl_id = null }
    admin = { domain = var.admin_domain, web_acl_id = local.admin_web_acl_arn }
  }
}

resource "aws_s3_bucket" "site" {
  for_each = local.sites

  bucket = "${local.name}-${each.key}-site-${local.account_id}"
}

resource "aws_s3_bucket_ownership_controls" "site" {
  for_each = aws_s3_bucket.site

  bucket = each.value.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  for_each = aws_s3_bucket.site

  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "site" {
  for_each = aws_s3_bucket.site

  bucket = each.value.id

  versioning_configuration {
    status = "Enabled" # a bad upload is rolled back by restoring the previous versions
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  for_each = aws_s3_bucket.site

  bucket = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256" # public content; SSE-KMS would need a key policy for CloudFront
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "site" {
  for_each = aws_s3_bucket.site

  bucket = each.value.id

  rule {
    id     = "expire-old-builds"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_cloudfront_origin_access_control" "site" {
  for_each = local.sites

  name                              = "${local.name}-${each.key}"
  description                       = "OAC for the ${each.key} bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Mirrors infra/docker/nginx-static.conf `try_files $uri $uri/index.html`: Astro emits
# /signin/index.html, S3 has no directory index.
resource "aws_cloudfront_function" "directory_index" {
  name    = "${local.name}-directory-index"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite /path and /path/ to /path/index.html"
  publish = true

  code = <<-JS
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
      } else if (uri.split('/').pop().indexOf('.') === -1) {
        request.uri = uri + '/index.html';
      }
      return request;
    }
  JS
}

# Same headers as infra/docker/nginx-security-headers.conf, plus HSTS (TLS terminates here).
# Script/style hashes stay in each page's Astro meta CSP; the header adds frame-ancestors.
resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${local.name}-security-headers"
  comment = "Mirrors infra/docker/nginx-security-headers.conf"

  security_headers_config {
    content_security_policy {
      content_security_policy = "frame-ancestors 'none'"
      override                = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    content_type_options {
      override = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = false
      override                   = true
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "camera=(), microphone=(), geolocation=()"
      override = true
    }
  }

  remove_headers_config {
    items {
      header = "Server"
    }
  }
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

resource "aws_cloudfront_distribution" "site" {
  for_each = local.sites

  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  comment             = "${local.name} ${each.key}"
  aliases             = [each.value.domain]
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  web_acl_id          = each.value.web_acl_id

  origin {
    origin_id                = "s3-${each.key}"
    domain_name              = aws_s3_bucket.site[each.key].bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site[each.key].id
  }

  # Cache-Control comes from the upload (docs/deploy.md): /_astro/* immutable, HTML no-cache
  # (WA5); CachingOptimized honours the origin header.
  default_cache_behavior {
    target_origin_id           = "s3-${each.key}"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.directory_index.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.cloudfront_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

data "aws_iam_policy_document" "site_bucket" {
  for_each = local.sites

  statement {
    sid       = "CloudFrontReadOnly"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site[each.key].arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site[each.key].arn]
    }
  }

  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.site[each.key].arn,
      "${aws_s3_bucket.site[each.key].arn}/*",
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

resource "aws_s3_bucket_policy" "site" {
  for_each = local.sites

  bucket = aws_s3_bucket.site[each.key].id
  policy = data.aws_iam_policy_document.site_bucket[each.key].json

  depends_on = [aws_s3_bucket_public_access_block.site]
}
