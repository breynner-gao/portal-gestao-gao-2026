-- Compare new requests with the outstanding quantity of active service orders.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.fabric_create_orders_for_demand(uuid,date,jsonb,text)'::regprocedure);
 if position('coalesce(ret.rejected, 0)' in definition)>0 then return;end if;
 if position('select coalesce(sum(i.ordered_pieces), 0)::integer' in definition)=0 or position('select sum(fr.accepted_pieces)::integer as accepted' in definition)=0 then raise exception 'Inspect current demand coverage function before upgrading';end if;
 definition:=replace(definition,'select coalesce(sum(i.ordered_pieces), 0)::integer','select coalesce(sum(greatest(0, i.ordered_pieces - coalesce(ret.accepted, 0) - coalesce(ret.rejected, 0))), 0)::integer');
 definition:=replace(definition,'select sum(fr.accepted_pieces)::integer as accepted','select sum(fr.accepted_pieces)::integer as accepted, sum(fr.rejected_pieces)::integer as rejected');
 execute definition;
end $migration$;
