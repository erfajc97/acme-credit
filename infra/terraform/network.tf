# Two AZs, public subnets for the ALB and the NAT, private subnets for ECS tasks and RDS.
# One NAT gateway keeps the bill down; an AZ outage then cuts outbound traffic (ECR pulls,
# Secrets Manager) from the other AZ's tasks. Running tasks keep serving; see docs/deploy.md.

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = local.name }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = local.name }
}

resource "aws_subnet" "public" {
  count = length(local.azs)

  vpc_id                  = aws_vpc.main.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  map_public_ip_on_launch = false

  tags = { Name = "${local.name}-public-${local.azs[count.index]}", Tier = "public" }
}

resource "aws_subnet" "private" {
  count = length(local.azs)

  vpc_id            = aws_vpc.main.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 8)

  tags = { Name = "${local.name}-private-${local.azs[count.index]}", Tier = "private" }
}

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = { Name = "${local.name}-nat" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = { Name = local.name }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${local.name}-public" }
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = { Name = "${local.name}-private" }
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# S3 traffic (statements) stays on the AWS network and skips NAT data charges.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = { Name = "${local.name}-s3" }
}

# --- security groups: ingress is the allowlist; nothing reaches a task except what is listed ---

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Public HTTPS entry point"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from the internet"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP, redirected to HTTPS"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "alb_to_api" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.api.id
  ip_protocol                  = "tcp"
  from_port                    = local.api_port
  to_port                      = local.api_port
}

resource "aws_vpc_security_group_egress_rule" "alb_to_card_network" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.card_network.id
  ip_protocol                  = "tcp"
  from_port                    = local.card_network_port
  to_port                      = local.card_network_port
}

resource "aws_security_group" "api" {
  name        = "${local.name}-api"
  description = "Lending core API tasks"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "api_from_alb" {
  security_group_id            = aws_security_group.api.id
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = local.api_port
  to_port                      = local.api_port
}

# The card network calls the core's signed network API (P3) over Service Connect.
resource "aws_vpc_security_group_ingress_rule" "api_from_card_network" {
  security_group_id            = aws_security_group.api.id
  referenced_security_group_id = aws_security_group.card_network.id
  ip_protocol                  = "tcp"
  from_port                    = local.api_port
  to_port                      = local.api_port
}

# Worker and the migration task: no ingress at all.
resource "aws_security_group" "worker" {
  name        = "${local.name}-worker"
  description = "Outbox worker and one-off migration task (no ingress)"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "card_network" {
  name        = "${local.name}-card-network"
  description = "Card network / payment provider simulator (no DB or storage access)"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "card_network_from_alb" {
  security_group_id            = aws_security_group.card_network.id
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = local.card_network_port
  to_port                      = local.card_network_port
}

resource "aws_vpc_security_group_ingress_rule" "card_network_from_core" {
  for_each = {
    api    = aws_security_group.api.id
    worker = aws_security_group.worker.id
  }

  security_group_id            = aws_security_group.card_network.id
  referenced_security_group_id = each.value
  ip_protocol                  = "tcp"
  from_port                    = local.card_network_port
  to_port                      = local.card_network_port
}

# Tasks need outbound HTTPS (ECR, Secrets Manager, CloudWatch, S3) plus the ports below.
resource "aws_vpc_security_group_egress_rule" "tasks_all" {
  for_each = {
    api          = aws_security_group.api.id
    worker       = aws_security_group.worker.id
    card_network = aws_security_group.card_network.id
  }

  security_group_id = each.value
  description       = "Outbound (AWS APIs via NAT, Service Connect peers, RDS)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "db" {
  name        = "${local.name}-db"
  description = "PostgreSQL: only the core (api, worker, migrations)"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_core" {
  for_each = {
    api    = aws_security_group.api.id
    worker = aws_security_group.worker.id
  }

  security_group_id            = aws_security_group.db.id
  referenced_security_group_id = each.value
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}
