-- =====================================================
-- 扫码登录功能 - qr_login_tokens 表创建及 RLS 策略
-- =====================================================
-- 用途：支持扫码登录功能，允许匿名用户创建登录令牌
-- 执行位置：Supabase SQL Editor
-- =====================================================

-- 1. 创建 qr_login_tokens 表
CREATE TABLE IF NOT EXISTS qr_login_tokens (
  id BIGSERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  email TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, verified, expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

-- 2. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_qr_login_tokens_token ON qr_login_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_login_tokens_status ON qr_login_tokens(status);
CREATE INDEX IF NOT EXISTS idx_qr_login_tokens_expires_at ON qr_login_tokens(expires_at);

-- 3. 启用 RLS (Row Level Security)
ALTER TABLE qr_login_tokens ENABLE ROW LEVEL SECURITY;

-- 4. 删除已存在的策略（避免重复创建时报错）
DROP POLICY IF EXISTS "Allow anonymous insert" ON qr_login_tokens;
DROP POLICY IF EXISTS "Allow anonymous select pending" ON qr_login_tokens;
DROP POLICY IF EXISTS "Allow anonymous update pending" ON qr_login_tokens;
DROP POLICY IF EXISTS "Allow anonymous delete" ON qr_login_tokens;
DROP POLICY IF EXISTS "Allow select own tokens" ON qr_login_tokens;
DROP POLICY IF EXISTS "Allow update verified tokens" ON qr_login_tokens;

-- 5. 创建 RLS 策略

-- 策略1: 允许所有人插入新令牌（匿名用户创建二维码）
CREATE POLICY "Allow anonymous insert"
  ON qr_login_tokens
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 策略2: 允许所有人查询 pending 状态的令牌（扫码端检查令牌状态）
CREATE POLICY "Allow anonymous select pending"
  ON qr_login_tokens
  FOR SELECT
  TO anon, authenticated
  USING (status = 'pending' OR status = 'verified');

-- 策略3: 允许更新 pending 状态的令牌（扫码端确认登录）
CREATE POLICY "Allow anonymous update pending"
  ON qr_login_tokens
  FOR UPDATE
  TO anon, authenticated
  USING (status = 'pending')
  WITH CHECK (true);

-- 策略4: 允许删除过期或已验证的令牌（清理用途）
CREATE POLICY "Allow anonymous delete"
  ON qr_login_tokens
  FOR DELETE
  TO anon, authenticated
  USING (status = 'verified' OR expires_at < NOW());

-- 6. 创建自动清理过期令牌的函数（可选，建议定期执行）
CREATE OR REPLACE FUNCTION cleanup_expired_qr_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM qr_login_tokens
  WHERE expires_at < NOW() - INTERVAL '1 hour'  -- 保留1小时用于调试
     OR (status = 'verified' AND verified_at < NOW() - INTERVAL '10 minutes');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 说明文档
COMMENT ON TABLE qr_login_tokens IS '扫码登录令牌表 - 支持教师端生成二维码，手机端扫码确认登录';
COMMENT ON COLUMN qr_login_tokens.token IS '唯一令牌值，用于标识本次登录会话';
COMMENT ON COLUMN qr_login_tokens.status IS '状态: pending=等待扫码, verified=已确认, expired=已过期';
COMMENT ON COLUMN qr_login_tokens.email IS '扫码确认后填入的教师邮箱';
COMMENT ON COLUMN qr_login_tokens.expires_at IS '令牌过期时间，默认5分钟';

-- =====================================================
-- 使用示例
-- =====================================================
-- 1. 教师端创建令牌：
--    INSERT INTO qr_login_tokens (token, status, expires_at) 
--    VALUES ('qr_xxx', 'pending', NOW() + INTERVAL '5 minutes');
--
-- 2. 手机端查询令牌：
--    SELECT * FROM qr_login_tokens WHERE token = 'qr_xxx' AND status = 'pending';
--
-- 3. 手机端确认登录：
--    UPDATE qr_login_tokens 
--    SET status = 'verified', email = 'teacher@example.com', verified_at = NOW()
--    WHERE token = 'qr_xxx' AND status = 'pending';
--
-- 4. 教师端轮询检查：
--    SELECT * FROM qr_login_tokens WHERE token = 'qr_xxx' AND status = 'verified';
--
-- 5. 清理过期令牌：
--    SELECT cleanup_expired_qr_tokens();
-- =====================================================
