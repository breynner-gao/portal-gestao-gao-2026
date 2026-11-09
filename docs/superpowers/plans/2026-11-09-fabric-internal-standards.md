# Fabric internal standards implementation plan

Goal: separate GAO specifications from supplier references, keep invoice/lot costs and prevent purchasing the wrong supplier code.
Architecture: internal standards table; existing catalog rows remain commercial references and retain all foreign keys. Each reference gains an internal standard and supplier. Migrate each current reference into its own provisional standard; do not infer cross-supplier equivalence or missing technical specifications.

- [x] Add tenant-scoped standards, reference mapping, audit and compatibility checks for approved equivalents. Preserve all original IDs, receipts and costs.
- [x] Seed known existing references and suppliers from receipt provenance; assign corporate codes and technical data already available; flag missing gram weight.
- [x] Add standard create/edit and supplier mapping; use corporate labels for recipes and stock planning; purchase selects corporate standard then the chosen supplier's approved reference.
- [x] Validate supplier/reference in browser and database; preserve supplier codes and per-lot costs in order/receipt trace.
- [x] Test grouping, cross-supplier protection, missing links and legacy selections; verify migrated counts and unchanged balances; publish and check deployment.

Review focus: never merge by color alone; Q1/Q2 and technical differences remain distinct; inactive/unapproved references cannot enter new orders; original lot costs remain source of actual cost; migration contains no private operational records.
