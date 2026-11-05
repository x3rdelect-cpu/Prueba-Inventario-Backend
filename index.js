const app=require('./app'),migrate=require('./scripts/migrate');
const {sequelize}=require('./models');
async function start(){await migrate();const port=Number(process.env.PORT||3006);const server=app.listen(port,'127.0.0.1',()=>console.log('MySQL conectado. API en http://localhost:'+port+'/api/health'));server.on('error',e=>{console.error(e.message);process.exitCode=1;sequelize.close();});return server;}
module.exports=start;
if(require.main===module)start().catch(e=>{console.error('No se pudo iniciar:',e.message);process.exitCode=1;sequelize.close();});
