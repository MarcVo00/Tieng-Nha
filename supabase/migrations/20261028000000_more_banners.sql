set lock_timeout = '10s';

-- Two more gacha banners (more-banners spec 2026-10-27 §3, §4.2): seigneur_des_mers and esprits_de_la_nuit,
-- 12 items each (4 common, 4 rare, 3 epic, 1 legendary), appended to the catalogue. Nothing else changes: the draw,
-- prices, rates, pity (already per theme in user_stats.gacha_pity), refunds and the existing rows are those of
-- 20261025000000_gacha.sql. Never edit after it is applied to prod: add a new migration.
-- Deploy before the app: a 1.7 client ignores the themes and items it does not know.

-- Catalogue (must match src/content/shop.json). Same signature and return type as before, so a plain replace is
-- enough: shop_item(id), gacha_draw, gacha_pull and apply_event read it at call time and are unchanged. Grants are
-- kept by create or replace; they are restated below anyway.
create or replace function public.shop_items() returns table(id text, price int, kind text, slot text, currency text, theme text, rarity text)
language sql immutable set search_path = '' as $$
  select v.id, v.price, v.kind, v.slot, v.currency, v.theme, v.rarity from (values
    ('energy_refill', 30, 'consumable', null::text, 'xu', null::text, null::text),
    ('streak_freeze', 50, 'consumable', null::text, 'xu', null::text, null::text),
    ('frame_bronze', null::int, 'cosmetic', 'frame', 'xu', null::text, null::text),
    ('frame_jade', null::int, 'cosmetic', 'frame', 'xu', null::text, null::text),
    ('frame_son_mai', null::int, 'cosmetic', 'frame', 'xu', null::text, null::text),
    ('fx_ink', null::int, 'cosmetic', 'profile_fx', 'xu', null::text, null::text),
    ('fx_lightning', null::int, 'cosmetic', 'profile_fx', 'xu', null::text, null::text),
    ('fx_embers', null::int, 'cosmetic', 'profile_fx', 'xu', null::text, null::text),
    ('hat_thuy_tinh', null::int, 'cosmetic', 'hat', 'xu', 'legendes_sombres', 'rare'),
    ('aura_waves', null::int, 'cosmetic', 'aura', 'xu', 'legendes_sombres', 'rare'),
    ('outfit_son_tinh', null::int, 'cosmetic', 'outfit', 'xu', 'legendes_sombres', 'epic'),
    ('acc_thuan_thien', null::int, 'cosmetic', 'accessory', 'xu', 'legendes_sombres', 'epic'),
    ('char_kiem_khach', null::int, 'cosmetic', 'character', 'xu', 'legendes_sombres', 'epic'),
    ('char_phap_su', null::int, 'cosmetic', 'character', 'xu', 'legendes_sombres', 'legendary'),
    ('acc_giao_tre', null::int, 'cosmetic', 'accessory', 'xu', 'legendes_sombres', 'common'),
    ('hat_khan_vanh', null::int, 'cosmetic', 'hat', 'xu', 'legendes_sombres', 'common'),
    ('outfit_ao_chen', null::int, 'cosmetic', 'outfit', 'xu', 'legendes_sombres', 'common'),
    ('aura_suong_mu', null::int, 'cosmetic', 'aura', 'xu', 'legendes_sombres', 'common'),
    ('acc_quat_sat', null::int, 'cosmetic', 'accessory', 'xu', 'legendes_sombres', 'rare'),
    ('hat_mu_chien', null::int, 'cosmetic', 'hat', 'xu', 'legendes_sombres', 'rare'),
    ('hat_tay_son', 6, 'cosmetic', 'hat', 'kim_bai', 'arene', null::text),
    ('acc_con_vo', 8, 'cosmetic', 'accessory', 'kim_bai', 'arene', null::text),
    ('outfit_hoi_vat', 10, 'cosmetic', 'outfit', 'kim_bai', 'arene', null::text),
    ('acc_mai_cheo', null::int, 'cosmetic', 'accessory', 'xu', 'seigneur_des_mers', 'common'),
    ('hat_khan_song', null::int, 'cosmetic', 'hat', 'xu', 'seigneur_des_mers', 'common'),
    ('outfit_ao_luoi', null::int, 'cosmetic', 'outfit', 'xu', 'seigneur_des_mers', 'common'),
    ('aura_bot_bien', null::int, 'cosmetic', 'aura', 'xu', 'seigneur_des_mers', 'common'),
    ('acc_dinh_ba', null::int, 'cosmetic', 'accessory', 'xu', 'seigneur_des_mers', 'rare'),
    ('hat_vuong_mien_san_ho', null::int, 'cosmetic', 'hat', 'xu', 'seigneur_des_mers', 'rare'),
    ('outfit_ao_thuy_trieu', null::int, 'cosmetic', 'outfit', 'xu', 'seigneur_des_mers', 'rare'),
    ('aura_ngoc_trai', null::int, 'cosmetic', 'aura', 'xu', 'seigneur_des_mers', 'rare'),
    ('char_lac_long_quan', null::int, 'cosmetic', 'character', 'xu', 'seigneur_des_mers', 'epic'),
    ('outfit_giap_vay_rong', null::int, 'cosmetic', 'outfit', 'xu', 'seigneur_des_mers', 'epic'),
    ('hat_mu_rong', null::int, 'cosmetic', 'hat', 'xu', 'seigneur_des_mers', 'epic'),
    ('acc_kiem_rong', null::int, 'cosmetic', 'accessory', 'xu', 'seigneur_des_mers', 'legendary'),
    ('acc_long_den', null::int, 'cosmetic', 'accessory', 'xu', 'esprits_de_la_nuit', 'common'),
    ('hat_khan_den', null::int, 'cosmetic', 'hat', 'xu', 'esprits_de_la_nuit', 'common'),
    ('outfit_ao_dem', null::int, 'cosmetic', 'outfit', 'xu', 'esprits_de_la_nuit', 'common'),
    ('aura_dom_dom', null::int, 'cosmetic', 'aura', 'xu', 'esprits_de_la_nuit', 'common'),
    ('acc_quat_giay', null::int, 'cosmetic', 'accessory', 'xu', 'esprits_de_la_nuit', 'rare'),
    ('hat_tram_chuong', null::int, 'cosmetic', 'hat', 'xu', 'esprits_de_la_nuit', 'rare'),
    ('outfit_ao_khoi', null::int, 'cosmetic', 'outfit', 'xu', 'esprits_de_la_nuit', 'rare'),
    ('aura_khoi_huong', null::int, 'cosmetic', 'aura', 'xu', 'esprits_de_la_nuit', 'rare'),
    ('hat_mat_na_cao', null::int, 'cosmetic', 'hat', 'xu', 'esprits_de_la_nuit', 'epic'),
    ('aura_ma_troi', null::int, 'cosmetic', 'aura', 'xu', 'esprits_de_la_nuit', 'epic'),
    ('char_thay_phap', null::int, 'cosmetic', 'character', 'xu', 'esprits_de_la_nuit', 'epic'),
    ('char_ho_ly', null::int, 'cosmetic', 'character', 'xu', 'esprits_de_la_nuit', 'legendary')
  ) as v(id, price, kind, slot, currency, theme, rarity)
$$;

revoke execute on function public.shop_items() from public, anon, authenticated;
