output "ecr_repositories" {
  description = "Push targets for docker buildx."
  value       = { for key, repo in aws_ecr_repository.this : key => repo.repository_url }
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "dns_targets" {
  description = "Where each hostname must point (CNAME/alias) when Route 53 is not managed here."
  value       = { for key, record in local.dns_records : record.name => record.target }
}

output "site_buckets" {
  description = "Upload targets for the web and admin static builds."
  value       = { for key, bucket in aws_s3_bucket.site : key => bucket.bucket }
}

output "cloudfront_distribution_ids" {
  description = "For `aws cloudfront create-invalidation`."
  value       = { for key, dist in aws_cloudfront_distribution.site : key => dist.id }
}

output "statements_bucket" {
  value = aws_s3_bucket.statements.bucket
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "db_endpoint" {
  value = aws_db_instance.main.address
}

output "secret_arns" {
  description = "Secrets Manager ARNs (values never leave AWS through outputs)."
  value = merge(
    { for key, secret in aws_secretsmanager_secret.app : key => secret.arn },
    { DATABASE = aws_secretsmanager_secret.db.arn },
  )
}

output "migrate_run_task_command" {
  description = "Runs migrations + seed as a one-off task; wait for exit code 0 before updating services."
  value = join(" ", [
    "aws ecs run-task",
    "--region ${var.region}",
    "--cluster ${aws_ecs_cluster.main.name}",
    "--task-definition ${aws_ecs_task_definition.migrate.family}",
    "--launch-type FARGATE",
    "--network-configuration 'awsvpcConfiguration={subnets=[${join(",", aws_subnet.private[*].id)}],securityGroups=[${aws_security_group.worker.id}],assignPublicIp=DISABLED}'",
    "--query 'tasks[0].taskArn' --output text",
  ])
}
