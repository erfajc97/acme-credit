terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }

  # Remote state (recommended for anything shared). The state holds the generated database
  # password and app secrets, so the bucket must be private, versioned and encrypted.
  # Bootstrap the bucket and table once (by hand or a tiny separate stack), then uncomment and run
  # `terraform init -migrate-state`. Terraform >= 1.10 can use `use_lockfile = true` instead of
  # the DynamoDB table.
  #
  # backend "s3" {
  #   bucket         = "acme-credit-tfstate-123456789012"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   kms_key_id     = "alias/acme-credit-tfstate"
  #   dynamodb_table = "acme-credit-tflock"
  # }
}
