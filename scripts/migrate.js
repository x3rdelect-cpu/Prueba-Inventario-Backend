// Migración aditiva: no elimina filas ni usa sync force/alter.
const {DataTypes:D}=require('sequelize');
const {sequelize}=require('../models');
async function migrate(){
await sequelize.authenticate();await sequelize.sync();
const q=sequelize.getQueryInterface();
const additions={
usuarios:{activo:{type:D.BOOLEAN,allowNull:false,defaultValue:true}},
productos:{proveedor_id:{type:D.INTEGER,allowNull:true,references:{model:'proveedores',key:'id'},onDelete:'RESTRICT',onUpdate:'CASCADE'}},
movimientos:{stock_anterior:{type:D.INTEGER,allowNull:true},stock_posterior:{type:D.INTEGER,allowNull:true},anulado:{type:D.BOOLEAN,allowNull:false,defaultValue:false},reversa_de_id:{type:D.INTEGER,allowNull:true,unique:true,references:{model:'movimientos',key:'id'},onDelete:'RESTRICT'}}
};
for(const [table,fields]of Object.entries(additions)){const existing=await q.describeTable(table);for(const [field,definition]of Object.entries(fields)){if(!existing[field])await q.addColumn(table,field,definition);}}
const indexes=await q.showIndex('usuarios');
const emailIsUnique=indexes.some(index=>index.unique&&index.fields?.some(field=>field.attribute==='email'||field.name==='email'));
if(!emailIsUnique){
const [duplicates]=await sequelize.query('SELECT email FROM usuarios GROUP BY email HAVING COUNT(*) > 1 LIMIT 1');
if(duplicates.length)throw new Error('No se puede crear el índice único: existen emails duplicados en usuarios.');
await q.addIndex('usuarios',['email'],{unique:true,name:'usuarios_email_unique'});
}
}
module.exports=migrate;
if(require.main===module)migrate().then(()=>console.log('Migración completada sin eliminar datos.')).finally(()=>sequelize.close()).catch(e=>{console.error(e.message);process.exitCode=1;});
