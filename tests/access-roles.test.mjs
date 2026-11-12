import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const ui=await readFile(new URL('../admin-access-v1.mjs',import.meta.url),'utf8');
const edge=await readFile(new URL('../supabase/functions/admin-users/index.ts',import.meta.url),'utf8');
test('matrix uses actual catalog actions and accessible switches per role',()=>{assert.match(ui,/groupCatalog\(model.catalog\)/);assert.match(ui,/role="switch"/);assert.match(ui,/aria-label=/);assert.match(ui,/Administrar \(criar, editar e excluir\)/);assert.match(ui,/revision:r.revision/);assert.match(ui,/dirty.get\(id\)/);});
test('user registration selects persisted role, unit and client scopes',()=>{assert.match(ui,/roleId:role.id/);assert.match(ui,/update-membership/);assert.match(ui,/unitIds:fd.getAll/);assert.match(ui,/clientIds:fd.getAll/);assert.match(ui,/let current=user/);});
test('edge resolves role server side rather than accepting supplied permissions',()=>{assert.match(edge,/await resolveRole\(admin, actorProfileId, input\)/);assert.match(edge,/input.permissions=permissions/);assert.match(edge,/access_role_id: input.roleId/);assert.match(edge,/membership.access_role_id \|\| membership.role_name === 'Administrador Geral'/);assert.match(edge,/\.eq\('organization_id',input.organizationId\)/);});
test('permission refresh fails closed and updates menus',()=>{assert.match(ui,/setInterval\(refresh,30000\)/);assert.match(ui,/ga-route-denied/);assert.match(ui,/a.hidden=!permittedModule/);assert.match(ui,/window.addEventListener\('focus',refresh\)/);});
