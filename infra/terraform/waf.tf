# Optional IP allowlist in front of the admin site (CloudFront scope, so us-east-1). The admin API
# routes are still protected by login + role on the core (A14); this only hides the back office.

locals {
  admin_waf_enabled = length(var.admin_allowed_cidrs) > 0
  admin_web_acl_arn = local.admin_waf_enabled ? aws_wafv2_web_acl.admin[0].arn : null
}

resource "aws_wafv2_ip_set" "admin" {
  count    = local.admin_waf_enabled ? 1 : 0
  provider = aws.us_east_1

  name               = "${local.name}-admin-allowlist"
  scope              = "CLOUDFRONT"
  ip_address_version = "IPV4"
  addresses          = var.admin_allowed_cidrs
}

resource "aws_wafv2_web_acl" "admin" {
  count    = local.admin_waf_enabled ? 1 : 0
  provider = aws.us_east_1

  name  = "${local.name}-admin"
  scope = "CLOUDFRONT"

  default_action {
    block {}
  }

  rule {
    name     = "allow-office-ips"
    priority = 1

    action {
      allow {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.admin[0].arn
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name}-admin-allow"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name}-admin"
    sampled_requests_enabled   = true
  }
}
