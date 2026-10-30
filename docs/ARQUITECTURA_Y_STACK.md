# Kolben ERP — Arquitectura y Stack Tecnológico

Basado en la **Especificación Funcional v1.1 (28/10/2026)** y la **Documentación Técnica v1.2**.

---

## 1. Resumen del Sistema
- **Proyecto**: ERP a medida para Kolben, distribuidora de repuestos automotrices (cilindros de freno y clutch).
- **Usuario**: Un solo usuario con control total (Javier Escalante).
- **Independencia**: 100% independiente de CatalogoHN (propios productos, clientes, precios y stock).
- **Propósito**: Reemplazar hojas sueltas y cubrir el ciclo completo:
  - Catálogo de productos y precios personalizados por cliente.
  - Proformas y facturas internas (sin formato fiscal SAR).
  - Cuentas por cobrar y control de abonos (incluyendo cheques post-fechados y facturas de carga inicial).
  - Inventario estricto por lotes con método FIFO (`por lote, primero el más viejo`) y registro automático de meses sin stock.
  - Pedidos al proveedor, costeo de importación (FOB real + gastos reales por CBM) y calculadora de cobertura.
  - Flujo de caja proyectado a 12 meses, punto de equilibrio, metas y cierres.
  - Resumen ejecutivo y métricas en tiempo real.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Notas clave |
|---|---|---|
| **Frontend** | React + Vite + TypeScript | SPA con ancho fijo de **1280 px** escalado proporcionalmente al ancho del aparato (desktop, tablet, móvil) sin desplazamiento horizontal. |
| **Estilos & UI** | Tailwind CSS + shadcn/ui | Tipografía Inter con cifras tabulares (`font-feature-settings: 'tnum'`). Paleta corporativa Kolben. |
| **Tablas** | `@tanstack/react-table` | Usado en Ventas, Productos, Clientes, flujo de Caja. |
| **Backend** | Node.js + Express + TypeScript | API REST bajo `/api`. Escucha en `127.0.0.1:4000` (local), `4001` (test), `4002` (prod). |
| **Base de Datos** | PostgreSQL | Una base de datos por entorno (`kolben_erp_local`, `kolben_erp_test`, `kolben_erp`). |
| **ORM** | Prisma | Esquema unificado y migraciones versionadas en el repo. |
| **Autenticación** | JWT en Cookie HttpOnly | `SameSite=Lax`, `Secure` en HTTPS. Contraseña con bcrypt o argon2. |
| **Generación PDF** | `@react-pdf/renderer` | Generados en el backend con `renderToBuffer` para descargas y envíos automáticos por correo. |
| **Hojas de Cálculo** | `exceljs` | Descarga de cotización de Calculadora y variación de costo por pedido. |
| **Imágenes** | `sharp` | Redimensionamiento automático de fotos de productos y logos al subirlos. |
| **Moneda & Números** | `decimal.js` + `Intl.NumberFormat("es-HN")` | Columnas `NUMERIC` en Postgres (nunca `float`). Moneda: Lempiras (`L`), 2 decimales en interfaz; porcentajes con 1 decimal. |
| **Validación** | `zod` | Validación de variables de entorno y payloads de entrada en API. |
| **Procesos Cron** | `node-cron` | Cierre mensual (día 1 a las 00:00 `UTC-6`), respaldo semanal por correo. PM2 en modo fork con 1 instancia. |
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
│   │   │   ├── config/            # Datos de proforma, bancos autorizados, ISV, respaldo
│   │   │   ├── productos/         # Códigos, categorías, marcas, lotes, ajustes
│   │   │   ├── clientes/          # Clientes, zonas, ciudades, lista de precios
│   │   │   ├── pos/               # Proformas y apartado de stock
│   │   │   ├── ventas/            # Facturación, cobranza, abonos, cambios
│   │   │   ├── compras/           # Calculadora, pedidos, pagos, recepción
│   │   │   ├── caja/              # Saldos, cuentas de banco, gastos fijos/variables, flujo 12 meses
│   │   │   ├── reportes/          # Resumen ejecutivo, ventas/utilidad por código
│   │   │   └── catalogo/          # Generación y exportación de catálogo
│   │   ├── services/              # Servicio FIFO, costeo de importación, multiplicadores, PE y meta
│   │   ├── pdf/                   # Plantillas React-PDF (Proforma, Factura, Catálogo, Respaldo, Cotización)
│   │   ├── jobs/                  # Cron jobs (cierre de mes día 1, respaldo semanal)
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
│   │   ├── components/ui/         # Componentes base
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
├── docs/                          # Especificación funcional y documentación técnica
├── GEMINI.md                      # Reglas y contexto permanente del agente
├── .gitignore
└── README.md
```

---

## 4. Convenciones Críticas de Negocio (Especificación Funcional v1.1 — 28/10/2026)

1. **FIFO Estricto (`por lote, primero el más viejo`)**:
   - Toda salida (venta, línea de Cambio o ajuste que saca) descuenta unidades del lote más antiguo con existencia disponible (`quedan > 0`).
   - Un ajuste que entra suma unidades al lote más nuevo.
   - Si una factura se elimina o se edita a la baja (rechazo parcial), las piezas se devuelven al lote exacto de origen (`LoteConsumo` / `Salida por lote`).
   - Corregir el `FOB` o `costo por unidad` del lote `INICIAL` actualiza el costo de las piezas ya vendidas de ese lote y el costo de esas líneas de factura (`LineaFactura.costoFifo`), recalculando utilidades automáticamente.
2. **Regla de Mes sin Stock (actualizada en v1.1 del 28/10/2026)**:
   - Un mes cuenta como **"sin stock"** para un código si **en cualquier momento de ese mes su stock llegó a 0** (Si durante todo el mes tuvo al menos 1 unidad, el mes cuenta con stock).
   - Se llena automáticamente en `MesSinStock(productoId, anio, mes)` cada vez que una venta, un Cambio o un ajuste deja el stock de un código en `0`, y el día 1 de cada mes para todo código que empiece el mes con `stock = 0`.
   - En la Calculadora de compras, la demanda de un mes sin stock se reemplaza por el promedio de los meses con stock de ese mismo año.
3. **Distribución de Costos de Importación**:
   - `FOB por unidad real = FOB por unidad estimado * (FOB real / FOB estimado)`.
   - Los gastos reales de recepción se prorratean por volumen (`CBM de la línea / CBM total`).
   - El residuo de redondeo se deja en la última línea para que la suma de `(costo por unidad * cantidad)` cuadre exactamente al centavo con `FOB real + gastos reales`.
4. **Estado "En Arranque"**:
   - Mientras no exista ninguna factura de POS (`Factura` con `cargaInicial = false`), el sistema está "en arranque" y muestra los campos especiales (lote Inicial al crear código, `+ Factura inicial` y `corregir saldo` en Ventas, `% bruto` manual y multiplicadores iniciales en Caja).
   - La primera venta ingresada desde el POS oculta los campos de arranque para siempre y crea el registro `Cierre de mes` (`MesContable`) del mes en curso.
5. **Auditoría Global (`Historial`)**:
   - Todo cambio relevante (precios por cliente, meta anual, gastos de meses pasados, facturas editadas o eliminadas, ajustes de stock, lote Inicial, corrección de saldo, cierre y reapertura de año) registra `fecha`, `antes`, `despues` y `motivo`.
