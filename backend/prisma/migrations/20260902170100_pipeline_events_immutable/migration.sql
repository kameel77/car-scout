CREATE OR REPLACE FUNCTION pipeline_events_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'pipeline_events is append-only: DELETE is not permitted';
  END IF;

  IF (to_jsonb(NEW) - 'dispatched_at') IS DISTINCT FROM (to_jsonb(OLD) - 'dispatched_at') THEN
    RAISE EXCEPTION 'pipeline_events is append-only: only dispatched_at may be updated';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pipeline_events_guard_trg
  BEFORE UPDATE OR DELETE ON pipeline_events
  FOR EACH ROW EXECUTE FUNCTION pipeline_events_guard();
