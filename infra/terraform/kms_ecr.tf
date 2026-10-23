# One customer-managed key for data at rest that holds customer or money data: RDS, the
# statements bucket and Secrets Manager. Yearly automatic rotation.
resource "aws_kms_key" "main" {
  description             = "${local.name} data at rest (RDS, statements, secrets)"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.main.key_id
}

# api and card-network are deployed from ECR. web/admin repos hold the nginx images
# (infra/docker/static-site.Dockerfile) for preview environments; production serves the same
# static build from S3 + CloudFront (static_sites.tf).
resource "aws_ecr_repository" "this" {
  for_each = toset(["api", "card-network", "web", "admin"])

  name                 = "${var.project}/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = aws_ecr_repository.this

  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 30 images (rollback window)"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 30
      }
      action = { type = "expire" }
    }]
  })
}
