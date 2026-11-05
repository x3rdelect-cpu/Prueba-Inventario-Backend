// Pruebas de integración en una base temporal nueva, nunca sobre api_backend.
const assert=require('node:assert/strict');
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
const mysql=require('mysql2/promise');
async function main(){
const admin=await mysql.createConnection({host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD??process.env.DB_PASS});
const name='inventario_test_'+Date.now();let created=false,server,sequelize,checks=0;
try{
assert.match(name,/^inventario_test_\d+$/);await admin.query('CREATE DATABASE '+name);created=true;process.env.DB_NAME=name;
const models=require('../models');sequelize=models.sequelize;
await require('./migrate')();await require('./migrate')();
const userIndexes=await models.sequelize.getQueryInterface().showIndex('usuarios');
assert.ok(userIndexes.some(index=>index.unique&&index.fields?.some(field=>field.attribute==='email'||field.name==='email')));checks++;
server=await new Promise(resolve=>{const s=require('../app').listen(0,'127.0.0.1',()=>resolve(s));});
const base='http://127.0.0.1:'+server.address().port+'/api';
async function call(path,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=r.status===204?null:await r.json();assert.equal(r.status,status,method+' '+path+': '+JSON.stringify(data));checks++;return data;}
const cat=await call('/categorias','POST',{nombre:'Categoría prueba',descripcion:'Prueba aislada'},201);
const prov=await call('/proveedores','POST',{razon_social:'Proveedor prueba',email:'contacto@example.com'},201);
const user=await call('/usuarios','POST',{nombre:'Operador prueba',email:'operador@example.com',password:'Prueba-123456',rol:'Almacenero'},201);
assert.ok(!('password'in user));checks++;
const saved=await models.Usuario.findByPk(user.id);assert.ok(saved.password.startsWith('scrypt:'));checks++;
await call('/usuarios','POST',{nombre:'Duplicado',email:'operador@example.com',password:'Prueba-123456',rol:'Almacenero'},409);
const product=await call('/productos','POST',{nombre:'Producto prueba',precio:12.5,categoria_id:cat.id,proveedor_id:prov.id,stock:10,usuario_id:user.id},201);
assert.equal(product.stock,10);checks++;
await call('/categorias/'+cat.id,'DELETE',null,409);
await call('/proveedores/'+prov.id,'DELETE',null,409);
await call('/productos','POST',{nombre:'Sin categoría',precio:1,categoria_id:999999},400);
await call('/productos','POST',{nombre:'Precio negativo',precio:-1,categoria_id:cat.id},400);
const before=await models.Producto.count();
await call('/productos','POST',{nombre:'Rollback',precio:1,categoria_id:cat.id,stock:5,usuario_id:99999},400);
assert.equal(await models.Producto.count(),before);checks++;
const move=(tipo,cantidad,extra={})=>({producto_id:product.id,usuario_id:user.id,tipo_movimiento:tipo,cantidad,...extra});
await call('/movimientos','POST',move('Salida',30),400);
assert.equal((await models.Producto.findByPk(product.id)).stock,10);checks++;
await call('/movimientos','POST',move('Entrada',-1),400);
await call('/movimientos','POST',move('Entrada',1.5),400);
await call('/movimientos','POST',move('Otro',1),400);
await call('/movimientos','POST',move('Ajuste',0),400);
const salida=await call('/movimientos','POST',move('Salida',3),201);
await call('/movimientos','POST',move('Ajuste',-2),201);
assert.equal((await models.Producto.findByPk(product.id)).stock,5);checks++;
await call('/movimientos/'+salida.id+'/anular','POST',{usuario_id:user.id,observaciones:'Prueba de anulación'},201);
assert.equal((await models.Producto.findByPk(product.id)).stock,8);checks++;
await call('/movimientos/'+salida.id+'/anular','POST',{usuario_id:user.id,observaciones:'Duplicado'},400);
const reverse=await models.Movimiento.findOne({where:{reversa_de_id:salida.id}});
await call('/movimientos/'+reverse.id+'/anular','POST',{usuario_id:user.id,observaciones:'No permitido'},400);
await call('/usuarios/'+user.id+'/estado','PATCH',{activo:false});
await call('/movimientos','POST',move('Entrada',1),400);
await call('/usuarios/'+user.id+'/estado','PATCH',{activo:true});
const concurrent=await Promise.all([fetch(base+'/movimientos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(move('Salida',6))}),fetch(base+'/movimientos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(move('Salida',6))})]);
assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,400]);checks++;
assert.equal((await models.Producto.findByPk(product.id)).stock,2);checks++;
await call('/productos/'+product.id,'PUT',{nombre:'Editado',precio:'15.00',categoria_id:cat.id,proveedor_id:prov.id,stock:999},400);
await call('/productos/'+product.id,'PUT',{nombre:'Editado',precio:'15.00',categoria_id:cat.id,proveedor_id:prov.id});
await call('/productos/'+product.id,'DELETE',null,409);
await call('/usuarios/'+user.id,'PUT',{nombre:'Operador editado',email:'operador@example.com',rol:'Supervisor'});
const dash=await call('/dashboard');assert.equal(dash.total_productos,1);assert.equal(dash.valor_inventario,30);checks+=2;
await call('/productos');await call('/categorias');await call('/proveedores');await call('/usuarios');await call('/movimientos');await call('/health');
const temp=await call('/productos','POST',{nombre:'Se elimina',precio:1,categoria_id:cat.id},201);
await call('/productos/'+temp.id,'DELETE',null,204);
await call('/categorias/'+cat.id,'PUT',{nombre:'Actualizada',descripcion:'Nueva descripción'});
await call('/proveedores/'+prov.id,'PUT',{razon_social:'Actualizado',email:'cambio@example.com'});
await call('/productos/99999','DELETE',null,404);
console.log('OK: '+checks+' verificaciones de API, atomicidad, concurrencia, relaciones y validaciones.');
}finally{
if(server)await new Promise(resolve=>server.close(resolve));
if(sequelize)await sequelize.close();
if(created){assert.match(name,/^inventario_test_\d+$/);await admin.query('DROP DATABASE '+name);}
await admin.end();
}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
