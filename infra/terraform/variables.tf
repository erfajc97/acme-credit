variable "project" {
  description = "Name prefix for every resource."
  type        = string
  default     = "acme-credit"
}

variable "environment" {
  description = "Environment name (prod, staging...)."
  type        = string
  default     = "prod"
}

variable "region" {
  description = "AWS region for everything except the CloudFront-scoped pieces (always us-east-1)."
  type        = string
  default     = "us-east-1"
}

# --- network ---

variable "vpc_cidr" {
  description = "VPC CIDR. Two public and two private /20 subnets are carved from it."
  type        = string
  default     = "10.40.0.0/16"
}

# --- DNS and TLS ---

variable "web_domain" {
  description = "Customer app hostname (CloudFront), e.g. app.acme.example."
  type        = string
}

variable "admin_domain" {
  description = "Back-office hostname (CloudFront), e.g. admin.acme.example."
  type        = string
}

variable "api_domain" {
  description = "Lending core API hostname (ALB), e.g. api.acme.example."
  type        = string
}

variable "network_domain" {
  description = "Card network / provider simulator hostname (ALB), e.g. network.acme.example."
  type        = string
}

variable "alb_certificate_arn" {
  description = "ACM certificate in var.region covering api_domain and network_domain."
  type        = string
}

variable "cloudfront_certificate_arn" {
  description = "ACM certificate in us-east-1 covering web_domain and admin_domain."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:acm:us-east-1:", var.cloudfront_certificate_arn))
    error_message = "CloudFront certificates must live in us-east-1."
  }
}

variable "route53_zone_id" {
  description = "Optional hosted zone; when set, alias records are created for the four hostnames."
  type        = string
  default     = ""
}

variable "admin_allowed_cidrs" {
  description = "IPv4 CIDRs allowed to reach the admin site. Empty = no WAF (admin is still behind login)."
  type        = list(string)
  default     = []
}

# --- containers ---

variable "image_tag" {
  description = "Image tag deployed for api, worker and card-network (use the git SHA; tags are immutable)."
  type        = string
}

variable "cpu_architecture" {
  description = "X86_64 or ARM64 (Graviton, ~20% cheaper; build with --platform linux/arm64)."
  type        = string
  default     = "X86_64"

  validation {
    condition     = contains(["X86_64", "ARM64"], var.cpu_architecture)
    error_message = "cpu_architecture must be X86_64 or ARM64."
  }
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "api_desired_count" {
  description = "Baseline API tasks (spread over both AZs)."
  type        = number
  default     = 2
}

variable "api_max_count" {
  description = "Upper bound for API CPU target-tracking autoscaling."
  type        = number
  default     = 6
}

variable "worker_cpu" {
  type    = number
  default = 256
}

variable "worker_memory" {
  type    = number
  default = 512
}

variable "card_network_cpu" {
  type    = number
  default = 256
}

variable "card_network_memory" {
  type    = number
  default = 512
}

variable "log_level" {
  type    = string
  default = "info"
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "hold_ttl_hours" {
  type    = number
  default = 168
}

variable "pending_payment_ttl_minutes" {
  type    = number
  default = 30
}

variable "capture_delay_ms" {
  type    = number
  default = 4000
}

variable "seed_admin_email" {
  description = "Back-office admin created by the seed (its password is generated into Secrets Manager)."
  type        = string
}

# --- database ---

variable "db_instance_class" {
  type    = string
  default = "db.t4g.small"
}

variable "db_engine_version" {
  description = "PostgreSQL major version (minor upgrades are automatic)."
  type        = string
  default     = "18"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage" {
  description = "Storage autoscaling ceiling (GiB)."
  type        = number
  default     = 100
}

variable "db_multi_az" {
  description = "Synchronous standby in the second AZ (doubles the DB cost; recommended for prod)."
  type        = bool
  default     = true
}

variable "db_backup_retention_days" {
  type    = number
  default = 14
}

variable "db_deletion_protection" {
  type    = bool
  default = true
}

variable "db_ssl_mode" {
  description = "sslmode in DATABASE_URL. verify-full needs the RDS CA bundle in the image (see docs/deploy.md)."
  type        = string
  default     = "verify-full"
}

# --- storage ---

variable "statements_noncurrent_retention_days" {
  description = "How long overwritten/deleted statement versions are kept."
  type        = number
  default     = 365
}

# --- alarms ---

variable "alarm_email" {
  description = "Optional e-mail subscribed to the alarm topic (confirm the subscription mail)."
  type        = string
  default     = ""
}

variable "alb_p95_latency_threshold_seconds" {
  type    = number
  default = 0.5
}

variable "api_internal_paths" {
  description = "Core paths answered 404 on the public hostname: server-to-server only (P3), reached over Service Connect. Drop /v1/webhooks/* when a real PSP posts webhooks from the internet."
  type        = list(string)
  default     = ["/v1/network/*", "/v1/webhooks/*"]
}

variable "card_network_internal_paths" {
  description = "Provider API paths only the core calls (over Service Connect); the pay page and checkout stay public."
  type        = list(string)
  default     = ["/v1/provider/*"]
}
