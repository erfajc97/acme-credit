resource "aws_lb" "main" {
  name                       = local.name
  load_balancer_type         = "application"
  internal                   = false
  security_groups            = [aws_security_group.alb.id]
  subnets                    = aws_subnet.public[*].id
  drop_invalid_header_fields = true
  enable_deletion_protection = var.environment == "prod"
  idle_timeout               = 30
}

resource "aws_lb_target_group" "api" {
  name                 = "${local.name}-api"
  port                 = local.api_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "card_network" {
  name                 = "${local.name}-network"
  port                 = local.card_network_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.alb_certificate_arn

  # Unknown hosts (raw ALB DNS name, scanners) get nothing.
  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "application/json"
      message_body = "{\"code\":\"not_found\"}"
      status_code  = "404"
    }
  }
}

# The core's network and webhook endpoints are server-to-server (P3) and reached over Service
# Connect inside the VPC; they are not published on the public hostname.
resource "aws_lb_listener_rule" "api_block_internal" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 5

  action {
    type = "fixed-response"

    fixed_response {
      content_type = "application/json"
      message_body = "{\"code\":\"not_found\"}"
      status_code  = "404"
    }
  }

  condition {
    host_header {
      values = [var.api_domain]
    }
  }

  condition {
    path_pattern {
      values = var.api_internal_paths
    }
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    host_header {
      values = [var.api_domain]
    }
  }
}

resource "aws_lb_listener_rule" "card_network_block_internal" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 15

  action {
    type = "fixed-response"

    fixed_response {
      content_type = "application/json"
      message_body = "{\"code\":\"not_found\"}"
      status_code  = "404"
    }
  }

  condition {
    host_header {
      values = [var.network_domain]
    }
  }

  condition {
    path_pattern {
      values = var.card_network_internal_paths
    }
  }
}

resource "aws_lb_listener_rule" "card_network" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.card_network.arn
  }

  condition {
    host_header {
      values = [var.network_domain]
    }
  }
}
