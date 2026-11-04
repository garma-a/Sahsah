\set ON_ERROR_STOP on
\if :{?gift_discount_bps}
\else
  DO $$ BEGIN
    RAISE EXCEPTION 'Supply an explicitly approved gift_discount_bps integer (0..10000).'
      USING ERRCODE = '22023';
  END $$;
\endif

-- Opt-in reference setup, never run by migrations or API startup.
-- Price (100 EGP), currency and 1/2/5 selectors use approved schema defaults.
-- A duplicate singleton fails; changing live pricing needs its audited service.
BEGIN;
INSERT INTO public.shop_settings (id, gift_discount_bps)
VALUES (1, :'gift_discount_bps'::smallint);
COMMIT;
