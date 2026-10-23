# Secrets are generated here so the first apply boots a working stack, then owned by Secrets
# Manager: `ignore_changes` keeps Terraform from reverting a rotation done out of band
# (docs/deploy.md, "Secrets rotation"). The values live in the state too, which is why the
# remote state bucket must be private and encrypted (versions.tf).

locals {
  # Shared by the core and the card network (both ends of the HMAC, P3).
  app_secrets = {
    JWT_SECRET              = { consumers = ["core"] }
    NETWORK_SIGNING_SECRET  = { consumers = ["core", "card_network"] }
    PROVIDER_SIGNING_SECRET = { consumers = ["core", "card_network"] }
    PROVIDER_API_SECRET     = { consumers = ["core", "card_network"] }
    SEED_ADMIN_PASSWORD     = { consumers = ["core"] }
  }
}

resource "random_password" "app" {
  for_each = local.app_secrets

  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  for_each = local.app_secrets

  name                    = "${local.name}/${lower(replace(each.key, "_", "-"))}"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "app" {
  for_each = local.app_secrets

  secret_id     = aws_secretsmanager_secret.app[each.key].id
  secret_string = random_password.app[each.key].result

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# --- database ---

resource "random_password" "db" {
  length  = 40
  special = false # the password is embedded in DATABASE_URL
}

locals {
  db_username = "acme_app"
  db_name     = "acme_credit"
}

# One JSON secret; ECS injects only the DATABASE_URL key (`<arn>:DATABASE_URL::`).
resource "aws_secretsmanager_secret" "db" {
  name                    = "${local.name}/database"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username     = local.db_username
    password     = random_password.db.result
    host         = aws_db_instance.main.address
    port         = aws_db_instance.main.port
    dbname       = local.db_name
    DATABASE_URL = "postgresql://${local.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${local.db_name}?sslmode=${var.db_ssl_mode}"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

locals {
  core_secret_arns = concat(
    [for key, cfg in local.app_secrets : aws_secretsmanager_secret.app[key].arn if contains(cfg.consumers, "core")],
    [aws_secretsmanager_secret.db.arn],
  )
  card_network_secret_arns = [
    for key, cfg in local.app_secrets : aws_secretsmanager_secret.app[key].arn if contains(cfg.consumers, "card_network")
  ]

  # ECS `secrets` blocks (resolved by the execution role at task start, never in the task def).
  core_secrets = concat(
    [for key, cfg in local.app_secrets : { name = key, valueFrom = aws_secretsmanager_secret.app[key].arn } if contains(cfg.consumers, "core")],
    [{ name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.db.arn}:DATABASE_URL::" }],
  )
  card_network_secrets = [
    for key, cfg in local.app_secrets : { name = key, valueFrom = aws_secretsmanager_secret.app[key].arn } if contains(cfg.consumers, "card_network")
  ]
}
