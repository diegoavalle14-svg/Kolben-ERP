# Kolben ERP — Arquitectura y Stack Tecnológico

Basado en la Documentación Técnica v1.1 (24/10/2026).

---

## 1. Resumen del Sistema
- **Proyecto**: ERP a medida para Kolben, distribuidora de repuestos automotrices (cilindros de freno y clutch).
- **Usuario**: Un solo usuario con control total (Javier Escalante).
- **Propósito**: Reemplazar hojas sueltas y cubrir el ciclo completo:
  - Catálogo de productos y precios personalizados por cliente.
  - Proformas y facturas internas (sin formato fiscal SAR).
  - Cuentas por cobrar y control de abonos.
  - Inventario estricto por lotes con método FIFO y cálculo de meses sin stock.
  - Pedidos al proveedor, costeo de importación (FOB + fletes + aduana + gastos reales por CBM).
  - Flujo de caja proyectado a 12 meses, punto de equilibrio y metas.
  - Resumen ejecutivo y métricas en tiempo real.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Notas clave |
|---|---|---|
| **Frontend** | React + Vite + TypeScript | SPA con ancho fijo de 1280 px (según especificación). |
| **Estilos & UI** | Tailwind CSS + shadcn/ui | Tipografía Inter con cifras tabulares (`font-feature-settings: 'tnum'`). Paleta corporativa Kolben. |
| **Tablas** | `@tanstack/react-table` | Usado en Ventas, Productos, Clientes, flujo de Caja. |
| **Backend** | Node.js + Express + TypeScript | API REST bajo `/api`. Escucha en `127.0.0.1:4000` (local), `4001` (test), `4002` (prod). |
| **Base de Datos** | PostgreSQL | Una base de datos por entorno (`kolben_erp_local`, `kolben_erp_test`, `kolben_erp`). |
| **ORM** | Prisma | Esquema unificado y migraciones versionadas en el repo. |
| **Autenticación** | JWT en Cookie HttpOnly | `SameSite=Lax`, `Secure` en HTTPS. Contraseña con bcrypt o argon2. |
| **Generación PDF** | `@react-pdf/renderer` | Generados en el backend con `renderToBuffer` para descargas y envíos automáticos por correo. |
| **Hojas de Cálculo** | `exceljs` | Descarga de cotización de Calculadora y variación de costo por pedido. |
| **Imágenes** | `sharp` | Redimensionamiento automático de fotos de productos y logos al subirlos. |
| **Moneda & Números** | `decimal.js` + `Intl.NumberFormat("es-HN")` | Columnas `NUMERIC` en Postgres (nunca `float`). Moneda: Lempiras (`HNL`), 2 decimales en interfaz. |
| **Validación** | `zod` | Validación de variables de entorno y payloads de entrada en API. |
| **Procesos Cron** | `node-cron` | Cierre mensual, respaldo semanal por correo. PM2 en modo fork con 1 instancia. |
| **Correo** | `nodemailer` | Respaldo semanal de Por Cobrar en PDF y alertas. |
| **Seguridad** | `helmet`, `express-rate-limit` | Límite de intentos en login, cabeceras seguras. |
| **Despliegue & Servidor** | Nginx + Certbot (Let's Encrypt) + PM2 | Ubuntu LTS en Droplet DigitalOcean. Proxy inverso redirige `/api` a Node. |

---

## 3. Estructura del Monorepo

```text
kolben-erp/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Esquema de Prisma
│   │   ├── seed.ts                # Datos semilla de prueba
│   │   └── migrations/            # Historial de migraciones SQL
│   ├── src/
│   │   ├── server.ts              # Entry point (escucha en 127.0.0.1)
│   │   ├── app.ts                 # Configuración Express, middlewares y rutas
│   │   ├── config/env.ts          # Zod env schema & validación
│   │   ├── middlewares/           # Auth JWT, manejo global de errores, rate limit
│   │   ├── modules/
│   │   │   ├── auth/              # Login, sesión, cambio de clave
│   │   │   ├── productos/         # Códigos, categorías, marcas, lotes, ajustes
│   │   │   ├── clientes/          # Clientes, zonas, ciudades, lista de precios
│   │   │   ├── pos/               # Proformas y apartado de stock
│   │   │   ├── ventas/            # Facturación, cobranza, abonos, cambios
│   │   │   ├── compras/           # Calculadora, pedidos, pagos, recepción
│   │   │   ├── caja/              # Saldos, gastos fijos/variables, flujo 12 meses
│   │   │   ├── reportes/          # Resumen ejecutivo, ventas/utilidad por código
│   │   │   └── catalogo/          # Generación y exportación de catálogo
│   │   ├── services/              # Servicio FIFO, costeo de importación, multiplicadores
│   │   ├── pdf/                   # Plantillas React-PDF (Proforma, Factura, Catálogo, etc.)
│   │   ├── jobs/                  # Cron jobs (cierre de mes, respaldo semanal)
│   │   └── lib/                   # Instancia Prisma, helpers Decimal, logger, auditoría
│   ├── uploads/                   # Archivos locales (NO se versiona en Git)
│   │   ├── facturas/
│   │   ├── logos/
│   │   ├── comprobantes/
│   │   ├── productos/
│   │   └── catalogo/
│   ├── .env                       # Variables de entorno locales (NO en Git)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Pantallas principales del sistema
│   │   ├── components/ui/         # Componentes base shadcn/ui
│   │   ├── components/            # Tablas, diálogos, formularios, layout 1280px
│   │   ├── lib/                   # Cliente API fetch, formatters moneda/fecha
│   │   └── main.tsx               # Entry point de React
│   ├── .env.production            # VITE_API_URL=/api
│   ├── vite.config.ts             # Proxy local a http://localhost:4000
│   └── package.json
├── scripts/
│   ├── deploy.sh                  # Script de despliegue automatizado
│   ├── backup.sh                  # Respaldo diario de base de datos + uploads
│   ├── caja_backup.sh             # Respaldo CSV de tablas de caja
│   └── reset-password.ts          # CLI para resetear credenciales desde el servidor
├── ecosystem.config.js            # Configuración PM2 para test y prod
├── docs/                          # Documentación técnica y especificaciones
├── .gitignore
└── README.md
```

---

## 4. Convenciones Críticas de Negocio
1. **FIFO Estricto**:
   - Toda venta o salida descuenta unidades del lote más antiguo con existencia disponible.
   - Si una factura se cancela o edita a la baja, las piezas se devuelven al lote exacto de origen (`LoteConsumo`).
2. **Cálculo de Meses sin Stock**:
   - Si un producto tuvo stock 0 durante todo el mes calendario (configurable vía `pctMesSinStock`), se marca como mes sin stock.
   - En la calculadora de compras, la demanda de ese mes se sustituye por el promedio de los meses con existencia.
3. **Distribución de Costos de Importación**:
   - Los gastos de recepción (fletes, seguros, aduana) se prorratean por volumen (CBM) o FOB según la regla. El residuo de redondeo se suma a la última línea para cuadrar siempre al centavo exacto.
4. **Auditoría Global (`Historial`)**:
   - Todo cambio relevante (edición de precios, ajustes de stock, cambios en gastos pasados, cancelaciones) registra `antes`, `despues`, `usuario`, `fecha` y `motivo`.
