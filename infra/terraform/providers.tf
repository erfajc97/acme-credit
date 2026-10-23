provider "aws" {
  region = var.region

  default_tags {
    tags = local.tags
  }
}

# CloudFront only accepts ACM certificates and WAF web ACLs from us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.tags
  }
}
