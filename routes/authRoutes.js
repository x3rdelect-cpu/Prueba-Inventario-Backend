
const express = require('express');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');

const router = express.Router();
const scrypt = promisify(crypto.scrypt);

async function verificarPassword(password, almacenado) {
  if (typeof password !== 'string' ||
      typeof almacenado !== 'string') return false;

  const partes = almacenado.split(':');
  if (partes.length !== 3 || partes[0] !== 'scrypt') return false;

  const [, salt, hashHex] = partes;

  if (!/^[a-f0-9]{32}$/i.test(salt) ||
      !/^[a-f0-9]{128}$/i.test(hashHex)) return false;

  const hashGuardado = Buffer.from(hashHex, 'hex');
  const hashCalculado = await scrypt(password, salt, 64);

  return crypto.timingSafeEqual(hashGuardado, hashCalculado);
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' ||
        typeof password !== 'string' ||
        !email.trim() || !password) {
      return res.status(400).json({
        error: 'Email y contraseña son obligatorios.'
      });
    }

    const usuario = await Usuario.findOne({
      where: { email: email.trim() }
    });

    if (!usuario ||
        !await verificarPassword(password, usuario.password)) {
      return res.status(401).json({
        error: 'Credenciales inválidas.'
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        error: 'Usuario desactivado.'
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no configurado');
    }

    const token = jwt.sign(
      { rol: usuario.rol },
      process.env.JWT_SECRET,
      {
        subject: String(usuario.id),
        expiresIn: process.env.JWT_EXPIRES_IN || '2h',
        algorithm: 'HS256'
      }
    );

    return res.json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    });

  } catch (error) {
    console.error('Error de autenticación:', error.message);
    return res.status(500).json({
      error: 'Error interno de autenticación.'
    });
  }
});

module.exports = router;
