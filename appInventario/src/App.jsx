import { useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  NavLink,
  Routes,
  Route,
  Link,
  useNavigate,
} from 'react-router-dom';

import Login from './components/Login/Login';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import api from './services/api';
import './App.css';

// Utilidades
function leerUsuario() {
  try {
    return JSON.parse(localStorage.getItem('usuario') || 'null');
  } catch {
    return null;
  }
}

const money = (valor) =>
  new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(Number(valor || 0));

const date = (valor) =>
  valor
    ? new Intl.DateTimeFormat('es-PE', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(valor))
    : '—';

const pad = (id) => String(id).padStart(3, '0');

const errorText = (error) =>
  error.response?.data?.error ||
  'No se pudo completar la solicitud. Comprueba la conexión con el backend.';

// Iconos
const paths = {
  home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3z',
  box: 'm12 3 9 5-9 5-9-5 9-5zm-9 5v10l9 5 9-5V8M12 13v10',
  folder: 'M3 7h7l2 2h9v12H3zM3 7V4h7l2 3',
  truck:
    'M3 6h12v12H3zM15 10h4l3 4v4h-7M5 18a2 2 0 1 0 4 0m7 0a2 2 0 1 0 4 0',
  arrows: 'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',
  users:
    'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m7 1a4 4 0 0 1 0 7m3 10v-3a4 4 0 0 0-3-4',
  search: 'M21 21l-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',
  plus: 'M12 5v14M5 12h14',
  edit: 'm16 3 5 5-12 12-6 1 1-6zM13 6l5 5',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
  alert: 'm12 3 10 18H2zM12 9v5m0 3v1',
  check: 'm5 12 4 4L19 6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
};

function Icon({ name, ...props }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.box} />
    </svg>
  );
}

function Modal({ title, children, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const anterior = document.activeElement;
    ref.current?.focus();

    function manejarTecla(event) {
      if (event.key === 'Escape') onClose();

      if (event.key === 'Tab') {
        const elementos = ref.current?.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), ' +
            'select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
        );

        if (!elementos?.length) {
          event.preventDefault();
          return;
        }

        const primero = elementos[0];
        const ultimo = elementos[elementos.length - 1];

        if (event.shiftKey && document.activeElement === primero) {
          event.preventDefault();
          ultimo.focus();
        } else if (!event.shiftKey && document.activeElement === ultimo) {
          event.preventDefault();
          primero.focus();
        }
      }
    }

    document.addEventListener('keydown', manejarTecla);

    return () => {
      document.removeEventListener('keydown', manejarTecla);
      anterior?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop-custom">
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <div className="dialog-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Empty({ text = 'No hay registros para mostrar.' }) {
  return (
    <div className="empty">
      <Icon name="box" width="30" height="30" />
      <p>{text}</p>
    </div>
  );
}

function Badge({ type, children }) {
  return <span className={'pill ' + (type || '')}>{children}</span>;
}

// Configuración de los módulos
const configs = {
  productos: {
    title: 'Productos',
    description: 'Administra tu catálogo, precios y existencias.',
    singular: 'Producto',
    button: 'Nuevo Producto',
    search: 'Buscar por nombre, categoría o proveedor…',
    columns: ['ID', 'Nombre', 'Categoría', 'Proveedor', 'Precio', 'Stock'],
  },
  categorias: {
    title: 'Categorías',
    description: 'Organiza el catálogo de tu inventario.',
    singular: 'Categoría',
    button: 'Nueva Categoría',
    search: 'Buscar por nombre o descripción…',
    columns: ['ID', 'Nombre', 'Descripción', 'Cant. productos'],
  },
  proveedores: {
    title: 'Proveedores',
    description: 'Gestiona las empresas y contactos que abastecen tu almacén.',
    singular: 'Proveedor',
    button: 'Nuevo Proveedor',
    search: 'Buscar por razón social o contacto…',
    columns: ['ID', 'Razón social', 'Contacto', 'Teléfono', 'Email'],
  },
  usuarios: {
    title: 'Usuarios',
    description: 'Gestiona los responsables y su disponibilidad para operar.',
    singular: 'Usuario',
    button: 'Nuevo Usuario',
    search: 'Buscar por nombre, email o rol…',
    columns: ['ID', 'Nombre', 'Email', 'Rol', 'Estado'],
  },
  movimientos: {
    title: 'Kardex / Movimientos',
    description: 'Consulta el historial y registra cada cambio de existencias.',
    singular: 'Movimiento',
    button: 'Registrar Movimiento',
    search: 'Buscar por producto, tipo, usuario u observaciones…',
    columns: [
      'ID',
      'Fecha / Hora',
      'Producto',
      'Tipo',
      'Cantidad',
      'Usuario',
      'Saldo',
    ],
  },
};

function cells(kind, registro) {
  if (kind === 'productos') {
    return [
      pad(registro.id),
      <strong>
        {registro.nombre}
        <small>{registro.descripcion}</small>
      </strong>,
      registro.categoria?.nombre || 'Sin categoría',
      registro.proveedor?.razon_social || 'Sin asignar',
      money(registro.precio),
      <Badge type={registro.stock <= 5 ? 'red' : 'neutral'}>
        {registro.stock}
      </Badge>,
    ];
  }

  if (kind === 'categorias') {
    return [
      pad(registro.id),
      <strong>{registro.nombre}</strong>,
      registro.descripcion || '—',
      <Badge type="neutral">{registro.cantidad_productos || 0}</Badge>,
    ];
  }

  if (kind === 'proveedores') {
    return [
      pad(registro.id),
      <strong>{registro.razon_social}</strong>,
      registro.contacto || '—',
      registro.telefono || '—',
      registro.email || '—',
    ];
  }

  if (kind === 'usuarios') {
    return [
      pad(registro.id),
      <strong>{registro.nombre}</strong>,
      registro.email,
      registro.rol,
      <Badge type={registro.activo ? 'green' : 'neutral'}>
        {registro.activo ? 'Activo' : 'Inactivo'}
      </Badge>,
    ];
  }

  return [
    pad(registro.id),
    date(registro.createdAt),
    registro.producto?.nombre || 'Producto histórico',
    <>
      <Badge
        type={
          registro.tipo_movimiento === 'Entrada'
            ? 'green'
            : registro.tipo_movimiento === 'Salida'
              ? 'red'
              : 'amber'
        }
      >
        {registro.tipo_movimiento}
      </Badge>
      {registro.anulado && <small>Anulado</small>}
      {registro.reversa_de_id && (
        <small>Compensa #{registro.reversa_de_id}</small>
      )}
    </>,
    (registro.tipo_movimiento === 'Salida'
      ? '-'
      : registro.cantidad > 0
        ? '+'
        : '') + registro.cantidad,
    registro.usuario?.nombre || 'Usuario histórico',
    registro.stock_posterior ?? '—',
  ];
}

// Pantalla compartida de CRUD y Kardex
function DataPage({ kind }) {
  const usuarioSesion = leerUsuario();
  const esAdministrador = usuarioSesion?.rol === 'Administrador';
  const esAlmacenero = usuarioSesion?.rol === 'Almacenero';

  const puedeCrearEditar =
    esAdministrador ||
    (esAlmacenero && ['productos', 'movimientos'].includes(kind));

  const c = configs[kind];

  const [rows, setRows] = useState([]);
  const [refs, setRefs] = useState({
    categorias: [],
    proveedores: [],
    productos: [],
  });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let alive = true;

    // Solo se consultan las referencias necesarias para cada formulario.
    const relacionados =
      kind === 'productos'
        ? ['categorias', 'proveedores']
        : kind === 'movimientos'
          ? ['productos']
          : [];

    async function cargarDatos() {
      setBusy(true);
      setError('');

      try {
        const [principal, ...respuestas] = await Promise.all([
          api.get('/' + kind),
          ...relacionados.map((ruta) => api.get('/' + ruta)),
        ]);

        if (!alive) return;

        const referencias = {
          categorias: [],
          proveedores: [],
          productos: [],
        };

        relacionados.forEach((ruta, indice) => {
          referencias[ruta] = respuestas[indice].data;
        });

        setRows(principal.data);
        setRefs(referencias);
      } catch (err) {
        if (alive) setError(errorText(err));
      } finally {
        if (alive) setBusy(false);
      }
    }

    cargarDatos();

    return () => {
      alive = false;
    };
  }, [kind, revision]);

  const filtered = rows.filter((registro) => {
    const searchable =
      kind === 'usuarios'
        ? [
            registro.id,
            registro.nombre,
            registro.email,
            registro.rol,
            registro.activo ? 'Activo' : 'Inactivo',
          ].join(' ')
        : [
            registro.id,
            registro.nombre,
            registro.descripcion,
            registro.razon_social,
            registro.contacto,
            registro.telefono,
            registro.email,
            registro.categoria?.nombre,
            registro.proveedor?.razon_social,
            registro.producto?.nombre,
            registro.usuario?.nombre,
            registro.tipo_movimiento,
            registro.observaciones,
          ].join(' ');

    const coincideTexto = searchable
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase());

    const coincideFiltro =
      !filter ||
      (kind === 'productos'
        ? String(registro.categoria_id) === filter
        : kind === 'usuarios'
          ? filter === 'activo'
            ? registro.activo
            : !registro.activo
          : registro.tipo_movimiento === filter);

    return coincideTexto && coincideFiltro;
  });

  const pages = Math.max(1, Math.ceil(filtered.length / 5));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * 5, current * 5);

  function open(mode, row = {}) {
    setFormError('');

    setForm({
      nombre: row.nombre || '',
      descripcion: row.descripcion || '',
      precio: row.precio ?? '',
      stock: row.stock ?? 0,
      categoria_id: row.categoria_id || '',
      proveedor_id: row.proveedor_id || '',
      razon_social: row.razon_social || '',
      contacto: row.contacto || '',
      telefono: row.telefono || '',
      email: row.email || '',
      rol: row.rol || 'Almacenero',
      password: '',
      producto_id: row.producto_id || '',
      tipo_movimiento: 'Entrada',
      cantidad: '',
      observaciones: mode === 'anular' ? '' : row.observaciones || '',
    });

    setModal({ mode, row });
  }

  function close() {
    if (!saving) setModal(null);
  }

  function crearPayload() {
    if (kind === 'productos') {
      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion,
        precio: form.precio,
        categoria_id: form.categoria_id,
        proveedor_id: form.proveedor_id || null,
      };

      if (modal.mode === 'create') {
        payload.stock = form.stock;

        // Compatibilidad con el registro de stock inicial existente.
        // La identidad autorizada debe validarse en el backend.
        if (Number(form.stock) > 0) {
          payload.usuario_id = usuarioSesion?.id;
        }
      }

      return payload;
    }

    if (kind === 'categorias') {
      return {
        nombre: form.nombre,
        descripcion: form.descripcion,
      };
    }

    if (kind === 'proveedores') {
      return {
        razon_social: form.razon_social,
        contacto: form.contacto,
        telefono: form.telefono,
        email: form.email,
      };
    }

    if (kind === 'usuarios') {
      const payload = {
        nombre: form.nombre,
        email: form.email,
        rol: form.rol,
      };

      if (form.password) payload.password = form.password;

      return payload;
    }

    // El responsable del Kardex se obtiene del JWT en el backend.
    return {
      producto_id: form.producto_id,
      tipo_movimiento: form.tipo_movimiento,
      cantidad: form.cantidad,
      observaciones: form.observaciones,
    };
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setFormError('');

    try {
      if (modal.mode === 'delete') {
        await api.delete('/' + kind + '/' + modal.row.id);
      } else if (modal.mode === 'estado') {
        await api.patch('/usuarios/' + modal.row.id + '/estado', {
          activo: !modal.row.activo,
        });
      } else if (modal.mode === 'anular') {
        await api.post('/movimientos/' + modal.row.id + '/anular', {
          observaciones: form.observaciones,
        });
      } else if (modal.mode === 'edit') {
        await api.put('/' + kind + '/' + modal.row.id, crearPayload());
      } else {
        await api.post('/' + kind, crearPayload());
      }

      setModal(null);
      setNotice('Operación realizada correctamente.');
      setRevision((valor) => valor + 1);
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  function change(event) {
    const { name, value } = event.target;
    setForm((actual) => ({ ...actual, [name]: value }));
  }

  const input = (
    name,
    label,
    type = 'text',
    required = true,
    extra = {}
  ) => (
    <label
      className={
        ['descripcion', 'observaciones'].includes(name)
          ? 'field full'
          : 'field'
      }
    >
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={form[name] ?? ''}
        onChange={change}
        required={required}
        maxLength={type === 'text' ? 255 : undefined}
        {...extra}
      />
    </label>
  );

  const select = (name, label, options, required = true) => (
    <label className="field">
      <span>{label}</span>
      <select
        name={name}
        value={form[name] ?? ''}
        onChange={change}
        required={required}
      >
        <option value="">Seleccionar…</option>
        {options.map((opcion) => (
          <option key={opcion.value} value={opcion.value}>
            {opcion.label}
          </option>
        ))}
      </select>
    </label>
  );

  const responsable = (
    <p className="full help">
      Responsable: <strong>{usuarioSesion?.nombre || 'Usuario de sesión'}</strong>.
      El backend verifica la identidad del usuario autenticado.
    </p>
  );

  const opcionesFiltro =
    kind === 'productos'
      ? refs.categorias.map((registro) => ({
          value: registro.id,
          label: registro.nombre,
        }))
      : kind === 'usuarios'
        ? [
            { value: 'activo', label: 'Activos' },
            { value: 'inactivo', label: 'Inactivos' },
          ]
        : ['Entrada', 'Salida', 'Ajuste'].map((valor) => ({
            value: valor,
            label: valor,
          }));

  const tituloModal = !modal
    ? ''
    : modal.mode === 'view'
      ? 'Detalle del movimiento #' + pad(modal.row.id)
      : modal.mode === 'delete'
        ? 'Eliminar ' + c.singular
        : modal.mode === 'estado'
          ? (modal.row.activo ? 'Desactivar' : 'Activar') + ' usuario'
          : modal.mode === 'anular'
            ? 'Anular movimiento #' + pad(modal.row.id)
            : modal.mode === 'edit'
              ? 'Editar ' + c.singular
              : c.button;

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{c.title}</h1>
          <p>{c.description}</p>
        </div>
        <span className="section-label">GESTIÓN DE INVENTARIO</span>
      </div>

      {notice && (
        <div className="feedback success" role="status">
          <Icon name="check" />
          {notice}
          <button
            onClick={() => setNotice('')}
            aria-label="Cerrar aviso"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="feedback danger" role="alert">
          {error}
          <button onClick={() => setRevision((valor) => valor + 1)}>
            Reintentar
          </button>
        </div>
      )}

      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input
            aria-label={c.search}
            placeholder={c.search}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>

        {['productos', 'usuarios', 'movimientos'].includes(kind) && (
          <select
            className="filter"
            aria-label="Filtrar registros"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">
              Todos{' '}
              {kind === 'productos'
                ? 'los grupos'
                : kind === 'usuarios'
                  ? 'los estados'
                  : 'los tipos'}
            </option>
            {opcionesFiltro.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            ))}
          </select>
        )}

        {puedeCrearEditar && (
          <button
            className="primary add-button"
            onClick={() => open('create')}
          >
            <Icon name="plus" />
            {c.button}
          </button>
        )}
      </div>

      {kind === 'movimientos' && (
        <div className="hint">
          <Icon name="arrows" />
          Cada operación actualiza el stock y conserva su historial.
          Los ajustes son diferencias: +3 agrega, -3 descuenta.
        </div>
      )}

      <section className="panel">
        <div className="panel-heading">
          <h2>
            Lista de{' '}
            {kind === 'movimientos' ? 'Movimientos (Kardex)' : c.title}
          </h2>
          <span>{filtered.length} registros</span>
        </div>

        {busy ? (
          <Empty text="Cargando registros…" />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {c.columns.map((columna) => (
                      <th key={columna}>{columna}</th>
                    ))}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((registro) => (
                    <tr key={registro.id}>
                      {cells(kind, registro).map((valor, indice) => (
                        <td key={indice}>{valor}</td>
                      ))}
                      <td>
                        <div className="actions">
                          {kind === 'movimientos' ? (
                            <>
                              <button
                                className="action view"
                                onClick={() => open('view', registro)}
                              >
                                <Icon name="eye" />
                                Ver
                              </button>

                              {esAdministrador && (
                                <button
                                  className="action remove"
                                  disabled={
                                    registro.anulado ||
                                    !!registro.reversa_de_id ||
                                    registro.stock_anterior == null
                                  }
                                  onClick={() => open('anular', registro)}
                                >
                                  Anular
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {puedeCrearEditar && (
                                <button
                                  className="action edit"
                                  onClick={() => open('edit', registro)}
                                >
                                  <Icon name="edit" />
                                  Editar
                                </button>
                              )}

                              {esAdministrador &&
                                (kind === 'usuarios' ? (
                                  <button
                                    className={
                                      'action ' +
                                      (registro.activo ? 'remove' : 'view')
                                    }
                                    onClick={() => open('estado', registro)}
                                  >
                                    {registro.activo ? 'Desactivar' : 'Activar'}
                                  </button>
                                ) : (
                                  <button
                                    className="action remove"
                                    onClick={() => open('delete', registro)}
                                  >
                                    <Icon name="trash" />
                                    Eliminar
                                  </button>
                                ))}

                              {!puedeCrearEditar && !esAdministrador && (
                                <span className="help">Solo consulta</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!visible.length && (
              <Empty
                text={
                  query || filter
                    ? 'No hay coincidencias con tu búsqueda.'
                    : 'No hay registros para mostrar.'
                }
              />
            )}
          </>
        )}

        <div className="pagination-row">
          <span>
            Mostrando {filtered.length ? (current - 1) * 5 + 1 : 0}–
            {Math.min(current * 5, filtered.length)} de {filtered.length} registros
          </span>
          <nav aria-label="Paginación">
            <button
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              aria-label="Página anterior"
            >
              ‹
            </button>
            <span className="page-number">{current}</span>
            <span>de {pages}</span>
            <button
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
              aria-label="Página siguiente"
            >
              ›
            </button>
          </nav>
        </div>
      </section>

      {modal && (
        <Modal title={tituloModal} onClose={close}>
          {modal.mode === 'view' ? (
            <>
              <dl className="detail">
                {[
                  ['Producto', modal.row.producto?.nombre],
                  ['Fecha / Hora', date(modal.row.createdAt)],
                  ['Tipo', modal.row.tipo_movimiento],
                  ['Cantidad', modal.row.cantidad],
                  ['Stock anterior', modal.row.stock_anterior],
                  ['Stock posterior', modal.row.stock_posterior],
                  ['Responsable', modal.row.usuario?.nombre],
                  [
                    'Estado',
                    modal.row.anulado
                      ? 'Anulado'
                      : modal.row.reversa_de_id
                        ? 'Compensación'
                        : 'Registrado',
                  ],
                  ['Observaciones', modal.row.observaciones],
                ].map(([clave, valor]) => (
                  <div key={clave}>
                    <dt>{clave}</dt>
                    <dd>{valor ?? '—'}</dd>
                  </div>
                ))}
              </dl>
              <div className="dialog-footer">
                <button onClick={close}>Cerrar</button>
              </div>
            </>
          ) : (
            <form onSubmit={submit}>
              {formError && (
                <div className="feedback danger" role="alert">
                  {formError}
                </div>
              )}

              {['delete', 'estado'].includes(modal.mode) ? (
                <p className="confirm-text">
                  {modal.mode === 'delete'
                    ? '¿Deseas eliminar este registro? Las asociaciones y el historial se comprobarán antes de eliminarlo.'
                    : 'El usuario ' +
                      modal.row.nombre +
                      (modal.row.activo
                        ? ' dejará de tener acceso al sistema.'
                        : ' volverá a estar habilitado para acceder al sistema.')}
                </p>
              ) : (
                <div className="form-grid">
                  {modal.mode === 'anular' ? (
                    <>
                      <p className="full help">
                        Se creará un movimiento compensatorio y el original
                        quedará marcado como anulado.
                      </p>
                      {responsable}
                      {input('observaciones', 'Motivo de anulación')}
                    </>
                  ) : (
                    <>
                      {kind === 'productos' && (
                        <>
                          {input('nombre', 'Nombre del producto')}
                          {input('precio', 'Precio (S/)', 'number', true, {
                            min: 0,
                            max: 99999999.99,
                            step: '0.01',
                          })}
                          {select(
                            'categoria_id',
                            'Categoría',
                            refs.categorias.map((registro) => ({
                              value: registro.id,
                              label: registro.nombre,
                            }))
                          )}
                          {select(
                            'proveedor_id',
                            'Proveedor (opcional)',
                            refs.proveedores.map((registro) => ({
                              value: registro.id,
                              label: registro.razon_social,
                            })),
                            false
                          )}
                          {input('descripcion', 'Descripción', 'text', false)}

                          {modal.mode === 'create' ? (
                            <>
                              {input(
                                'stock',
                                'Stock inicial',
                                'number',
                                true,
                                { min: 0, step: 1 }
                              )}
                              {Number(form.stock) > 0 && responsable}
                            </>
                          ) : (
                            <p className="full help">
                              Stock actual: <strong>{modal.row.stock}</strong>.
                              Para cambiarlo, registra un movimiento en Kardex.
                            </p>
                          )}

                          {!refs.categorias.length && (
                            <p className="full help">
                              Primero crea una categoría en el módulo Categorías.
                            </p>
                          )}
                        </>
                      )}

                      {kind === 'categorias' && (
                        <>
                          {input('nombre', 'Nombre de la categoría')}
                          {input('descripcion', 'Descripción', 'text', false)}
                        </>
                      )}

                      {kind === 'proveedores' && (
                        <>
                          {input('razon_social', 'Razón social')}
                          {input('contacto', 'Contacto', 'text', false)}
                          {input('telefono', 'Teléfono', 'tel', false)}
                          {input('email', 'Correo electrónico', 'email', false)}
                        </>
                      )}

                      {kind === 'usuarios' && (
                        <>
                          {input('nombre', 'Nombre completo')}
                          {input('email', 'Correo electrónico', 'email')}
                          {select(
                            'rol',
                            'Rol',
                            ['Administrador', 'Almacenero', 'Supervisor'].map(
                              (valor) => ({ value: valor, label: valor })
                            )
                          )}
                          {input(
                            'password',
                            modal.mode === 'edit'
                              ? 'Nueva contraseña (opcional)'
                              : 'Contraseña',
                            'password',
                            modal.mode === 'create',
                            {
                              minLength: 8,
                              maxLength: 128,
                              autoComplete: 'new-password',
                            }
                          )}
                          <p className="full help">
                            La contraseña se almacena mediante un hash.
                            Al editar, deja el campo vacío para conservarla.
                          </p>
                        </>
                      )}

                      {kind === 'movimientos' && (
                        <>
                          {select(
                            'producto_id',
                            'Producto',
                            refs.productos.map((registro) => ({
                              value: registro.id,
                              label:
                                registro.nombre + ' · stock ' + registro.stock,
                            }))
                          )}
                          {responsable}
                          {select(
                            'tipo_movimiento',
                            'Tipo de movimiento',
                            ['Entrada', 'Salida', 'Ajuste'].map((valor) => ({
                              value: valor,
                              label: valor,
                            }))
                          )}
                          {input(
                            'cantidad',
                            form.tipo_movimiento === 'Ajuste'
                              ? 'Diferencia de stock (+ / −)'
                              : 'Cantidad',
                            'number',
                            true,
                            {
                              min:
                                form.tipo_movimiento === 'Ajuste'
                                  ? undefined
                                  : 1,
                              step: 1,
                            }
                          )}
                          {input(
                            'observaciones',
                            'Observaciones',
                            'text',
                            false
                          )}
                          {!refs.productos.length && (
                            <p className="full help">
                              Necesitas al menos un producto para registrar
                              movimientos.
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="dialog-footer">
                <button type="button" onClick={close} disabled={saving}>
                  Cancelar
                </button>
                <button
                  className={
                    modal.mode === 'delete' ? 'danger-button' : 'primary'
                  }
                  disabled={saving}
                  type="submit"
                >
                  {saving
                    ? 'Guardando…'
                    : modal.mode === 'delete'
                      ? 'Eliminar'
                      : modal.mode === 'estado'
                        ? 'Confirmar'
                        : modal.mode === 'anular'
                          ? 'Confirmar anulación'
                          : modal.mode === 'edit'
                            ? 'Guardar cambios'
                            : 'Guardar registro'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

// Dashboard
const chartColors = [
  '#4269d4',
  '#24a68a',
  '#f2ac4b',
  '#8e72d7',
  '#55a6d8',
  '#d76b86',
];

function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  const usuario = leerUsuario();
  const puedeRegistrar = ['Administrador', 'Almacenero'].includes(usuario?.rol);

  useEffect(() => {
    let alive = true;

    api.get('/dashboard')
      .then((respuesta) => {
        if (alive) {
          setData(respuesta.data);
          setError('');
        }
      })
      .catch((err) => {
        if (alive) setError(errorText(err));
      });

    return () => {
      alive = false;
    };
  }, [revision]);

  const groups = data?.stock_por_categoria || [];
  const total = groups.reduce(
    (suma, grupo) => suma + Number(grupo.stock || 0),
    0
  );

  let accumulated = 0;
  const gradient = groups
    .filter((grupo) => Number(grupo.stock) > 0)
    .map((grupo, indice) => {
      const start = accumulated;
      accumulated += (Number(grupo.stock) / total) * 100;
      return (
        chartColors[indice % chartColors.length] +
        ' ' + start + '% ' + accumulated + '%'
      );
    })
    .join(', ');

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Una vista general de tu inventario, en tiempo real.</p>
        </div>
        {data && !error && (
          <span className="live"><i />Datos cargados</span>
        )}
      </div>

      {error ? (
        <div className="feedback danger" role="alert">
          {error}
          <button onClick={() => setRevision((valor) => valor + 1)}>
            Reintentar
          </button>
        </div>
      ) : !data ? (
        <Empty text="Cargando resumen…" />
      ) : (
        <>
          <div className="kpis">
            {[
              ['Total Productos', data.total_productos, 'box', 'blue'],
              ['Categorías', data.total_categorias, 'folder', 'purple'],
              ['Proveedores', data.total_proveedores, 'truck', 'teal'],
              ['Bajo Stock (Alertas)', data.bajo_stock.length, 'alert', 'red'],
            ].map(([label, value, icon, color]) => (
              <div className="kpi" key={label}>
                <div>
                  <p>{label}</p>
                  <strong className={color === 'red' ? 'text-red' : ''}>
                    {value}
                  </strong>
                  <small>
                    {color === 'red'
                      ? '5 unidades o menos'
                      : 'Registros en el sistema'}
                  </small>
                </div>
                <span className={'kpi-icon ' + color}>
                  <Icon name={icon} width="25" height="25" />
                </span>
              </div>
            ))}
          </div>

          <div className="dashboard-grid">
            <section className="panel recent">
              <div className="panel-heading">
                <h2>Movimientos Recientes (Kardex)</h2>
                <Link to="/kardex">Ver todos →</Link>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Usuario'].map(
                        (titulo) => <th key={titulo}>{titulo}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.movimientos.map((movimiento) => (
                      <tr key={movimiento.id}>
                        <td>{date(movimiento.createdAt)}</td>
                        <td>{movimiento.producto?.nombre || '—'}</td>
                        <td>
                          <Badge
                            type={
                              movimiento.anulado
                                ? 'neutral'
                                : movimiento.tipo_movimiento === 'Entrada'
                                  ? 'green'
                                  : movimiento.tipo_movimiento === 'Salida'
                                    ? 'red'
                                    : 'amber'
                            }
                          >
                            {movimiento.anulado
                              ? 'Anulado'
                              : movimiento.tipo_movimiento}
                          </Badge>
                        </td>
                        <td>
                          {(movimiento.tipo_movimiento === 'Salida'
                            ? '-'
                            : movimiento.cantidad > 0
                              ? '+'
                              : '') + movimiento.cantidad}
                        </td>
                        <td>{movimiento.usuario?.nombre || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.movimientos.length && (
                <Empty text="Los movimientos registrados aparecerán aquí." />
              )}
            </section>

            <section className="panel stock-chart">
              <div className="panel-heading">
                <h2>Stock por Categoría</h2>
              </div>
              <div
                className="donut"
                style={{
                  background: total
                    ? 'conic-gradient(' + gradient + ')'
                    : '#e8edf4',
                }}
                role="img"
                aria-label={
                  'Stock por categoría: ' +
                  groups.map((grupo) => grupo.nombre + ': ' + grupo.stock).join(', ')
                }
              >
                <div>
                  <strong>{total}</strong>
                  <span>unidades</span>
                </div>
              </div>
              <div className="legend">
                {groups.map((grupo, indice) => (
                  <div key={grupo.nombre}>
                    <i
                      style={{
                        background: chartColors[indice % chartColors.length],
                      }}
                    />
                    <span>{grupo.nombre}</span>
                    <b>{grupo.stock}</b>
                  </div>
                ))}
                {!groups.length && <p>Sin productos registrados</p>}
              </div>
            </section>

            <section className="panel low-stock">
              <div className="panel-heading">
                <h2>Productos con Bajo Stock</h2>
                <Badge type="red">{data.bajo_stock.length} alertas</Badge>
              </div>
              {data.bajo_stock.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Stock</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bajo_stock.slice(0, 5).map((producto) => (
                        <tr key={producto.id}>
                          <td><strong>{producto.nombre}</strong></td>
                          <td>{producto.categoria?.nombre || '—'}</td>
                          <td><Badge type="red">{producto.stock}</Badge></td>
                          <td>
                            <Link to="/kardex">
                              {puedeRegistrar
                                ? 'Registrar entrada →'
                                : 'Consultar Kardex →'}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty text="No hay productos con stock bajo." />
              )}
            </section>

            <section className="panel valuation">
              <span className="eyebrow">VALOR DEL INVENTARIO</span>
              <strong>{money(data.valor_inventario)}</strong>
              <p>Precio de venta × unidades disponibles.</p>
              <Link className="primary" to="/productos">
                Ver productos <span>→</span>
              </Link>
            </section>
          </div>
        </>
      )}
    </>
  );
}

// Navegación del panel
const nav = [
  ['/', 'home', 'Inicio (Dashboard)'],
  ['/productos', 'box', 'Productos'],
  ['/categorias', 'folder', 'Categorías'],
  ['/proveedores', 'truck', 'Proveedores'],
  ['/kardex', 'arrows', 'Kardex / Movimientos'],
  ['/usuarios', 'users', 'Usuarios'],
];

function PanelInventario() {
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const usuarioPanel = leerUsuario();

  // Esta variable pertenece al componente que la utiliza.
  const menuVisible = nav.filter(
    ([ruta]) =>
      ruta !== '/usuarios' ||
      usuarioPanel?.rol === 'Administrador'
  );

  function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login', { replace: true });
  }

  return (
    <div className={'app-shell ' + (menu ? 'menu-open' : '')}>
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">S</span>
          <div>
            <strong>SENATI</strong>
            <small>Sistema de Inventario</small>
          </div>
        </Link>

        <div className="nav-caption">PRINCIPAL</div>

        <nav>
          {menuVisible.map(([to, icon, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMenu(false)}
            >
              <Icon name={icon} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className="status-dot" />
          Laboratorio #11
          <small>Full Stack Developer Software</small>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <button
              className="menu-toggle"
              aria-label="Abrir o cerrar menú"
              aria-expanded={menu}
              onClick={() => setMenu((valor) => !valor)}
            >
              ☰
            </button>
            <span>
              SENATI <span className="separator">/</span> Panel Administrativo
            </span>
          </div>

          <div className="profile">
            <span className="avatar">
              {usuarioPanel?.nombre?.charAt(0).toUpperCase() || 'S'}
            </span>
            <div>
              <strong>{usuarioPanel?.nombre || 'Usuario'}</strong>
              <small>{usuarioPanel?.rol || 'Sesión iniciada'}</small>
            </div>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={cerrarSesion}
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />

            {['productos', 'categorias', 'proveedores'].map((kind) => (
              <Route
                key={kind}
                path={'/' + kind}
                element={<DataPage key={kind} kind={kind} />}
              />
            ))}

            <Route
              path="/usuarios"
              element={
                <ProtectedRoute roles={['Administrador']}>
                  <DataPage key="usuarios" kind="usuarios" />
                </ProtectedRoute>
              }
            />

            <Route
              path="/kardex"
              element={<DataPage key="movimientos" kind="movimientos" />}
            />

            <Route
              path="*"
              element={
                <>
                  <h1>Página no encontrada</h1>
                  <Link to="/">Volver al inicio</Link>
                </>
              }
            />
          </Routes>

          <footer className="page-footer">
            SENATI · Sistema de Inventario
            <span>Laboratorio #11 · Full Stack Developer</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

// Rutas principales
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <PanelInventario />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}