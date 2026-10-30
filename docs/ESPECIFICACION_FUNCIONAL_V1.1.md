# Kolben · Sistema Administrativo Interno — Especificación Funcional v1.1

- **Versión**: 1.1 · 28 de octubre de 2026
- **Para**: Diego Aguilar (desarrollo) · **De**: Javier Escalante (Kolben)
- **Propósito**: Referencia oficial para programar el sistema: alcance, modelo de datos, reglas, fórmulas, cada pantalla con sus acciones y origen de los datos, eventos, procesos automáticos, arranque, ejemplos con números y lista de pruebas de entrega.

---

## 1. Visión General

Sistema administrativo interno de **Kolben** (importación y venta de cilindros de freno y clutch). Reemplaza el control actual en hojas sueltas y cubre el ciclo completo:
`producto → precio por cliente → proforma → factura → cuentas por cobrar → stock por lotes → pedido al proveedor → pagos → recepción y costeo → utilidad → caja → resumen`.

Es independiente de **CatalogoHN**: tiene sus propios productos, clientes, precios y stock. Los pedidos que lleguen por CatalogoHN se ingresan a mano en el POS.

### 1.1 Alcance y Supuestos
- **Un solo usuario (el dueño)**: No hay roles ni permisos.
- **Moneda única: lempiras (L)**: 2 decimales en pantalla; cálculos internos con más decimales. No existe tipo de cambio. Lo único en dólares es el saldo de "Bancos dólares" en Caja, que el usuario escribe a mano junto con su valor en L.
- **Idioma**: Español. Fechas `dd/mm/aaaa` en documentos; `"20 ago"` en tablas. Hora de Honduras (`UTC-6`). Porcentajes con 1 decimal.
- **Aparatos**: Un solo diseño de **1280 px de ancho**, sin reacomodar cuadros. La página se escala al ancho de la pantalla, hacia abajo y hacia arriba: en laptop o monitor más ancho se amplía hasta llenar el ancho con las mismas proporciones; en tablet (horizontal o vertical) y celular se reduce, completa y sin cortar. Solo desplazamiento vertical, nunca horizontal; zoom con los dedos permitido. En móvil: `viewport width=1280`; en escritorio: escalar el contenedor a `ancho de ventana / 1280`. Uso principal: laptop y tablet.
- **Interacción táctil**: Nada se arrastra; todo orden se cambia con flechas `↑` `↓` o con números (ver Productos).
- **Sin facturación SAR**: El documento al cliente es una proforma; el número de factura es interno.
- **Arranque previsto**: Enero 2027. El sistema arranca vacío y el usuario carga todo por pantalla (sección 8).

### 1.2 Módulos y Navegación
Pantalla de entrada (login) y menú lateral fijo en todas las pantallas, en este orden:

| # | Pantalla | Función |
|---|---|---|
| — | **Entrada** | Usuario y contraseña; primer uso crea el usuario. |
| 0 | **Resumen** | Tablero de solo lectura: ventas, utilidades, punto de equilibrio, meta, inventario, posición financiera, pedidos. |
| 1 | **POS** | Proformas (crear, editar, apartar), PDF al cliente, ingresar como factura. |
| 2 | **Ventas por código** | Unidades por código y mes; año base 2026 editable. |
| 3 | **Utilidad por código** | Ingreso, costo y utilidad por categoría, marca y código. |
| 4 | **Compras · Calculadora** | Sugerido de pedido por código y total contra el disponible. |
| 5 | **Compras · Pedidos** | Pedidos activos, pagos, recepción, costeo por lotes, historial. |
| 6 | **Clientes** | Lista, ritmo de compra, zonas, ficha y precios por cliente. |
| 7 | **Ventas** | Facturas: por cobrar, todas, cambios; abonos, edición y eliminación. |
| 8 | **Productos** | Catálogo interno de códigos, orden, listas, alta y edición. |
| 9 | **Ficha de código** | Detalle, lotes por lote (primero el más viejo), ajustes de stock. |
| 10 | **Caja** | Saldos, deuda por pedido, disponible, año (meta, PE) y flujo de 12 meses. |
| 11 | **Catálogo** | PDF de catálogo para clientes, generado de Productos. |
| 12 | **Configuración** | Datos de la proforma, ISV, respaldo semanal, contraseña. |

---

## 2. Modelo de Datos

| Entidad | Campos clave | Notas |
|---|---|---|
| **Usuario** | usuario, hash contraseña | Uno solo. |
| **Configuración** | vendedor, contacto, a nombre de quién van los cheques, porcentaje de ISV, correo y día del respaldo, portada del catálogo, paleta del catálogo | Un solo registro (`id = 1`). |
| **Banco** | nombre, cuenta enmascarada, orden | Bancos autorizados de la proforma. |
| **Categoría** | nombre, orden, empaque (10/20/50) | Creadas por el usuario. |
| **Marca** | nombre, logo, orden | — |
| **Zona / Ciudad** | nombre, orden; ciudad → zona | Ciudad pertenece a una zona. |
| **Producto** | código (único), categoría, marca, descripción (multilínea), CBM por unidad, foto, activo, posición | Posición dentro de categoría y marca. |
| **Lote** | código, pedido (o `INICIAL`), fecha de recibido, cantidad, unidades que quedan, FOB por unidad, aduana por unidad, costo por unidad | Solo el lote Inicial se puede editar. |
| **Ajuste de stock** | código, fecha, unidades (más o menos), motivo, stock antes y después | Mueve unidades por lote, sin dinero. |
| **Cliente** | código, nombre, ciudad, dirección, contacto, días crédito, ISV sí/no, activo | — |
| **Precio del cliente** | cliente, código, precio sin ISV, fecha | Cada cambio queda en el historial. |
| **Proforma** | número sugerido, cliente, fecha, días de crédito, vence, tipo crédito o contado, ISV sí/no, estado, fecha de creación | `pendiente → ingresada` o `eliminada`. |
| **Línea de proforma** | proforma, código, cantidad, precio, precio cambiado (sí/no), tipo normal o Cambio | — |
| **Factura** | número (único), cliente, fecha, vence, tipo crédito o contado, subtotal, ISV, total, estado activa o eliminada, carga inicial (sí/no) | Nace de una proforma o de "+ Factura inicial". |
| **Línea de factura** | factura, código, cantidad, precio, tipo normal o Cambio, costo | El detalle de lotes de origen va en Salida por lote. |
| **Abono** | factura, fecha, monto, número de recibo, medio (`efectivo`, `transferencia`, `cheque`, `devolución` o `carga inicial`), cheque pendiente hasta | Lo ya abonado de una factura inicial se guarda como un abono con medio `carga inicial`. |
| **Pedido** | número, estado, fecha colocado, llegada aproximada, porcentaje de aduana, FOB real, proveedor pagado completo (sí/no), CBM del packing list | `En producción → En camino → Recibido`. |
| **Línea de pedido** | pedido, código, cantidad, FOB por unidad, CBM por unidad | — |
| **Pago de pedido** | pedido, fecha, tipo proveedor o gastos, monto (puede ser negativo), nota | — |
| **Gasto de recepción** | pedido, categoría del gasto, monto, aproximado (sí/no) | Gastos reales al recibir el pedido. |
| **Categoría de gasto** | nombre, grupo negocio o personal, tipo fijo o variable, presupuesto mensual (variables), activa desde y hasta, del sistema (sí/no) | `Devoluciones/cambios` es del sistema y no se edita. Los montos fijos van en Monto fijo vigente. |
| **Movimiento de gasto** | categoría, fecha, monto, nota | Montos de los gastos variables. |
| **Saldo de caja** | efectivo, cheques en mano, saldo en dólares y su valor en lempiras | Lo escribe el usuario a mano. |
| **Año** | año, meta anual, porcentaje bruto escrito a mano (solo el primer año), cerrado (sí/no), fecha de cierre, multiplicador inicial de cada categoría | El PE del año y el % bruto se calculan; el cierre del año los deja fijos. |
| **Venta base** | código, año (2026), mes, unidades | El año base que carga el usuario. |
| **Mes sin stock** | código, año, mes | Se llena solo: cada vez que una venta, un Cambio o un ajuste deja el stock de un código en 0, se registra ese mes; y el día 1, todo código que empiece el mes en 0. Un mes cuenta como "sin stock" si en cualquier momento de ese mes su stock llegó a 0. |
| **Historial** | entidad, id, campo, antes, después, motivo, fecha | Auditoría de todo cambio relevante. |
| **Cierre de mes** | año, mes, punto de equilibrio del mes, meta del mes, fecha en que se fijó | Se crea el día 1 de cada mes (y el del primer mes, al cerrar el arranque). El Resumen lee de aquí el PE y la meta de los meses pasados y del actual: no se recalculan. |
| **Parámetros de compra** | meses del ciclo de pedidos, porcentaje de stock extra | Un solo registro, de la Calculadora. Los meses de tránsito (5) son fijos en el sistema. |
| **Borrador de la Calculadora** | código, ajuste, FOB por unidad, escrito a mano (sí/no) | Lo que el usuario escribe en la Calculadora hasta ingresar la orden; se borra al ingresarla. |
| **Salida por lote** (`LoteConsumo`) | línea de factura, lote, cantidad, costo por unidad, FOB por unidad | De qué lote salió cada pieza vendida. Se usa para el costo, el multiplicador y para devolver piezas a su lote. |
| **Cuenta de banco** | nombre, saldo en lempiras | Cuentas de banco en lempiras de Caja, una fila por cuenta. |
| **Monto fijo vigente** | categoría de gasto, desde qué mes, monto | Cada cambio de un gasto fijo "en adelante" agrega una fila; el monto de un mes es el de la fila más reciente que ya aplica a ese mes. |

---

## 3. Reglas Generales

1. **Orden único**: El orden de categorías, marcas, zonas, ciudades y bancos (Listas) y el de los códigos (Productos) es el orden en todas las pantallas, reportes, PDF y catálogo.
2. **Nada con movimiento se borra**: Código, cliente, categoría, marca, zona o ciudad con movimiento se inactiva o da de baja. Solo se borra lo que nunca tuvo movimiento.
3. **Historial**: Todo cambio relevante guarda fecha, antes, después y motivo: precios por cliente, meta, gastos de meses pasados, facturas editadas o eliminadas, ajustes de stock, lote Inicial, corrección de saldo, cierre y reapertura de año.
4. **Confirmación en línea (no modal)** antes de toda acción irreversible: ingresar pedido, editar o eliminar factura, ajustar stock, editar o quitar pagos, marcar recibido, cerrar o reabrir año.
5. **Mes contable**: Una venta pertenece al mes de la fecha de su factura. Editar o eliminar una factura recalcula ese mes, no el mes actual.
6. **Documentos generados**: Proforma, respaldo semanal, catálogo y descargables se generan de los datos; no se editan.
7. **Abonos y pagos no mueven efectivo ni bancos**: Esos saldos se escriben a mano en Caja. Lo automático es: un abono baja Por cobrar; un pago baja la deuda del pedido.

### 3.1 Stock, Lotes y Apartado
- **Stock de un código**: Suma de las unidades que quedan (`quedan`) en todos sus lotes.
- **Apartado**: Suma de las unidades de ese código en proformas pendientes.
- **Disponible**: `Stock - Apartado`.
- **FIFO estricto**: Toda salida de piezas (una venta, una línea de Cambio o un ajuste que saca) se descuenta primero del lote más viejo que todavía tiene unidades; cuando se acaba, sigue con el siguiente. Un ajuste que entra se suma al lote más nuevo. Una pieza devuelta (factura editada o eliminada) regresa al lote de donde salió (`Salida por lote` / `LoteConsumo`).
- **Uso de Disponible vs Stock**: El POS y el catálogo usan el **disponible**. La Calculadora usa el **stock**.
- **Valor a costo**: Para cada lote, `unidades que quedan * costo por unidad`, y se suma todo.
- **Valor a precio de venta**: Para cada lote, `unidades que quedan * FOB por unidad * multiplicador de la categoría del código`, y se suma todo.
- **Hora**: "Hoy", el cambio de mes y el cierre del día 1 se calculan con la hora de Honduras (`UTC-6`). Montos en lempiras con 2 decimales; porcentajes con 1 decimal.

---

## 4. Fórmulas y Definiciones Base

### 4.0 Definiciones que se repiten en todo el sistema
- **Mes sin stock**: Un mes cuenta como "sin stock" para un código si en cualquier momento de ese mes su stock llegó a 0. Si durante todo el mes tuvo al menos 1 unidad, el mes cuenta con stock. En la Calculadora, en un mes sin stock la venta real se reemplaza por el promedio de los meses con stock de ese año.
- **Factura válida para ventas**: Factura con `eliminada = false` y `cargaInicial = false` (las facturas viejas cargadas en el arranque no son ventas del sistema).
- **Ventas de un periodo**: Suma del `subtotal` sin impuesto (sin ISV) de todas las facturas válidas para ventas cuya fecha cae dentro del periodo. Si fue editada, cuenta con su valor actual. Las líneas de Cambio tienen precio cero, así que no suman.
- **Costo de lo vendido de un periodo**: Suma del costo de cada línea normal (`tipo = NORMAL`) de las facturas válidas para ventas del periodo.
- **Utilidad bruta**: `Ventas - Costo de lo vendido` del mismo periodo. `% U.B. = Utilidad bruta / Ventas`. Si no hubo ventas, se muestra una raya (`—`). Una línea o factura con menos de `40%` se marca en rojo.
- **Saldo de una factura**: `Total de la factura (incluye ISV) - suma de todos sus abonos`.
- **Total por cobrar**: Suma de los saldos de todas las facturas no eliminadas con `saldo > 0` (aquí **sí** entran las facturas de carga inicial).
- **Gastos del negocio de un mes**: Para cada categoría de gasto del grupo `NEGOCIO` activa ese mes: si es fija, el monto vigente ese mes; si es variable, la suma de movimientos con fecha de ese mes. En meses futuros se usa el presupuesto (monto fijo o presupuesto mensual de la variable). No incluye `Devoluciones/cambios`.
- **Gastos personales de un mes**: Igual que el anterior, pero con el grupo `PERSONAL`.
- **Devoluciones/cambios de un mes**: Suma del costo de todas las líneas de `Cambio` de facturas no eliminadas con fecha del año, dividida entre `12`. Los 12 meses del año muestran ese mismo valor y se recalcula cada vez que entra un Cambio. El total del año es la suma completa.
- **Utilidad neta 1**: `Utilidad bruta - Gastos del negocio - Devoluciones/cambios`.
- **Utilidad neta 2**: `Utilidad neta 1 - Gastos personales`.
- **Salidas del año**: Suma de gastos del negocio y personales de los 12 meses del año (reales en meses pasados y mes en curso; presupuesto en meses futuros). **No incluye** `Devoluciones/cambios` porque no es dinero que sale.
- **Multiplicador de una categoría**: Lo facturado de esa categoría (`cantidad * precio` de líneas normales de facturas válidas) en los últimos 12 meses contados hacia atrás desde hoy, dividido entre el FOB de esas mismas piezas (`cantidad * FOB por unidad del lote de donde salió cada pieza`). Mientras no haya cerrado el primer mes del sistema se usa el multiplicador inicial escrito en Caja.
- **Multiplicador general**: Todo lo facturado dividido entre todo el FOB de esas piezas (todas las categorías juntas).
- **FOB de un pedido**: Si ya se marcó "Proveedor pagado completo": la suma de todos los pagos al proveedor (`FOB real`). Si no: la suma de `cantidad * FOB por unidad` de las líneas del pedido (`FOB estimado`).
- **Gastos de un pedido**: Mientras no se recibe: `FOB del pedido * porcentaje de aduana del pedido`. Después de recibido: la suma de los gastos reales ingresados al recibirlo.
- **Deuda de un pedido**: `(FOB - pagos al proveedor) + (gastos - pagos de gastos)`.
- **Pedido activo**: Un pedido que todavía no se recibe, o que ya se recibió pero todavía tiene deuda (`deuda > 0`).
- **Caja Kolben**: `Efectivo + cheques en mano + suma de cuentas de banco en lempiras + valor en lempiras de la cuenta en dólares + total por cobrar`.
- **Disponible para compras**: `Caja Kolben - suma de la deuda de todos los pedidos activos`.
- **Prueba ácida**: `Caja Kolben / suma de la deuda de todos los pedidos activos`. Verde si `>= 1`; rojo si `< 1`.
- **Valor Kolben hoy**: `Inventario a precio de venta + Disponible para compras`.
- **Valor Kolben futuro**: `Valor Kolben hoy + suma para cada línea de pedidos no recibidos de (cantidad * FOB por unidad * multiplicador de su categoría)`.

### 4.2 Punto de Equilibrio, Meta y Balance
- **Porcentaje bruto del año anterior**: `Utilidad bruta / Ventas` de ese año. Es provisional hasta que ese año se cierra. En el primer año del sistema lo escribe el usuario a mano.
- **Punto de equilibrio del año**: `Salidas del año / Porcentaje bruto del año anterior`.
- **Punto de equilibrio del mes** (se calcula y guarda el día 1 de cada mes en `Cierre de mes`): `(PE del año - Ventas acumuladas hasta el mes anterior) / meses que quedan contando el mes actual`. Si da negativo, se guarda `0`. Los meses que ya pasaron no cambian. El primer mes en que las ventas acumuladas alcanzan el PE del año lleva la etiqueta `"✓ PE cubierto"`; los siguientes, `"cubierto"`.
- **Meta del mes** (se calcula y guarda el día 1): `(Meta anual - Ventas acumuladas hasta el mes anterior) / meses que quedan contando el mes actual`; si da negativo, `0`. Los meses que todavía no llegan se muestran con el mismo cálculo hecho hoy: `(Meta anual - Ventas acumuladas hasta hoy) / meses que faltan`.
- **Balance anual**: `Utilidad bruta del año hasta hoy - Salidas del año`.

### 4.5 Por Cobrar y Clientes
- **Cheque post-fechado**: Ya se resta del saldo y se marca `PENDIENTE` hasta su fecha.
- **Ritmo de compra**: Mediana de los días entre una compra y la siguiente; solo para clientes con **3 compras o más** (facturas válidas).
  - `Próxima compra esperada = última compra + ritmo`.
  - **Ámbar**: Hoy ya pasó la próxima esperada (`días sin comprar > ritmo`).
  - **Rojo**: Pasó una vez y media el ritmo sin comprar (`días sin comprar > 1.5 * ritmo`).
  - **Sin comprar hace mucho**: Más de tres veces el ritmo (`días sin comprar > 3 * ritmo`).
- **Ticket promedio**: `Compras del año / número de facturas válidas del año`.
- **Margen del cliente**: `Utilidad bruta / Ventas` del cliente.

### 4.6 Calculadora (por código)
- **Llegada del pedido**: `mes del pedido + 5 meses de tránsito` (valor fijo del sistema).
- **Llegada del pedido siguiente**: `el siguiente mes del ciclo + 5 meses`.
- **Ventana**: Meses que el pedido debe cubrir: desde su llegada hasta el mes anterior a la llegada del pedido siguiente.
- **Demanda**: Unidades vendidas en esos mismos meses del año anterior. Si en uno de esos meses el código estuvo sin stock, se usa el promedio de los meses en que sí tuvo stock ese año. Para el primer año (2027) se usa el año base 2026. Solo se mira un año hacia atrás.
- **Stock al llegar**: Simulación mes a mes desde hoy: `stock - demanda de cada mes + llegadas de pedidos activos con fecha`. Un pedido sin fecha de llegada no se cuenta y muestra aviso.
- **Calculado**: `(demanda ventana - stock al llegar)` (si da negativo, `0`), multiplicado por `(1 + % stock extra)`, redondeado hacia arriba al `empaque` de la categoría y con **mínimo de 50 unidades** cuando es mayor que cero. Un código sin datos del año anterior da `0`.
- **Final**: `Calculado + Ajuste`.
- **FOB por unidad propuesto**: El del lote más reciente del código (editable).
- **Aduana aproximada**: `FOB total * promedio del % real de aduana de los últimos 5 pedidos recibidos` (si hay menos de 5, el promedio de los que haya; si no hay ninguno, `35%`).
- **Total a invertir**: `FOB total + Aduana aproximada`; se compara con el `Disponible para compras`.

### 4.7 Recepción y Costeo de un Pedido
- **FOB real**: Suma de todos los pagos al proveedor (al marcar "Proveedor pagado completo").
- **FOB por unidad real de cada línea**: `FOB por unidad estimado * (FOB real / FOB estimado)`.
- **Gasto de cada línea**: `Gastos reales * (CBM por unidad * cantidad de la línea) / CBM total`.
- **Costo por unidad**: `FOB por unidad real + (Gasto de la línea / cantidad)`.
- **Bloqueos y avisos**:
  - **Bloquea** si la suma de `(costo por unidad * cantidad)` no cuadra al centavo con `FOB real + gastos reales` (el sistema deja la diferencia de redondeo en la última línea) o si el CBM total no coincide con el CBM del packing list.
  - **Avisa sin bloquear** si el `% real de aduana` (`gastos reales / FOB real`) se aleja del promedio de los últimos 5 pedidos o si un costo por unidad cambia más de `20%` contra el lote anterior del código.
  - **Variación por código**: `costo por unidad de este pedido - costo del lote anterior` (`SUBIÓ`, `= SE MANTUVO` dentro de `±1%`, `BAJÓ`, o `NUEVO`).

---

## 5. Eventos, Procesos Automáticos y Arranque

### 5.1 Procesos Automáticos (Sección 7)
1. **Cierre de mes (Día 1, 00:00 hora HN)**:
   - Crea el registro `Cierre de mes` del mes nuevo con su PE y meta fijos. (El del primer mes del sistema se crea al cerrar el arranque con la primera venta).
   - Todo código que empiece el mes con `stock = 0` queda registrado en `Mes sin stock` para ese mes.
   - Gastos fijos y presupuesto del mes cerrado quedan como reales; variables quedan en su último valor.
   - Tras el primer mes del sistema, los multiplicadores iniciales se reemplazan por los calculados.
2. **Cierre de año (Botón manual "Cerrar año")**:
   - Fija el `% bruto` de ese año, deja definitivo el PE del año nuevo y vuelve el año de solo lectura. "Reabrir" pide confirmación y queda en `Historial`.
3. **Respaldo semanal (Día configurado, por defecto lunes)**:
   - Envía por correo el PDF completo de `Por cobrar` agrupado por zona y ciudad.

### 5.2 Arranque / Carga Inicial (Sección 8)
- Mientras **no exista ninguna factura de POS** (`Factura` con `cargaInicial = false`), el sistema está **"en arranque"** y muestra los campos especiales:
  1. En **Productos (`+ Nuevo código`)**: muestra `Stock inicial`, `FOB por unidad` y `Costo por unidad` → crea el lote `INICIAL`.
  2. En **Ventas**: muestra el botón `+ Factura inicial` (crea factura con `cargaInicial = true`, sin líneas, y un abono con medio `CARGA_INICIAL` por lo ya abonado) y la opción `Corregir saldo` (con motivo obligatorio).
  3. En **Caja**: permite escribir `% bruto` manual del año anterior y los `multiplicadores iniciales` por categoría.
- **La primera venta de POS** oculta los campos de arranque para siempre y crea el registro `Cierre de mes` del mes en curso.

---

## 6. Ejemplos con Números (Sección 11 — Casos de Prueba Exactos)

1. **11.1 Ventas y U.B. del mes**: Ventas `L 116,954.10` − Costo `L 75,669.30` = U.B. `L 41,284.80` (`35.3%`).
2. **11.2 Costo FIFO de dos lotes**: Venta de 10 u de `47201-60460`. Lote viejo: `4 u * L 238.20 = L 952.80`; siguiente: `6 u * L 248.10 = L 1,488.60`. Costo línea = `L 2,441.40`. Quedan `0` y `32` u.
3. **11.3 Rechazo parcial en factura**: Factura `#1488` (20 ago): `16 * 720 + 16 * 420 = L 18,240.00`, abonos `L 11,460.00`, saldo `L 6,780.00`. En octubre rechaza 2 u de `47201-60460` (costo `248.10`): nuevo total `L 16,800.00`, nuevo saldo `L 5,340.00`. Ventas de **agosto** bajan `L 1,440.00`, costo de agosto baja `L 496.20`, U.B. de agosto baja `L 943.80`, y 2 piezas vuelven a su lote original.
4. **11.5 Devoluciones/cambios entre 12**: Costo acumulado de Cambios `L 1,898` (`L 158.17/mes`). Entra Cambio de `L 300` → nuevo total `L 2,198.00` (`L 183.17/mes`). Los 12 meses suben `L 25.00` y U.N.1 y U.N.2 de cada mes bajan `L 25.00`.
5. **11.6 y 11.7 Punto de equilibrio**: Salidas `L 562,449.77` / `% bruto 0.43` = PE anual `L 1,308,022.72`.
   - Enero: `1,308,022.72 / 12 = L 109,001.89` (Ventas ene: `610,000`).
   - Febrero: `(1,308,022.72 - 610,000) / 11 = L 63,456.61` (Ventas feb: `322,000`).
   - Marzo: `(1,308,022.72 - 932,000) / 10 = L 37,602.27`.
   - Mayo: `(1,308,022.72 - 1,298,000) / 8 = L 1,252.84` → acumulado a mayo `1,528,000` alcanza PE (`"✓ PE cubierto"`). Junio en adelante: `L 0`.
6. **11.8 Meta mensual**: Meta anual `L 3,000,000`. Enero: `L 250,000.00`. Febrero: `(3,000,000 - 610,000) / 11 = L 217,272.73`. Septiembre (acumulado ene-ago `2,403,296`): `(3,000,000 - 2,403,296) / 4 = L 149,176.00`.
7. **11.9 Balance anual**: U.B. año `1,179,477.02 - 562,449.77 = L 617,027.25`.
8. **11.10 Multiplicador de categoría**: Facturado `6*720 + 4*700 + 5*680 = L 10,520.00`. FOB `6*205 + 4*205 + 5*262 = L 3,360.00`. Multiplicador = `10,520 / 3,360 = 3.13`. (Cambio no cuenta).
9. **11.11 Valor inventario de un lote**: 38 u, FOB `205`, costo `248.10`, mult `2.25` → A costo: `L 9,427.80`; A precio de venta: `L 17,527.50`.
10. **11.12 Caja Kolben, disponible y prueba ácida**: `25,000 + 105,126.25 + 132,123.63 + 24,600 + 115,384 = L 402,233.88`. Disponible = `402,233.88 - 89,586.20 = L 312,647.68`. Prueba ácida = `402,233.88 / 89,586.20 = 4.49` (verde).
11. **11.14 Costo al recibir pedido**: A (`100 u`, FOB est `60`, CBM `0.03`), B (`50 u`, FOB est `80`, CBM `0.04`). FOB est `10,000`, FOB real `10,200` (factor `1.02` → FOB real A `61.20`, B `81.60`). CBM A `3.0`, B `2.0` (total `5.0`). Gastos reales `3,500` → A `2,100` (`21/u`), B `1,400` (`28/u`). Costo/u: A `L 82.20`, B `L 109.60`. Total `L 13,700.00` (`34.3%` aduana).
12. **11.15 Calculadora**: Marzo 2027, ciclo mar/sep. Llegada ago 2027, siguiente feb 2028 (ventana 6 meses: ago-ene, demanda `12+16+14+10+18+30 = 100 u`). Stock hoy `60 - (8+9+7+6+10) + 20 (pedido abr) = 40 u` al llegar. Calculado: `(100 - 40) * 1.15 = 69` → redondeado a empaque 10 = `70 u` (`>= 50`). FOB `70 * 205 = L 14,350.00`, aduana 35% `L 5,022.50`, total `L 19,372.50`.
13. **11.16 Ritmo de compra**: Compras 1 mar, 31 mar (30d), 5 may (35d), 20 jun (46d). Mediana = `35 días`. Próxima esperada = `20 jun + 35d = 25 jul`. Ámbar desde `26 jul`; Rojo (`> 52.5d`) desde `12 ago`; Sin comprar hace mucho (`> 105d`) después del `3 oct`.

