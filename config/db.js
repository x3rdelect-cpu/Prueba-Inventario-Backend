const { Sequelize } = require('sequelize');
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
module.exports=new Sequelize(process.env.DB_NAME,process.env.DB_USER,process.env.DB_PASSWORD??process.env.DB_PASS,{host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||3306),dialect:'mysql',logging:false});
