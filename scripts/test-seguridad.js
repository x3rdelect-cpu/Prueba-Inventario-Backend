const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const path = require('node:path');
const mysql = require('mysql2/promise');

require('dotenv').config({
  path: path.join(__dirname, '../.env'),
  quiet: true,
});

const scrypt = promisify(crypto.scrypt);

async function main() {
  // Nombre generado por el script; nunca utiliza api_backend.
  const baseTemporal =
    'inventario_test_' +
    Date.now() +
    '_' +
    crypto.randomBytes(4).toString('hex');

  const patronTemporal = /^inventario_test_\d+_[a-f0-9]{8}$/;

  let conexion;
  let sequelize;
  let servidor;
  let creada = false;
  let comprobaciones = 0;

  try {
    assert.match(baseTemporal, patronTemporal);

    conexion = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD ?? process.env.DB_PASS,
    });

    await conexion.query(`CREATE DATABASE \`${baseTemporal}\``);
    creada = true;

    // Se configura ANTES de importar los modelos.
    process.env.DB_NAME = baseTemporal;
    process.env.NODE_ENV = 'development';

    // Secreto exclusivo de esta ejecución; no se imprime ni se guarda.
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    process.env.JWT_EXPIRES_IN = '2h';

    const models = require('../models');
    sequelize = models.sequelize;

    assert.equal(sequelize.config.database, baseTemporal);

    // Se crean las tablas únicamente en la base temporal.
    await require('./migrate')();

    const [[baseActual]] = await sequelize.query(
      'SELECT DATABASE() AS nombre'
    );

    assert.equal(baseActual.nombre, baseTemporal);

    // Usuarios exclusivos de prueba.
    const passwordTemporal = crypto.randomBytes(24).toString('hex');

    async function crearUsuario(rol) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = await scrypt(passwordTemporal, salt, 64);

      return models.Usuario.create({
        nombre: `Prueba ${rol}`,
        email: `${rol.toLowerCase()}@example.com`,
        password: `scrypt:${salt}:${hash.toString('hex')}`,
        rol,
        activo: true,
      });
    }

    const administrador = await crearUsuario('Administrador');
    const almacenero = await crearUsuario('Almacenero');
    const supervisor = await crearUsuario('Supervisor');

    servidor = await new Promise((resolve, reject) => {
      const instancia = require('../app').listen(0, '127.0.0.1');

      instancia.once('listening', () => resolve(instancia));
      instancia.once('error', reject);
    });

    const baseURL =
      `http://127.0.0.1:${servidor.address().port}/api`;

    async function solicitar(
      ruta,
      {
        metodo = 'GET',
        datos,
        token,
        esperado = 200,
      } = {}
    ) {
      const headers = {};

      if (datos !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const respuesta = await fetch(baseURL + ruta, {
        method: metodo,
        headers,
        body:
          datos === undefined
            ? undefined
            : JSON.stringify(datos),
      });

      const texto = await respuesta.text();
      if (respuesta.status !== esperado && respuesta.status >= 400) {
  try {
    const detalle = JSON.parse(texto);

    console.error(
      'Validación del backend:',
      detalle.error || 'Sin mensaje de validación'
    );
  } catch {
    console.error('El backend devolvió un error sin formato JSON.');
  }
}

      // No se imprime la respuesta para evitar exponer tokens.
      assert.equal(
        respuesta.status,
        esperado,
        `${metodo} ${ruta}: esperado ${esperado}, recibido ${respuesta.status}`
      );

      comprobaciones++;

      return texto ? JSON.parse(texto) : null;
    }

    async function login(usuario) {
      const resultado = await solicitar('/auth/login', {
        metodo: 'POST',
        datos: {
          email: usuario.email,
          password: passwordTemporal,
        },
      });

      assert.equal(typeof resultado.token, 'string');
      assert.ok(resultado.token.length > 0);
      assert.equal(resultado.usuario.id, usuario.id);

      comprobaciones += 3;

      return resultado.token;
    }

    const tokenAdmin = await login(administrador);
    const tokenAlmacenero = await login(almacenero);
    const tokenSupervisor = await login(supervisor);

    // Rutas de consulta: deben exigir autenticación.
    const rutasConsulta = [
      '/productos',
      '/categorias',
      '/proveedores',
      '/movimientos',
      '/dashboard',
    ];

    for (const ruta of rutasConsulta) {
      await solicitar(ruta, { esperado: 401 });

      for (const token of [
        tokenAdmin,
        tokenAlmacenero,
        tokenSupervisor,
      ]) {
        await solicitar(ruta, { token });
      }
    }

    // Usuarios: solamente Administrador.
    await solicitar('/usuarios', { esperado: 401 });
    await solicitar('/usuarios', { token: tokenAdmin });

    await solicitar('/usuarios', {
      token: tokenAlmacenero,
      esperado: 403,
    });

    await solicitar('/usuarios', {
      token: tokenSupervisor,
      esperado: 403,
    });

    // Token inválido.
    await solicitar('/productos', {
      token: 'token-invalido-prueba',
      esperado: 401,
    });

    // Crear referencias con Administrador.
    const categoria = await solicitar('/categorias', {
      metodo: 'POST',
      token: tokenAdmin,
      datos: { nombre: 'Categoría temporal' },
      esperado: 201,
    });

    const proveedor = await solicitar('/proveedores', {
      metodo: 'POST',
      token: tokenAdmin,
      datos: { razon_social: 'Proveedor temporal' },
      esperado: 201,
    });

    // Otros roles no pueden crear categorías.
    for (const token of [tokenAlmacenero, tokenSupervisor]) {
      await solicitar('/categorias', {
        metodo: 'POST',
        token,
        datos: { nombre: 'No permitido' },
        esperado: 403,
      });
    }

    // Intento de atribuir el stock inicial a otro usuario.
    const producto = await solicitar('/productos', {
      metodo: 'POST',
      token: tokenAlmacenero,
      datos: {
        nombre: 'Producto temporal',
        precio: 10,
        stock: 5,
        categoria_id: categoria.id,
        proveedor_id: proveedor.id,
        usuario_id: administrador.id,
      },
      esperado: 201,
    });

    assert.equal(producto.stock, 5);
    comprobaciones++;

    const entradaInicial = await models.Movimiento.findOne({
      where: { producto_id: producto.id },
    });

    assert.ok(entradaInicial);
    assert.equal(entradaInicial.usuario_id, almacenero.id);
    assert.equal(entradaInicial.stock_anterior, 0);
    assert.equal(entradaInicial.stock_posterior, 5);
    comprobaciones += 4;

    // Supervisor no puede crear productos.
    await solicitar('/productos', {
      metodo: 'POST',
      token: tokenSupervisor,
      datos: {
        nombre: 'No permitido',
        precio: 1,
        categoria_id: categoria.id,
      },
      esperado: 403,
    });

    // Almacenero no puede eliminar productos.
    await solicitar(`/productos/${producto.id}`, {
      metodo: 'DELETE',
      token: tokenAlmacenero,
      esperado: 403,
    });

    // El stock no puede cambiarse mediante edición del producto.
    await solicitar(`/productos/${producto.id}`, {
      metodo: 'PUT',
      token: tokenAlmacenero,
      datos: {
        nombre: 'Producto temporal',
        precio: 10,
        categoria_id: categoria.id,
        proveedor_id: proveedor.id,
        stock: 999,
      },
      esperado: 400,
    });

    // Movimiento: también debe ignorar el usuario enviado.
    const movimiento = await solicitar('/movimientos', {
      metodo: 'POST',
      token: tokenAlmacenero,
      datos: {
        producto_id: producto.id,
        tipo_movimiento: 'Entrada',
        cantidad: 1,
        usuario_id: administrador.id,
      },
      esperado: 201,
    });

    assert.equal(movimiento.usuario_id, almacenero.id);
    comprobaciones++;

    // Supervisor no puede registrar movimientos.
    await solicitar('/movimientos', {
      metodo: 'POST',
      token: tokenSupervisor,
      datos: {
        producto_id: producto.id,
        tipo_movimiento: 'Entrada',
        cantidad: 1,
      },
      esperado: 403,
    });

    // Almacenero no puede anular.
    await solicitar(`/movimientos/${movimiento.id}/anular`, {
      metodo: 'POST',
      token: tokenAlmacenero,
      datos: { observaciones: 'Prueba temporal' },
      esperado: 403,
    });

    // Administrador anula con su identidad autenticada.
    const compensacion = await solicitar(
      `/movimientos/${movimiento.id}/anular`,
      {
        metodo: 'POST',
        token: tokenAdmin,
        datos: {
          observaciones: 'Prueba temporal',
          usuario_id: supervisor.id,
        },
        esperado: 201,
      }
    );

    assert.equal(compensacion.usuario_id, administrador.id);
    assert.equal(compensacion.reversa_de_id, movimiento.id);
    comprobaciones += 2;

    const productoFinal = await models.Producto.findByPk(producto.id);
    const movimientoFinal = await models.Movimiento.findByPk(
      movimiento.id
    );

    assert.equal(productoFinal.stock, 5);
    assert.equal(movimientoFinal.anulado, true);
    comprobaciones += 2;

    // Un usuario desactivado pierde acceso con el mismo JWT.
    await supervisor.update({ activo: false });

    await solicitar('/productos', {
      token: tokenSupervisor,
      esperado: 401,
    });

    console.log(
      `OK: ${comprobaciones} comprobaciones de autenticación, roles y Kardex.`
    );
  } finally {
    try {
      if (servidor) {
        await new Promise((resolve, reject) => {
          servidor.close((error) =>
            error ? reject(error) : resolve()
          );
        });
      }
    } finally {
      try {
        if (sequelize) await sequelize.close();
      } finally {
        if (conexion) {
          try {
            if (creada) {
              // Solo elimina la base generada por esta ejecución.
              assert.match(baseTemporal, patronTemporal);
              assert.notEqual(baseTemporal, 'api_backend');

              await conexion.query(
                `DROP DATABASE \`${baseTemporal}\``
              );

              console.log('Base temporal eliminada.');
            }
          } finally {
            await conexion.end();
          }
        }
      }
    }
  }
}

main().catch((error) => {
  // No imprimir objetos de conexión ni respuestas con JWT.
  if (error.code === 'ERR_ASSERTION') {
    console.error('Prueba fallida:', error.message);
  } else {
    console.error(
      'No se completaron las pruebas. Código:',
      error.code || error.name
    );
  }

  process.exitCode = 1;
});