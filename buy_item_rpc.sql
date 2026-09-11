-- v223: 商店购买原子操作 RPC 函数
-- 在一个事务内完成：锁行 → 校验 → 扣金币 + 加道具 + 自动佩戴
-- 
-- 使用方式：
-- SELECT buy_item(p_student_id, p_class_id, p_item_id, p_price, p_student_name);
--
-- 请在 Supabase SQL Editor 中执行此 SQL

CREATE OR REPLACE FUNCTION buy_item(
  p_student_id integer,
  p_class_id integer,
  p_item_id text,
  p_price integer,
  p_student_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- 以函数所有者权限执行，绕过 RLS
AS $$
DECLARE
  v_coins integer;
  v_shop_items jsonb;
  v_equipped_items jsonb;
  v_category text;
  v_result jsonb;
BEGIN
  -- 1. 锁定学生行（FOR UPDATE 阻塞并发）
  SELECT coins, 
         COALESCE(shop_items::jsonb, '[]'::jsonb),
         COALESCE(equipped_items::jsonb, '{}'::jsonb)
  INTO v_coins, v_shop_items, v_equipped_items
  FROM students
  WHERE id = p_student_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Student not found');
  END IF;
  
  -- 2. 检查余额
  IF v_coins < p_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient balance', 
                              'currentCoins', v_coins, 'required', p_price);
  END IF;
  
  -- 3. 检查是否已拥有
  IF v_shop_items ? p_item_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already owned');
  END IF;
  
  -- 4. 扣金币
  v_coins := v_coins - p_price;
  
  -- 5. 添加道具到 shop_items
  v_shop_items := v_shop_items || jsonb_build_array(p_item_id);
  
  -- 6. 自动佩戴（如果该类别没有装备）
  -- 根据 item ID 前缀确定类别
  v_category := CASE
    WHEN p_item_id LIKE 'border_%' THEN 'borders'
    WHEN p_item_id LIKE 'top_%' THEN 'topAccessory'
    WHEN p_item_id LIKE 'base_%' THEN 'baseEffect'
    WHEN p_item_id LIKE 'ptcl_%' THEN 'particles'
    WHEN p_item_id LIKE 'title_%' THEN 'titles'
    WHEN p_item_id LIKE 'scene_%' THEN 'scenes'
    ELSE NULL
  END;
  
  IF v_category IS NOT NULL THEN
    -- 如果该类别没有装备，自动佩戴
    IF NOT (v_equipped_items ? v_category) THEN
      v_equipped_items := jsonb_set(v_equipped_items, ARRAY[v_category], to_jsonb(p_item_id));
    END IF;
  END IF;
  
  -- 7. 更新数据库
  UPDATE students
  SET coins = v_coins,
      shop_items = v_shop_items::text,
      equipped_items = v_equipped_items::text
  WHERE id = p_student_id;
  
  -- 8. 返回结果
  RETURN jsonb_build_object(
    'ok', true,
    'coinsAfter', v_coins,
    'shopItems', v_shop_items,
    'equippedItems', v_equipped_items
  );
END;
$$;

-- 授予 anon 角色执行权限（虽然我们用 service key，但保险起见）
GRANT EXECUTE ON FUNCTION buy_item(integer, integer, text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION buy_item(integer, integer, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION buy_item(integer, integer, text, integer, text) TO service_role;
