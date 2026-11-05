
const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');

function autenticar(rolesPermitidos = []) {
  return async (req, res, next) => {
    try {
      const authorization = req.headers.authorization || '';
      const partes = authorization.split(' ');

      if (
        partes.length !== 2 ||
        partes[0] !== 'Bearer' ||
        !partes[1]
      ) {
        return res.status(401).json({
          error: 'Token de autenticación no proporcionado.'
        });
      }

      const token = jwt.verify(
        partes[1],
        process.env.JWT_SECRET,
        { algorithms: ['HS256'] }
      );

      const usuario = await Usuario.findByPk(token.sub);

      if (!usuario || !usuario.activo) {
        return res.status(401).json({
          error: 'Usuario inexistente o desactivado.'
        });
      }

      if (
        rolesPermitidos.length > 0 &&
        !rolesPermitidos.includes(usuario.rol)
      ) {
        return res.status(403).json({
          error: 'No tienes permisos para esta operación.'
        });
      }

      req.usuario = {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol
      };

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError' ||
          error.name === 'JsonWebTokenError' ||
          error.name === 'NotBeforeError') {
        return res.status(401).json({
          error: 'Token inválido o expirado.'
        });
      }

      next(error);
    }
  };
}

module.exports = autenticar;
