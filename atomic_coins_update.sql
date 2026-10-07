-- v336: 原子金币更新函数
-- 解决并发竞态条件：使用数据库层面的原子操作 coins = coins + delta
-- 而不是应用层的 read-modify-write 模式

CREATE OR REPLACE FUNCTION atomic_update_coins(
  p_student_id INTEGER,
  p_coin_delta INTEGER,
  p_check_balance BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_coins INTEGER;
  v_new_coins INTEGER;
BEGIN
  -- 使用 FOR UPDATE 锁定行，防止并发修改
  SELECT coins INTO v_current_coins
  FROM students
  WHERE id = p_student_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Student not found');
  END IF;
  
  -- 检查余额
  IF p_check_balance AND p_coin_delta < 0 AND v_current_coins + p_coin_delta < 0 THEN
    RETURN json_build_object('ok', false, 'error', 'Insufficient balance', 'currentCoins', v_current_coins);
  END IF;
  
  -- 原子更新：coins = coins + delta
  UPDATE students
  SET coins = coins + p_coin_delta
  WHERE id = p_student_id
  RETURNING coins INTO v_new_coins;
  
  RETURN json_build_object(
    'ok', true,
    'coinsBefore', v_current_coins,
    'coinsAfter', v_new_coins
  );
END;
$$;

-- 添加注释
COMMENT ON FUNCTION atomic_update_coins IS 'v336: 原子更新学生金币，防止并发竞态条件';
