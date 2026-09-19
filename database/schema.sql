-- PDF Security System - MySQL 8.0 Schema
-- Run: mysql -u root -p pdf_security < database/schema.sql

CREATE DATABASE IF NOT EXISTS pdf_security CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pdf_security;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                    CHAR(36)      NOT NULL DEFAULT (UUID()),
  email                 VARCHAR(255)  NOT NULL UNIQUE,
  password_hash         VARCHAR(255)  NOT NULL,
  full_name             VARCHAR(255)  NOT NULL,
  role                  ENUM('admin','user') NOT NULL DEFAULT 'user',
  is_blocked            TINYINT(1)    NOT NULL DEFAULT 0,
  failed_login_attempts INT           NOT NULL DEFAULT 0,
  locked_until          DATETIME      NULL,
  last_login            DATETIME      NULL,
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_users_email (email),
  INDEX idx_users_role  (role)
) ENGINE=InnoDB;

-- ── Documents ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id           CHAR(36)      NOT NULL DEFAULT (UUID()),
  title        VARCHAR(500)  NOT NULL,
  description  TEXT          NULL,
  filename     VARCHAR(500)  NOT NULL,
  file_path    VARCHAR(1000) NOT NULL,
  file_size    BIGINT        NOT NULL DEFAULT 0,
  mime_type    VARCHAR(100)  NOT NULL DEFAULT 'application/pdf',
  page_count   INT           NOT NULL DEFAULT 0,
  uploaded_by  CHAR(36)      NOT NULL,
  is_deleted   TINYINT(1)    NOT NULL DEFAULT 0,
  deleted_at   DATETIME      NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_docs_uploader  (uploaded_by),
  INDEX idx_docs_deleted   (is_deleted),
  FULLTEXT INDEX idx_docs_search (title, description)
) ENGINE=InnoDB;

-- ── Document Permissions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_permissions (
  id          CHAR(36)   NOT NULL DEFAULT (UUID()),
  document_id CHAR(36)   NOT NULL,
  user_id     CHAR(36)   NOT NULL,
  can_view    TINYINT(1) NOT NULL DEFAULT 1,
  granted_by  CHAR(36)   NOT NULL,
  granted_at  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME   NULL,
  revoked_at  DATETIME   NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_doc_user (document_id, user_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (granted_by)  REFERENCES users(id)     ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Sessions ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id            CHAR(36)      NOT NULL DEFAULT (UUID()),
  user_id       CHAR(36)      NOT NULL,
  document_id   CHAR(36)      NOT NULL,
  session_token VARCHAR(500)  NOT NULL UNIQUE,
  ip_address    VARCHAR(50)   NULL,
  user_agent    TEXT          NULL,
  started_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME      NOT NULL,
  revoked_at    DATETIME      NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  page_views    INT           NOT NULL DEFAULT 0,
  last_activity DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  INDEX idx_sessions_token  (session_token(100)),
  INDEX idx_sessions_user   (user_id),
  INDEX idx_sessions_active (is_active)
) ENGINE=InnoDB;

-- ── Access Logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_logs (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id     CHAR(36)     NULL,
  document_id CHAR(36)     NULL,
  session_id  CHAR(36)     NULL,
  event_type  VARCHAR(100) NOT NULL,
  event_data  JSON         NULL,
  ip_address  VARCHAR(50)  NULL,
  user_agent  TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_logs_user     (user_id),
  INDEX idx_logs_document (document_id),
  INDEX idx_logs_event    (event_type),
  INDEX idx_logs_created  (created_at)
) ENGINE=InnoDB;

-- ── Security Events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_events (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id     CHAR(36)     NULL,
  document_id CHAR(36)     NULL,
  session_id  CHAR(36)     NULL,
  event_type  VARCHAR(100) NOT NULL,
  severity    ENUM('low','medium','high','critical') NOT NULL DEFAULT 'low',
  description TEXT         NULL,
  event_data  JSON         NULL,
  ip_address  VARCHAR(50)  NULL,
  user_agent  TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_sec_user     (user_id),
  INDEX idx_sec_severity (severity),
  INDEX idx_sec_created  (created_at)
) ENGINE=InnoDB;

-- ── AI Risk Assessments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_risk_assessments (
  id                  CHAR(36)      NOT NULL DEFAULT (UUID()),
  user_id             CHAR(36)      NOT NULL,
  document_id         CHAR(36)      NULL,
  session_id          CHAR(36)      NULL,
  risk_score          INT           NOT NULL DEFAULT 0,
  classification      VARCHAR(100)  NULL,
  confidence          FLOAT         NULL,
  reasons             JSON          NULL,
  recommended_action  VARCHAR(50)   NULL,
  detailed_explanation TEXT         NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_risk_user    (user_id),
  INDEX idx_risk_score   (risk_score),
  INDEX idx_risk_created (created_at)
) ENGINE=InnoDB;

-- ── Security Alerts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_alerts (
  id                CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id           CHAR(36)     NULL,
  document_id       CHAR(36)     NULL,
  session_id        CHAR(36)     NULL,
  risk_assessment_id CHAR(36)    NULL,
  alert_type        VARCHAR(100) NOT NULL,
  severity          ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  title             VARCHAR(500) NOT NULL,
  description       TEXT         NULL,
  status            ENUM('open','investigating','resolved','dismissed') NOT NULL DEFAULT 'open',
  assigned_to       CHAR(36)     NULL,
  resolved_at       DATETIME     NULL,
  resolution_notes  TEXT         NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_alerts_status   (status),
  INDEX idx_alerts_severity (severity),
  INDEX idx_alerts_created  (created_at)
) ENGINE=InnoDB;

-- ── Default admin user (password: Admin123!) ──────────────────────────────────
-- bcrypt hash of "Admin123!"
INSERT IGNORE INTO users (id, email, password_hash, full_name, role)
VALUES (
  UUID(),
  'admin@example.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgHAnE.bpBZ5AQJFAuoJ.i',
  'System Admin',
  'admin'
);
