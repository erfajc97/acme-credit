# Optional: alias records when the zone lives in Route 53. Otherwise point the hostnames at the
# `dns_targets` output by hand.

locals {
  manage_dns = var.route53_zone_id != ""

  dns_records = {
    web     = { name = var.web_domain, target = aws_cloudfront_distribution.site["web"].domain_name, zone = aws_cloudfront_distribution.site["web"].hosted_zone_id }
    admin   = { name = var.admin_domain, target = aws_cloudfront_distribution.site["admin"].domain_name, zone = aws_cloudfront_distribution.site["admin"].hosted_zone_id }
    api     = { name = var.api_domain, target = aws_lb.main.dns_name, zone = aws_lb.main.zone_id }
    network = { name = var.network_domain, target = aws_lb.main.dns_name, zone = aws_lb.main.zone_id }
  }
}

resource "aws_route53_record" "alias" {
  for_each = { for key, record in local.dns_records : key => record if local.manage_dns }

  zone_id = var.route53_zone_id
  name    = each.value.name
  type    = "A"

  alias {
    name                   = each.value.target
    zone_id                = each.value.zone
    evaluate_target_health = false
  }
}
