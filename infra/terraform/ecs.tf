resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# Service Connect gives the same DNS names as docker compose (`api`, `card-network`) inside the
# VPC, so PROVIDER_API_URL / CORE_API_URL never leave the private network.
resource "aws_service_discovery_http_namespace" "main" {
  name        = "${local.name}.internal"
  description = "Service Connect namespace for ${local.name}"
}

resource "aws_cloudwatch_log_group" "ecs" {
  for_each = toset(["api", "worker", "migrate", "card-network"])

  name              = "/ecs/${local.name}/${each.key}"
  retention_in_days = var.log_retention_days
}

locals {
  # Same settings for api, worker and migrate (compose: `environment: *core-env`).
  core_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = tostring(local.api_port) },
    { name = "LOG_LEVEL", value = var.log_level },
    { name = "CORS_ORIGINS", value = "https://${var.web_domain},https://${var.admin_domain}" },
    { name = "ACCESS_TOKEN_TTL_SECONDS", value = "900" },
    { name = "REFRESH_TOKEN_TTL_SECONDS", value = "604800" },
    { name = "PROVIDER_API_URL", value = local.card_network_internal_url },
    { name = "HOLD_TTL_HOURS", value = tostring(var.hold_ttl_hours) },
    { name = "PENDING_PAYMENT_TTL_MINUTES", value = tostring(var.pending_payment_ttl_minutes) },
    { name = "SEED_ADMIN_EMAIL", value = var.seed_admin_email },
    { name = "SEED_DEMO_CUSTOMER", value = "false" },
    { name = "S3_BUCKET", value = aws_s3_bucket.statements.bucket },
    { name = "AWS_REGION", value = var.region },
    # RDS CA bundle baked into the image (docs/deploy.md, "Prerequisites"), for sslmode=verify-full.
    { name = "NODE_EXTRA_CA_CERTS", value = "/app/certs/rds-global-bundle.pem" },
  ]

  card_network_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = tostring(local.card_network_port) },
    { name = "LOG_LEVEL", value = var.log_level },
    { name = "CORS_ORIGINS", value = "https://${var.web_domain}" },
    { name = "CORE_API_URL", value = local.api_internal_url },
    { name = "PUBLIC_URL", value = "https://${var.network_domain}" },
    { name = "WEB_URL", value = "https://${var.web_domain}" },
    { name = "CAPTURE_DELAY_MS", value = tostring(var.capture_delay_ms) },
  ]

  log_config = {
    for key, group in aws_cloudwatch_log_group.ecs : key => {
      logDriver = "awslogs"
      options = {
        awslogs-group         = group.name
        awslogs-region        = var.region
        awslogs-stream-prefix = key
      }
    }
  }

  http_health_check = {
    for svc, port in { "api" = local.api_port, "card-network" = local.card_network_port } : svc => {
      command                = ["CMD-SHELL", "wget -qO- http://127.0.0.1:${port}/health >/dev/null || exit 1"]
      interval               = 15
      timeout                = 5
      retries                = 3
      startPeriod            = 20
    }
  }

  runtime_platform = {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }
}

# --- task definitions ---

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.execution["core"].arn
  task_role_arn            = aws_iam_role.task_core.arn

  runtime_platform {
    operating_system_family = local.runtime_platform.operating_system_family
    cpu_architecture        = local.runtime_platform.cpu_architecture
  }

  # Migrations run in their own one-off task (below), so the service starts the API only.
  container_definitions = jsonencode([{
    name             = "api"
    image            = local.images.api
    essential        = true
    command          = ["node", "dist/main.js"]
    portMappings     = [{ name = "http", containerPort = local.api_port, protocol = "tcp", appProtocol = "http" }]
    environment      = local.core_environment
    secrets          = local.core_secrets
    healthCheck      = local.http_health_check["api"]
    logConfiguration = local.log_config["api"]
  }])
}

# Outbox relay + provider sweep (P2): same image and settings as the API, no port.
resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.execution["core"].arn
  task_role_arn            = aws_iam_role.task_core.arn

  runtime_platform {
    operating_system_family = local.runtime_platform.operating_system_family
    cpu_architecture        = local.runtime_platform.cpu_architecture
  }

  container_definitions = jsonencode([{
    name        = "worker"
    image       = local.images.api
    essential   = true
    command     = ["node", "dist/worker.js"]
    environment = local.core_environment
    secrets     = local.core_secrets
    healthCheck = {
      command     = ["CMD", "node", "-e", "process.kill(1, 0)"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 10
    }
    logConfiguration = local.log_config["worker"]
  }])
}

# One-off: `prisma migrate deploy`, then the idempotent seed (admin only in production).
# Run with `aws ecs run-task` BEFORE updating the services (output `migrate_run_task_command`).
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution["core"].arn
  task_role_arn            = aws_iam_role.task_core.arn

  runtime_platform {
    operating_system_family = local.runtime_platform.operating_system_family
    cpu_architecture        = local.runtime_platform.cpu_architecture
  }

  container_definitions = jsonencode([{
    name      = "migrate"
    image     = local.images.api
    essential = true
    command = [
      "sh", "-c",
      "node node_modules/prisma/build/index.js migrate deploy && node dist/seed.js",
    ]
    environment      = local.core_environment
    secrets          = local.core_secrets
    logConfiguration = local.log_config["migrate"]
  }])
}

resource "aws_ecs_task_definition" "card_network" {
  family                   = "${local.name}-card-network"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.card_network_cpu
  memory                   = var.card_network_memory
  execution_role_arn       = aws_iam_role.execution["card_network"].arn
  task_role_arn            = aws_iam_role.task_card_network.arn

  runtime_platform {
    operating_system_family = local.runtime_platform.operating_system_family
    cpu_architecture        = local.runtime_platform.cpu_architecture
  }

  container_definitions = jsonencode([{
    name             = "card-network"
    image            = local.images.card_network
    essential        = true
    portMappings     = [{ name = "http", containerPort = local.card_network_port, protocol = "tcp", appProtocol = "http" }]
    environment      = local.card_network_environment
    secrets          = local.card_network_secrets
    healthCheck      = local.http_health_check["card-network"]
    logConfiguration = local.log_config["card-network"]
  }])
}

# --- services ---

resource "aws_ecs_service" "api" {
  name                              = "api"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.api.arn
  desired_count                     = var.api_desired_count
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 30
  propagate_tags                    = "SERVICE"
  enable_execute_command            = false

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = local.api_port
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name      = "http"
      discovery_name = "api"

      client_alias {
        dns_name = "api"
        port     = local.api_port
      }
    }
  }

  lifecycle {
    ignore_changes = [desired_count] # owned by autoscaling
  }

  depends_on = [aws_lb_listener_rule.api]
}

resource "aws_ecs_service" "worker" {
  name                   = "worker"
  cluster                = aws_ecs_cluster.main.id
  task_definition        = aws_ecs_task_definition.worker.arn
  desired_count          = 1
  launch_type            = "FARGATE"
  propagate_tags         = "SERVICE"
  enable_execute_command = false

  # The relay claims with FOR UPDATE SKIP LOCKED, so an overlap is safe; still, stop the old
  # task first so a deploy never runs two sweeps side by side.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.worker.id]
    assign_public_ip = false
  }

  # Client only: resolves `card-network` for the provider sweep.
  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn
  }
}

resource "aws_ecs_service" "card_network" {
  name                              = "card-network"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.card_network.arn
  desired_count                     = 1
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 30
  propagate_tags                    = "SERVICE"
  enable_execute_command            = false

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.card_network.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.card_network.arn
    container_name   = "card-network"
    container_port   = local.card_network_port
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name      = "http"
      discovery_name = "card-network"

      client_alias {
        dns_name = "card-network"
        port     = local.card_network_port
      }
    }
  }

  depends_on = [aws_lb_listener_rule.card_network]
}

# --- API autoscaling: horizontal, stateless (sessions are JWT + DB refresh tokens) ---

resource "aws_appautoscaling_target" "api" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.api_desired_count
  max_capacity       = var.api_max_count
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${local.name}-api-cpu"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
