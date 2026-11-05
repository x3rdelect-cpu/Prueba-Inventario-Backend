import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function Login() {
  const navigate = useNavigate();

  const [credenciales, setCredenciales] = useState({
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setCredenciales((actual) => ({
      ...actual,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (enviando) return;

    setError('');
    setEnviando(true);

    try {
      const response = await api.post('/auth/login', {
        email: credenciales.email.trim(),
        password: credenciales.password,
      });

      const { token, usuario } = response.data;

      if (typeof token !== 'string' || !token || !usuario) {
        setError('El servidor devolvió una respuesta de sesión incompleta.');
        return;
      }

      localStorage.setItem('token', token);
      localStorage.setItem('usuario', JSON.stringify(usuario));

      navigate('/productos', { replace: true });
    } catch (err) {
      const status = err.response?.status;

      if (status === 400 || status === 401) {
        setError('Revisa tu correo y contraseña.');
      } else if (status === 403) {
        setError('Tu usuario está desactivado. Contacta al administrador.');
      } else if (status === 429) {
        setError('Demasiadas solicitudes. Inténtalo nuevamente más tarde.');
      } else {
        setError(
          'No se pudo iniciar sesión. Comprueba la conexión con el backend.'
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-md-6 col-lg-4">
          <section className="card shadow-sm p-4">
            <h1 className="h3 text-center">SENATI</h1>

            <p className="text-center text-secondary">
              Sistema de Inventario
            </p>

            <h2 className="h5 mb-4">Iniciar sesión</h2>

            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="login-email" className="form-label">
                  Correo electrónico
                </label>

                <input
                  id="login-email"
                  className="form-control"
                  type="email"
                  name="email"
                  value={credenciales.email}
                  onChange={handleChange}
                  autoComplete="username"
                  required
                  disabled={enviando}
                />
              </div>

              <div className="mb-4">
                <label htmlFor="login-password" className="form-label">
                  Contraseña
                </label>

                <input
                  id="login-password"
                  className="form-control"
                  type="password"
                  name="password"
                  value={credenciales.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                  disabled={enviando}
                />
              </div>

              <button
                className="btn btn-primary w-100"
                type="submit"
                disabled={enviando}
              >
                {enviando ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}