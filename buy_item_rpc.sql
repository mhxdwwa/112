CREATE OR REPLACE FUNCTION buy_item(
  p_student_id integer,
  p_class_id integer,
  p_item_id text,
  p_price integer,
  p_student_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $body$
DECLARE
  v_coins integer;
  v_shop_items_text text;
  v_equipped_items_text text;
  v_shop_items jsonb;
  v_equipped_items jsonb;
  v_category text;
BEGIN
  SELECT coins,
         shop_items,
         equipped_items
  INTO v_coins, v_shop_items_text, v_equipped_items_text
  FROM students
  WHERE id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Student not found');
  END IF;

  IF v_shop_items_text IS NULL OR v_shop_items_text = '' THEN
    v_shop_items := '[]'::jsonb;
  ELSE
    v_shop_items := v_shop_items_text::jsonb;
  END IF;

  IF v_equipped_items_text IS NULL OR v_equipped_items_text = '' THEN
    v_equipped_items := '{}'::jsonb;
  ELSE
    v_equipped_items := v_equipped_items_text::jsonb;
  END IF;

  IF v_coins < p_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient balance',
                              'currentCoins', v_coins, 'required', p_price);
  END IF;

  IF v_shop_items ? p_item_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already owned');
  END IF;

  v_coins := v_coins - p_price;

  v_shop_items := v_shop_items || jsonb_build_array(p_item_id);

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
    IF NOT (v_equipped_items ? v_category) THEN
      v_equipped_items := jsonb_set(v_equipped_items, ARRAY[v_category], to_jsonb(p_item_id));
    END IF;
  END IF;

  UPDATE students
  SET coins = v_coins,
      shop_items = v_shop_items::text,
      equipped_items = v_equipped_items::text
  WHERE id = p_student_id;

  RETURN jsonb_build_object(
    'ok', true,
    'coinsAfter', v_coins,
    'shopItems', v_shop_items,
    'equippedItems', v_equipped_items
  );
END;
$body$;

GRANT EXECUTE ON FUNCTION buy_item(integer, integer, text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION buy_item(integer, integer, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION buy_item(integer, integer, text, integer, text) TO service_role;
