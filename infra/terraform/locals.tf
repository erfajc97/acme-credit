data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name       = "${var.project}-${var.environment}"
  account_id = data.aws_caller_identity.current.account_id
  azs        = slice(data.aws_availability_zones.available.names, 0, 2)

  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  api_port          = 3000
  card_network_port = 3001

  # Service Connect DNS names inside the VPC (same names as docker compose).
  api_internal_url          = "http://api:${local.api_port}"
  card_network_internal_url = "http://card-network:${local.card_network_port}"

  images = {
    api          = "${aws_ecr_repository.this["api"].repository_url}:${var.image_tag}"
    card_network = "${aws_ecr_repository.this["card-network"].repository_url}:${var.image_tag}"
  }
}
