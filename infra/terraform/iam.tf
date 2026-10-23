# Two roles per workload:
#   execution role -> what the ECS agent needs to START the task (pull its image, write its logs,
#                     resolve its `secrets`). Secrets are read here, scoped per workload.
#   task role      -> what the running code may call. Only the core touches S3; the card network
#                     gets no AWS permissions at all (outside the trust boundary, P3).

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:ecs:${var.region}:${local.account_id}:*"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }
  }
}

locals {
  workloads = {
    core = {
      repository  = aws_ecr_repository.this["api"].arn
      log_groups  = [aws_cloudwatch_log_group.ecs["api"].arn, aws_cloudwatch_log_group.ecs["worker"].arn, aws_cloudwatch_log_group.ecs["migrate"].arn]
      secret_arns = local.core_secret_arns
    }
    card_network = {
      repository  = aws_ecr_repository.this["card-network"].arn
      log_groups  = [aws_cloudwatch_log_group.ecs["card-network"].arn]
      secret_arns = local.card_network_secret_arns
    }
  }
}

resource "aws_iam_role" "execution" {
  for_each = local.workloads

  name               = "${local.name}-${replace(each.key, "_", "-")}-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "execution" {
  for_each = local.workloads

  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"] # this action has no resource-level scoping
  }

  statement {
    sid       = "PullOwnImage"
    actions   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
    resources = [each.value.repository]
  }

  statement {
    sid       = "WriteOwnLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = [for arn in each.value.log_groups : "${arn}:*"]
  }

  statement {
    sid       = "ReadOwnSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = each.value.secret_arns
  }

  statement {
    sid       = "DecryptOwnSecrets"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.main.arn]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["secretsmanager.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "execution" {
  for_each = local.workloads

  name   = "start-task"
  role   = aws_iam_role.execution[each.key].id
  policy = data.aws_iam_policy_document.execution[each.key].json
}

# --- task roles ---

resource "aws_iam_role" "task_core" {
  name               = "${local.name}-core-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "task_core" {
  statement {
    sid       = "ListStatements"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.statements.arn]
  }

  statement {
    sid       = "ReadWriteStatements"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.statements.arn}/*"]
  }

  statement {
    sid       = "StatementsEncryption"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.main.arn]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["s3.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "task_core" {
  name   = "statements"
  role   = aws_iam_role.task_core.id
  policy = data.aws_iam_policy_document.task_core.json
}

# No policy attached on purpose: the simulator needs no AWS API.
resource "aws_iam_role" "task_card_network" {
  name               = "${local.name}-card-network-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}
