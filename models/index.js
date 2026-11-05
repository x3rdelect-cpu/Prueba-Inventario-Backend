const {DataTypes:D}=require('sequelize');
const sequelize=require('../config/db');
const define=(name,tableName,fields)=>sequelize.define(name,{id:{type:D.INTEGER,primaryKey:true,autoIncrement:true},...fields},{tableName,timestamps:true});
// Sequelize normaliza y muta cada definición de atributo. Debe recibir un
// objeto nuevo por campo para evitar que, por ejemplo, email termine apuntando
// físicamente a la columna nombre.
const required=()=>({type:D.STRING,allowNull:false});
const Categoria=define('Categoria','categorias',{nombre:required(),descripcion:D.TEXT});
const Proveedor=define('Proveedor','proveedores',{razon_social:required(),contacto:D.STRING,telefono:D.STRING,email:D.STRING});
const Usuario=define('Usuario','usuarios',{nombre:required(),email:{...required(),unique:true},password:required(),rol:{type:D.STRING,defaultValue:'Almacenero'},activo:{type:D.BOOLEAN,allowNull:false,defaultValue:true}});
const Producto=define('Producto','productos',{nombre:required(),descripcion:D.TEXT,precio:{type:D.DECIMAL(10,2),allowNull:false},stock:{type:D.INTEGER,allowNull:false,defaultValue:0}});
const Movimiento=define('Movimiento','movimientos',{tipo_movimiento:{type:D.ENUM('Entrada','Salida','Ajuste'),allowNull:false},cantidad:{type:D.INTEGER,allowNull:false},observaciones:D.TEXT,stock_anterior:D.INTEGER,stock_posterior:D.INTEGER,anulado:{type:D.BOOLEAN,allowNull:false,defaultValue:false},reversa_de_id:{type:D.INTEGER,allowNull:true,unique:true}});
Categoria.hasMany(Producto,{foreignKey:'categoria_id',as:'productos'});
Producto.belongsTo(Categoria,{foreignKey:'categoria_id',as:'categoria'});
Proveedor.hasMany(Producto,{foreignKey:'proveedor_id',as:'productos',onDelete:'RESTRICT'});
Producto.belongsTo(Proveedor,{foreignKey:'proveedor_id',as:'proveedor',onDelete:'RESTRICT'});
Producto.hasMany(Movimiento,{foreignKey:'producto_id',as:'movimientos',onDelete:'RESTRICT'});
Movimiento.belongsTo(Producto,{foreignKey:'producto_id',as:'producto',onDelete:'RESTRICT'});
Usuario.hasMany(Movimiento,{foreignKey:'usuario_id',as:'movimientos',onDelete:'RESTRICT'});
Movimiento.belongsTo(Usuario,{foreignKey:'usuario_id',as:'usuario',onDelete:'RESTRICT'});
Movimiento.belongsTo(Movimiento,{foreignKey:'reversa_de_id',as:'original',onDelete:'RESTRICT'});
module.exports={sequelize,Categoria,Proveedor,Usuario,Producto,Movimiento};
