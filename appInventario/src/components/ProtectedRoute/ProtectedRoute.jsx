import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, roles = [] }) {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0) {
    let usuario;

    try {
      usuario = JSON.parse(
        localStorage.getItem('usuario') || 'null'
      );
    } catch {
      usuario = null;
    }

    if (!roles.includes(usuario?.rol)) {
      return <Navigate to="/productos" replace />;
    }
  }

  return children;
}