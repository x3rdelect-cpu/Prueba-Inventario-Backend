const crypto = require('node:crypto');
const { promisify } = require('node:util');
const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const path = require('node:path');

require('dotenv').config({
  path: path.join(__dirname, '../.env'),
  quiet: true,
});

const { sequelize, Usuario } = require('../models');
const scrypt = promisify(crypto.scrypt);

async function main() {
  let interfaz;
  let ocultar = false;

  try {
    await sequelize.authenticate();

    const existente = await Usuario.findOne({
      where: {
        rol: 'Administrador',
        activo: true,
      },
    });

    if (existente) {
      console.log(
        'Ya existe un Administrador activo. No se modificó ningún usuario.'
      );
      return;
    }

    if (!process.stdin.isTTY) {
      throw new Error(
        'Usa una terminal interactiva. En Git Bash prueba: ' +
        'winpty node scripts/crear-admin.js'
      );
    }

    const salida = new Writable({
      write(chunk, encoding, callback) {
        if (!ocultar) process.stdout.write(chunk, encoding);
        callback();
      },
    });

    interfaz = readline.createInterface({
      input: process.stdin,
      output: salida,
      terminal: true,
    });

    console.log('Alta inicial de Administrador.');
    console.log('Base configurada:', sequelize.config.database);

    const confirmacion = await interfaz.question(
      '¿Crear el primer Administrador en esta base? Escribe CREAR: '
    );

    if (confirmacion.trim() !== 'CREAR') {
      console.log('Operación cancelada.');
      return;
    }

    const nombre = (
      await interfaz.question('Nombre completo: ')
    ).trim();

    const email = (
      await interfaz.question('Correo electrónico: ')
    ).trim();

    async function pedirPassword(pregunta) {
      process.stdout.write(pregunta);
      ocultar = true;

      try {
        return await interfaz.question('');
      } finally {
        ocultar = false;
        process.stdout.write('\n');
      }
    }

    const password = await pedirPassword(
      'Contraseña (no se mostrará al escribir): '
    );

    const repeticion = await pedirPassword(
      'Repite la contraseña: '
    );

    if (!nombre || nombre.length > 255) {
      throw new Error('El nombre debe tener entre 1 y 255 caracteres.');
    }

    if (
      email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error('Correo electrónico inválido.');
    }

    if (password.length < 8 || password.length > 128) {
      throw new Error('La contraseña debe tener entre 8 y 128 caracteres.');
    }

    if (password !== repeticion) {
      throw new Error('Las contraseñas no coinciden.');
    }

    if (await Usuario.findOne({ where: { email } })) {
      throw new Error(
        'Ese correo ya existe. No se modificará su cuenta ni su rol.'
      );
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await scrypt(password, salt, 64);

    await sequelize.transaction(async (transaction) => {
      const administrador = await Usuario.findOne({
        where: {
          rol: 'Administrador',
          activo: true,
        },
        transaction,
      });

      if (administrador) {
        throw new Error(
          'Ya se creó un Administrador activo. Operación cancelada.'
        );
      }

      await Usuario.create(
        {
          nombre,
          email,
          password: `scrypt:${salt}:${hash.toString('hex')}`,
          rol: 'Administrador',
          activo: true,
        },
        { transaction }
      );
    });

    console.log('Administrador creado correctamente.');
  } finally {
    interfaz?.close();
    await sequelize.close();
  }
}

main().catch((error) => {
  if (
    error.name?.startsWith('Sequelize') ||
    error.name === 'ConnectionError'
  ) {
    console.error(
      'No se pudo completar el alta. Revisa la conexión, las tablas ' +
      'y que el correo no esté duplicado.'
    );
  } else {
    console.error(error.message);
  }

  process.exitCode = 1;
});