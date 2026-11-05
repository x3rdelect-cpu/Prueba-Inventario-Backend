const {Producto,Usuario,Movimiento}=require('../models');
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
function entero(value,label,min=-2147483647){
if(value===''||value==null||!Number.isInteger(Number(value))||Number(value)<min||Number(value)>2147483647)fail(label+' debe ser un entero válido (mínimo '+min+').');
return Number(value);}
async function operador(id,t){const u=await Usuario.findByPk(entero(id,'Usuario',1),{transaction:t,lock:t.LOCK.UPDATE});if(!u||!u.activo)fail('Selecciona un usuario activo.');}
async function registrar(b,t){
const producto=await Producto.findByPk(entero(b.producto_id,'Producto',1),{transaction:t,lock:t.LOCK.UPDATE});
if(!producto)fail('Producto no encontrado.',404);
await operador(b.usuario_id,t);
const tipo=b.tipo_movimiento,cantidad=entero(b.cantidad,'Cantidad');
if(!['Entrada','Salida','Ajuste'].includes(tipo))fail('Tipo de movimiento inválido.');
if(cantidad===0||(tipo!=='Ajuste'&&cantidad<1))fail('Entrada y salida requieren una cantidad positiva; un ajuste admite diferencias positivas o negativas distintas de cero.');
const delta=tipo==='Salida'?-cantidad:cantidad;
if(producto.stock+delta<0)fail('Stock insuficiente.');
const stock=entero(producto.stock+delta,'Stock resultante',0);
const movimiento=await Movimiento.create({producto_id:producto.id,usuario_id:Number(b.usuario_id),tipo_movimiento:tipo,cantidad,observaciones:String(b.observaciones||'').slice(0,5000),stock_anterior:producto.stock,stock_posterior:stock},{transaction:t});
await producto.update({stock},{transaction:t});return movimiento;}
async function anular(id,b,t){
const previo=await Movimiento.findByPk(id,{transaction:t});if(!previo)fail('Movimiento no encontrado.',404);
const producto=await Producto.findByPk(previo.producto_id,{transaction:t,lock:t.LOCK.UPDATE});
const m=await Movimiento.findByPk(id,{transaction:t,lock:t.LOCK.UPDATE});
if(m.anulado||m.reversa_de_id)fail('El movimiento ya está anulado o es una compensación.');
if(m.stock_anterior==null||m.stock_posterior==null)fail('El registro histórico no tiene saldos para anularlo con seguridad.');
await operador(b.usuario_id,t);
const motivo=String(b.observaciones||'').trim();if(!motivo)fail('Indica el motivo de anulación.');
const delta=m.stock_anterior-m.stock_posterior;
if(producto.stock+delta<0)fail('No se puede anular: el stock resultante sería negativo.');
const stock=entero(producto.stock+delta,'Stock resultante',0);
const reversa=await Movimiento.create({producto_id:producto.id,usuario_id:Number(b.usuario_id),tipo_movimiento:'Ajuste',cantidad:delta,stock_anterior:producto.stock,stock_posterior:stock,observaciones:'Anulación #'+m.id+': '+motivo.slice(0,4900),reversa_de_id:m.id},{transaction:t});
await producto.update({stock},{transaction:t});await m.update({anulado:true},{transaction:t});return reversa;}
module.exports={fail,entero,registrar,anular};
