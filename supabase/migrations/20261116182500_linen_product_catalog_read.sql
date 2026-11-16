-- The same product catalog backs the Enxoval evaluation forms and Rouparia.
alter policy access_role_read on public.laundry_products
  using ((select private.access_any_permission(array[
    'laundry.operations.view',
    'laundry.management.view',
    'laundry.dashboard.view',
    'laundry.registries.view',
    'laundry.inventory.view',
    'laundry.contracts.view',
    'textiles.inventory.view'
  ]::text[])));
