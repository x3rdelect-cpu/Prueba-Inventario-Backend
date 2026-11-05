const express=require('express'),cors=require('cors'),crypto=require('node:crypto');
const {promisify}=require('node:util');
const {sequelize,Categoria,Proveedor,Usuario,Producto,Movimiento}=require('./models');
const {fail,entero,registrar,anular}=require('./services/inventario');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const app=express();
const authRoutes = require('./routes/authRoutes');
const autenticar = require('./middleware/authMiddleware');

app.use(helmet());

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'development' ? 1000 : 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes. Intenta nuevamente más tarde.'
  }
});

app.use('/api', limitador);

app.use(express.json({limit:'100kb'}));
app.use('/api/auth', authRoutes);
app.get('/api/auth/verificar', autenticar(), (req, res) => {
  res.json({
    mensaje: 'Token válido. Acceso autorizado.',
    usuario: req.usuario
  });
});
app.get(
  '/api/auth/solo-admin',
  autenticar(['Administrador']),
  (req, res) => {
    res.json({
      mensaje: 'Acceso permitido: Administrador.',
      usuario: req.usuario
    });
  }
);
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const safe=u=>{const d=u.toJSON?u.toJSON():{...u};delete d.password;return d;};
const relations=[{model:Categoria,as:'categoria'},{model:Proveedor,as:'proveedor'}];
const moveRelations=[{model:Producto,as:'producto'},{model:Usuario,as:'usuario',attributes:['id','nombre','rol']}];
function required(value,name){if(typeof value!=='string'||!value.trim()||value.trim().length>255)fail(name+' es obligatorio (hasta 255 caracteres).');return value.trim();}
function email(value,mandatory=false){const v=String(value||'').trim();if((mandatory||v)&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)||v.length>255))fail('Correo electrónico inválido.');return v;}
async function find(Model,id){const item=await Model.findByPk(entero(id,'ID',1));if(!item)fail('Registro no encontrado.',404);return item;}

 // LABORATORIO 10
// Protección de categorías y proveedores

const protegerCatalogo = (req, res, next) => {
  const rolesPermitidos = req.method === 'GET'
    ? ['Administrador', 'Almacenero', 'Supervisor']
    : ['Administrador'];

  return autenticar(rolesPermitidos)(req, res, next);
};

app.use(
  ['/api/categorias', '/api/proveedores'],
  protegerCatalogo
);
// LABORATORIO 10 - PROTECCIÓN DE USUARIOS
app.use(
  '/api/usuarios',
  autenticar(['Administrador'])
);

 // LABORATORIO 10 - PROTECCIÓN DE KARDEX

const protegerKardex = (req, res, next) => {
  let rolesPermitidos;

  if (req.method === 'GET') {
    rolesPermitidos = [
      'Administrador',
      'Almacenero',
      'Supervisor'
    ];
  } else if (
    req.method === 'POST' &&
    /^\/\d+\/anular\/?$/.test(req.path)
  ) {
    rolesPermitidos = ['Administrador'];
  } else if (req.method === 'POST' && req.path === '/') {
    rolesPermitidos = [
      'Administrador',
      'Almacenero'
    ];
  } else {
    return res.status(405).json({
      error: 'Operación no permitida.'
    });
  }

  return autenticar(rolesPermitidos)(req, res, next);
};

app.use('/api/movimientos', protegerKardex);

app.get('/api/health',wrap(async(_req,res)=>{await sequelize.authenticate();res.json({estado:'ok',base_datos:'conectada'});}));
for(const [path,Model,fields,label]of [['categorias',Categoria,['nombre','descripcion'],'Nombre'],['proveedores',Proveedor,['razon_social','contacto','telefono','email'],'Razón social']]){
app.get('/api/'+path,wrap(async(_req,res)=>{
const rows=await Model.findAll({order:[['id','DESC']]});
const key=path==='categorias'?'categoria_id':'proveedor_id',products=await Producto.findAll({attributes:[key]});
res.json(rows.map(row=>({...row.toJSON(),cantidad_productos:products.filter(p=>p[key]===row.id).length})));}));
for(const method of ['post','put'])app[method]('/api/'+path+(method==='put'?'/:id':''),wrap(async(req,res)=>{
const data=Object.fromEntries(fields.map(k=>[k,req.body[k]??'']));
data[fields[0]]=required(data[fields[0]],label);if(path==='proveedores')data.email=email(data.email);
const row=method==='post'?await Model.create(data):await(await find(Model,req.params.id)).update(data);
res.status(method==='post'?201:200).json(row);}));
app.delete('/api/'+path+'/:id',wrap(async(req,res)=>{
await sequelize.transaction(async t=>{
const row=await Model.findByPk(entero(req.params.id,'ID',1),{transaction:t,lock:t.LOCK.UPDATE});if(!row)fail('Registro no encontrado.',404);
const key=path==='categorias'?'categoria_id':'proveedor_id';
if(await Producto.count({where:{[key]:row.id},transaction:t}))fail('Tiene productos asociados. Reasígnalos antes de eliminar.',409);
await row.destroy({transaction:t});});res.status(204).end();}));}
app.get('/api/productos',
  autenticar(['Administrador', 'Almacenero', 'Supervisor']),
  wrap(async(_req,res)=>
    res.json(await Producto.findAll({
      include: relations,
      order: [['id','DESC']]
    }))
  )
);
for (const method of ['post', 'put']) app[method](
  '/api/productos' + (method === 'put' ? '/:id' : ''),
  autenticar(['Administrador', 'Almacenero']),
  wrap(async(req, res) => {
const b=req.body,data={nombre:required(b.nombre,'Nombre'),descripcion:String(b.descripcion||''),categoria_id:entero(b.categoria_id,'Categoría',1),proveedor_id:b.proveedor_id?entero(b.proveedor_id,'Proveedor',1):null};
if(b.precio===''||b.precio==null||!Number.isFinite(Number(b.precio))||Number(b.precio)<0||Number(b.precio)>99999999.99||!/^\d+(\.\d{1,2})?$/.test(String(b.precio)))fail('Precio inválido. Usa hasta dos decimales y un importe no negativo.');
data.precio=Number(b.precio).toFixed(2);
let row;
await sequelize.transaction(async t=>{
if(!await Categoria.findByPk(data.categoria_id,{transaction:t,lock:t.LOCK.SHARE}))fail('La categoría seleccionada no existe.');
if(data.proveedor_id&&!await Proveedor.findByPk(data.proveedor_id,{transaction:t,lock:t.LOCK.SHARE}))fail('El proveedor seleccionado no existe.');
if(method==='put'){
row=await Producto.findByPk(entero(req.params.id,'ID',1),{transaction:t,lock:t.LOCK.UPDATE});if(!row)fail('Producto no encontrado.',404);
if(b.stock!=null&&Number(b.stock)!==row.stock)fail('Modifica el stock desde Kardex para conservar el historial.');
await row.update(data,{transaction:t});
}else{
const stock=b.stock==null||b.stock===''?0:entero(b.stock,'Stock inicial',0);
row=await Producto.create({...data,stock:0},{transaction:t});
if (stock) {
  await registrar({
    producto_id: row.id,
    usuario_id: req.usuario.id,
    tipo_movimiento: 'Entrada',
    cantidad: stock,
    observaciones: 'Stock inicial del producto',
  }, t);
}
}});
res.status(method==='post'?201:200).json(await Producto.findByPk(row.id,{include:relations}));}));
app.delete(
  '/api/productos/:id',
  autenticar(['Administrador']),
  wrap(async(req,res)=>{
await sequelize.transaction(async t=>{
const row=await Producto.findByPk(entero(req.params.id,'ID',1),{transaction:t,lock:t.LOCK.UPDATE});if(!row)fail('Producto no encontrado.',404);
if(await Movimiento.count({where:{producto_id:row.id},transaction:t}))fail('El producto tiene historial en Kardex y no puede eliminarse.',409);
if(row.stock!==0)fail('El stock debe ser cero para eliminar el producto.',409);
await row.destroy({transaction:t});});res.status(204).end();}));
app.get('/api/usuarios',wrap(async(_req,res)=>res.json((await Usuario.findAll({attributes:{exclude:['password']},order:[['id','DESC']]})).map(safe))));
for(const method of ['post','put'])app[method]('/api/usuarios'+(method==='put'?'/:id':''),wrap(async(req,res)=>{
const b=req.body,data={nombre:required(b.nombre,'Nombre'),email:email(b.email,true),rol:b.rol};
if(!['Administrador','Almacenero','Supervisor'].includes(data.rol))fail('Rol inválido.');
if(method==='post'||b.password){
if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)fail('La contraseña debe tener entre 8 y 128 caracteres.');
const salt=crypto.randomBytes(16).toString('hex'),hash=await promisify(crypto.scrypt)(b.password,salt,64);
data.password='scrypt:'+salt+':'+hash.toString('hex');}
const user=method==='post'?await Usuario.create(data):await(await find(Usuario,req.params.id)).update(data);
res.status(method==='post'?201:200).json(safe(user));}));
app.patch('/api/usuarios/:id/estado',wrap(async(req,res)=>{
if(typeof req.body.activo!=='boolean')fail('El estado debe ser verdadero o falso.');
const row=await find(Usuario,req.params.id);await row.update({activo:req.body.activo});res.json(safe(row));}));

 // Consultar movimientos del Kardex
app.get('/api/movimientos', wrap(async (_req, res) => {
  const movimientos = await Movimiento.findAll({
    include: moveRelations,
    order: [['createdAt', 'DESC'], ['id', 'DESC']]
  });

  res.json(movimientos);
}));

// Registrar movimientos con identidad autenticada
app.post('/api/movimientos', wrap(async (req, res) => {
  const datos = {
    ...req.body,
    usuario_id: req.usuario.id
  };

  const movimiento = await sequelize.transaction(
    t => registrar(datos, t)
  );

  res.status(201).json(movimiento);
}));


app.post('/api/movimientos/:id/anular', wrap(async (req, res) => {
  const datos = {
    ...req.body,
    usuario_id: req.usuario.id
  };

  const movimiento = await sequelize.transaction(
    t => anular(
      entero(req.params.id, 'ID', 1),
      datos,
      t
    )
  );

  res.status(201).json(movimiento);
}));

app.get('/api/dashboard',
  autenticar(['Administrador', 'Almacenero', 'Supervisor']),
  wrap(async(_req,res)=>{
const productos=await Producto.findAll({include:[{model:Categoria,as:'categoria'}]}),grupos={};
for(const p of productos){const n=p.categoria?.nombre||'Sin categoría';grupos[n]=(grupos[n]||0)+p.stock;}
res.json({total_productos:productos.length,total_categorias:await Categoria.count(),total_proveedores:await Proveedor.count(),bajo_stock:productos.filter(p=>p.stock<=5),valor_inventario:productos.reduce((s,p)=>s+Number(p.precio)*p.stock,0),
movimientos:await Movimiento.findAll({limit:5,include:moveRelations,order:[['createdAt','DESC'],['id','DESC']]}),
stock_por_categoria:Object.entries(grupos).map(([nombre,stock])=>({nombre,stock}))});}));
app.use((_req,res)=>res.status(404).json({error:'Ruta no encontrada.'}));
app.use((err,_req,res,_next)=>{
if(err.name==='SequelizeUniqueConstraintError')return res.status(409).json({error:'Ya existe un registro con ese valor único (por ejemplo, email).'});
if(err.name==='SequelizeForeignKeyConstraintError')return res.status(409).json({error:'El registro está relacionado con otros datos. Revisa sus asociaciones.'});
if(err.type==='entity.parse.failed')return res.status(400).json({error:'El cuerpo JSON es inválido.'});
if(!err.status)console.error(err.message);
res.status(err.status||500).json({error:err.status?err.message:'Error interno. Revisa la terminal del servidor.'});});
module.exports=app;
