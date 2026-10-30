# Kolben ERP — Contexto Permanente y Reglas del Proyecto

Este archivo se carga automáticamente en cada sesión. **Siempre** debes respetar estas reglas de negocio, fórmulas, convenciones de interfaz y el plan de etapas basados en la **Especificación Funcional v1.1 (28/10/2026)** de Javier Escalante (Kolben).

## Documentación de Referencia en `docs/`
- [`docs/ESPECIFICACION_FUNCIONAL_V1.1.md`](./docs/ESPECIFICACION_FUNCIONAL_V1.1.md): Especificación funcional completa v1.1 (28/10/2026), fórmulas 4.0–4.7, eventos, arranque, los 18 ejemplos numéricos (Sección 11) y las 35 pruebas de entrega (Sección 12).
- [`docs/MODELO_DATOS_PRISMA.md`](./docs/MODELO_DATOS_PRISMA.md): Esquema de base de datos Prisma actualizado a la versión 1.1 de la especificación.
- [`docs/ARQUITECTURA_Y_STACK.md`](./docs/ARQUITECTURA_Y_STACK.md): Stack tecnológico, estructura del monorepo y convenciones críticas.
- [`docs/PLAN_ETAPAS.md`](./docs/PLAN_ETAPAS.md): Plan de trabajo de 15 etapas (Etapa 0 a Etapa 14) y criterios de aceptación.
- [`docs/Kolben_ERP_Documentacion_Tecnica.pdf`](./docs/Kolben_ERP_Documentacion_Tecnica.pdf): Documento técnico de infraestructura, despliegue en Droplet, Nginx, PM2 y respaldos.

---

## 1. Alcance, UI y Reglas Generales Inquebrantables

1. **Un solo usuario**: El dueño (`Javier Escalante`). No hay roles ni permisos.
2. **Moneda y formato numérico**:
   - Moneda única: **Lempiras (`L`)**, **2 decimales** en pantalla; cálculos internos con más decimales (`Decimal` en PostgreSQL/Prisma, nunca `float`).
   - **Porcentajes**: siempre con **1 decimal** (ej. `35.3%`).
   - No existe tipo de cambio en el sistema; lo único en dólares es el saldo de "Bancos dólares" en Caja, que el usuario escribe a mano junto con su valor en L.
   - Idioma: Español. Fechas `dd/mm/aaaa` en documentos; `"20 ago"` en tablas.
   - Zona horaria: **Hora de Honduras (`UTC-6`, `America/Tegucigalpa`)** para "hoy", cambio de mes y cierre del día 1.
3. **Diseño de 1280 px y táctil**:
   - Un solo diseño fijo de **1280 px de ancho**, sin reacomodar cuadros, escalado proporcionalmente al ancho de la pantalla hacia arriba y hacia abajo (laptop, tablet, celular), sin desplazamiento horizontal.
   - Tipografía `Inter` con cifras tabulares (`tabular-nums`).
   - **Nada se arrastra (no drag & drop)**: todo orden se cambia con flechas `↑` `↓` o escribiendo el número de posición.
   - **Confirmación en línea (no modal)** antes de toda acción irreversible: ingresar pedido, editar o eliminar factura, ajustar stock, editar o quitar pagos, marcar recibido, cerrar o reabrir año.
4. **Orden único**:
   - El orden de categorías, marcas, zonas, ciudades y bancos (Listas) y el de los códigos (Productos, numerados `1..N` dentro de cada `Categoría + Marca`) es el orden en todas las pantallas, reportes, PDF y catálogo.
5. **Nada con movimiento se borra**:
   - Código, cliente, categoría, marca, zona o ciudad con movimiento se inactiva o da de baja. Solo se borra lo que nunca tuvo movimiento.
6. **Mes contable**:
   - Una venta pertenece al mes de la fecha de su factura. Editar o eliminar una factura recalcula el mes original de esa factura, no el mes actual.
7. **Abonos y pagos no mueven efectivo ni bancos**:
   - Los saldos de efectivo, cheques y bancos se escriben a mano en Caja. Un abono solo baja `Por cobrar`; un pago de pedido solo baja la `deuda del pedido`.
8. **Estado "En Arranque"**:
   - Mientras no exista ninguna factura de POS (`Factura` con `cargaInicial = false`), el sistema está **"en arranque"** y muestra los campos especiales:
     - En Productos (`+ Nuevo código`): `stock inicial`, `FOB por unidad` y `costo por unidad` (crean el lote `INICIAL`).
     - En Ventas: `+ Factura inicial` (`cargaInicial = true`, sin líneas, con abono inicial `medio = CARGA_INICIAL`) y `corregir saldo` (con motivo).
     - En Caja: `% bruto` manual del año anterior y `multiplicadores iniciales` por categoría.
   - La primera venta ingresada en el POS oculta estos campos para siempre y crea el registro `Cierre de mes` (`MesContable`) del mes en curso.
9. **Auditoría (`Historial`)**:
   - Todo cambio relevante guarda `fecha`, `antes`, `despues` y `motivo`: precios por cliente, meta anual, gastos de meses pasados, facturas editadas o eliminadas, ajustes de stock, lote Inicial, corrección de saldo, cierre y reapertura de año.

---

## 2. Reglas de Stock, Lotes FIFO y Mes sin Stock

1. **Stock, Apartado y Disponible**:
   - `Stock` = suma de `quedan` en todos los lotes del código.
   - `Apartado` = suma de cantidades del código en proformas con `estado = PENDIENTE`.
   - `Disponible = Stock - Apartado`.
   - **El POS y el Catálogo usan el `Disponible`. La Calculadora usa el `Stock`.**
2. **FIFO estricto ("por lote, primero el más viejo")**:
   - Toda salida de piezas (venta, línea de `Cambio` o ajuste que saca) descuenta primero del lote más viejo (`fechaRecibido ASC, id ASC`) que tenga `quedan > 0`; cuando se acaba, sigue con el siguiente.
   - Un ajuste que entra (`+`) suma al lote más nuevo.
   - Una pieza devuelta (factura editada a la baja o eliminada) regresa exactamente al lote de donde salió (`LoteConsumo` / `Salida por lote`).
   - Solo el lote `INICIAL` se puede editar (FOB y costo por unidad, con motivo y confirmación). Al corregirlo, actualiza el costo de las piezas ya vendidas de ese lote (`LoteConsumo.costoUnidad` y `fobUnidad`) y el costo de esas líneas de factura (`LineaFactura.costoFifo`); las utilidades se recalculan solas.
3. **Regla de "Mes sin stock" (`MesSinStock`)**:
   - **Un mes cuenta como "sin stock" para un código si en cualquier momento de ese mes su stock llegó a 0.** Si durante todo el mes tuvo al menos 1 unidad, el mes cuenta con stock.
   - Se registra automáticamente en la tabla `MesSinStock(productoId, anio, mes)`:
     1. Cada vez que una venta, un Cambio o un ajuste deja el stock de un código en `0` (o si se crea con stock `0`).
     2. El día 1 de cada mes (a las 00:00), para todo código que empiece el mes con `stock = 0`.
4. **Valoración de Inventario**:
   - `Valor a costo` = suma para cada lote de `(quedan * costoUnidad)`.
   - `Valor a precio de venta` = suma para cada lote de `(quedan * fobUnidad * multiplicador de la categoría)`.

---

## 3. Fórmulas Clave del Sistema (Sección 4)

- **Factura válida para ventas**: `eliminada = false` y `cargaInicial = false`.
- **Ventas de un periodo**: Suma de `subtotal` (sin ISV) de facturas válidas en el periodo. Líneas `CAMBIO` tienen precio `0`.
- **Costo de lo vendido**: Suma de `costoFifo` de líneas `NORMAL` de facturas válidas del periodo.
- **Utilidad bruta (U.B.)**: `Ventas - Costo de lo vendido`. `% U.B. = U.B. / Ventas`. Menos de `40%` se marca en rojo.
- **Devoluciones/cambios**: Categoría de gasto del negocio del sistema (no editable). Suma del costo FIFO de todas las líneas `CAMBIO` de facturas no eliminadas del año, **dividida entre 12**. Los 12 meses del año muestran ese mismo valor y se recalcula cada vez que entra un Cambio.
- **Utilidad neta 1 (U.N.1)**: `U.B. - Gastos del negocio - Devoluciones/cambios`.
- **Utilidad neta 2 (U.N.2)**: `U.N.1 - Gastos personales`.
- **Salidas del año**: Suma de gastos del negocio y personales de los 12 meses (reales en meses pasados y mes en curso; presupuesto en meses futuros). **No incluye** `Devoluciones/cambios`.
- **Punto de equilibrio (PE) del año**: `Salidas del año / % bruto del año anterior`.
- **PE del mes** (se guarda fijo el día 1 en `MesContable`): `max(0, (PE del año - Ventas acumuladas hasta el mes anterior) / meses restantes incluyendo el actual)`. El primer mes en que las ventas acumuladas alcanzan el PE anual lleva `"✓ PE cubierto"`.
- **Meta del mes** (se guarda fija el día 1 en `MesContable`): `max(0, (Meta anual - Ventas acumuladas hasta el mes anterior) / meses restantes incluyendo el actual)`. En meses futuros se proyecta en vivo con las ventas acumuladas hasta hoy.
- **Balance anual**: `Utilidad bruta del año hasta hoy - Salidas del año`.
- **Multiplicador de categoría**: Facturado de esa categoría en los últimos 12 meses desde hoy (líneas `NORMAL` de facturas válidas) dividido entre el FOB de esas mismas piezas (`LoteConsumo.cantidad * LoteConsumo.fobUnidad`). Antes de cerrar el primer mes del sistema, usa el multiplicador inicial escrito en Caja.
- **Caja Kolben**: `Efectivo + Cheques en mano + suma de Cuentas de banco en L + valor en L de cuenta USD + Total por cobrar`.
- **Deuda de un pedido**: `(FOB - pagos proveedor) + (Gastos - pagos gastos)`. Donde `FOB` es `fobReal` (suma de pagos a proveedor si `proveedorPagado = true`) o `fobEstimado`; y `Gastos` es `FOB * % aduana` antes de recibir o `suma de GastoRecepcion` después de recibido.
- **Disponible para compras**: `Caja Kolben - Deuda de todos los pedidos activos`.
- **Prueba ácida**: `Caja Kolben / Deuda de pedidos activos` (`>= 1` verde, `< 1` rojo).
- **Calculadora de compras (por código)**:
  - `Llegada = mes del pedido + 5 meses` (tránsito fijo de 5 meses). `Ventana` = desde `Llegada` hasta el mes previo a la llegada del siguiente pedido del ciclo.
  - `Demanda` = unidades vendidas en esos mismos meses del año anterior (sustituyendo meses en `MesSinStock` por el promedio de los meses con stock de ese año; en el primer año usa `VentaBase` 2026).
  - `Calculado` = `max(0, demanda ventana - stock al llegar) * (1 + % stock extra)`, redondeado hacia arriba al `empaque` de la categoría (`10/20/50`) y con **mínimo de 50 unidades** si es `> 0`. `Final = Calculado + Ajuste`.
- **Recepción de pedido**:
  - `FOB por unidad real = FOB estimado * (FOB real / FOB estimado total)`.
  - `Gasto de línea = Gastos reales * (CBM línea / CBM total)`.
  - `Costo por unidad = FOB por unidad real + (Gasto de línea / cantidad)`. El residuo de redondeo se ajusta en la última línea para cuadrar al centavo con `FOB real + Gastos reales`. Bloquea si el CBM total no coincide con el `cbmPackingList`.

---

## 4. Flujo de Git y GitHub (Obligatorio)

- **Al finalizar cada etapa o corrección**, siempre se debe hacer `git add`, `git commit` (con prefijos semánticos en español como `feat(...)`, `fix(...)`, `docs(...)`, `chore(...)`) y `git push` a GitHub (`origin develop` o la rama correspondiente de la etapa).
- Ramas principales: `develop` (desarrollo/pruebas) y `main` (producción).

---

## 5. Estado Actual del Desarrollo

- ✅ **Etapa 0 (Cimientos)**: Completada.
- ✅ **Etapa 1 (Entrada + Menú y Configuración - Pantalla 12)**: Completada y alineada con v1.1.
- ✅ **Etapa 2 (Productos y Listas - Pantalla 8)**: Completada y alineada con v1.1 (`empaque` 10/20/50 en Categorías, bloqueo de inactivación con stock/apartado/pedido activo, registro automático en `MesSinStock` al crear con stock 0, flechas `↑ ↓` por fila y control de estado `enArranque`).
- 🔜 **Etapa 3 (Ficha de código - Pantalla 9)**: Siguiente etapa a implementar.
- ⏳ **Etapas 4 a 14**: Pendientes según [`docs/PLAN_ETAPAS.md`](./docs/PLAN_ETAPAS.md).

