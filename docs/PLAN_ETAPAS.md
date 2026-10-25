# Kolben ERP — Plan de Trabajo por Etapas

El desarrollo se organiza en 15 etapas (Etapa 0 a Etapa 14), siguiendo el orden de dependencias de negocio:
1. Infraestructura y cimientos base.
2. Catálogo y configuración maestra (productos, clientes).
3. Ciclo de ventas (POS, facturación, cuentas por cobrar).
4. Compras y abastecimiento (lotes, costeo, calculadora de cobertura).
5. Tableros ejecutivos, reportes, flujo de caja y cierre.

---

## Tabla de Etapas

| Etapa | Pantalla (Spec) | Qué se entrega | Criterio de Aceptación ("Listo cuando") | Dependencia |
|---|---|---|---|---|
| **0. Cimientos** | — | Repositorio monorepo; backend y frontend base; conexión Prisma; `/api/health`; scripts de deploy y backup; datos semilla. | Servidor responde `/api/health`; frontend compila; Prisma migra sin errores. | — |
| **1. Entrada y Configuración** | Entrada (Login) + Menú y Config (12) | Login JWT en cookie HttpOnly; creación usuario primer uso; menú lateral fijo (1280px); configuración de vendedor, bancos, ISV, correo de respaldo y regla mes sin stock. | Se inicia y cierra sesión; configuración persiste; rutas protegidas sin token; script CLI de cambio de clave funciona. | 0 |
| **2. Productos** | Productos y Listas (8) | Categorías y marcas con logo y orden; filtros y buscador; CRUD de producto; orden con flechas y posición; campos de arranque (crean Lote Inicial); redimensionado con `sharp`; auditoría. | Orden guardado se respeta en la lista; código con lote inicial cuadra con el valor del inventario. | 1 |
| **3. Ficha de Código** | Ficha de código (9) | Detalle con stock, apartado y disponible; visualización de lotes FIFO; ajustes de stock en dos pasos con motivo; edición del lote Inicial; tracking de `PeriodoSinStock`. | Ajuste descuenta de lote más viejo y suma al más nuevo; fechas de sin stock se abren al quedar en 0 y se cierran al reponer. | 2 |
| **4. Clientes** | Clientes y Ficha (6) | Zonas y ciudades; lista y buscador; alta, edición e inactivación (bloqueado si tiene saldo pendiente); precios por cliente con historial; alerta "sin precio". | Ciudad autoselecciona zona; cliente con saldo no se inactiva; historial de precios almacena cada cambio. | 1, 2 |
| **5. POS · Proformas** | POS · Nueva Venta (1) | Buscador de clientes y códigos; apartado de unidades; líneas con precio lista, precio modificado y línea tipo Cambio; cálculo de %U.B. en pantalla; generación de proforma en PDF; botón "Ingresar Pedido" (factura). | Aparta y libera existencias; PDF coincide con mockup; al ingresar descuenta lotes FIFO registrando `LoteConsumo`. | 2, 3, 4 |
| **6. Ventas y Cobranza** | Ventas · Por Cobrar (7) | Tablero Por cobrar agrupado por zona/ciudad/cliente; historial de ventas y cambios; abonos con recibo y medio de pago; soporte cheque post-fechado; edición y anulación con devolución a lotes; PDF factura y reporte semanal. | Editar o anular devuelve piezas a su lote original; abonos actualizan saldo en vivo; PDF semanal generado. | 5 |
| **7. Ventas por Código** | Ventas por código (2) | Matriz por categoría, marca y producto (Ene-Dic); año base 2026 editable; desde 2027 dinámico según facturas (excluyendo cambios); indicador visual de meses sin stock. | Totales concuerdan con facturas; año base se persiste con historial; marcas de mes en cero visibles. | 6 |
| **8. Utilidad por Código** | Utilidad por código (3) | Drill-down jerárquico: Año -> Categoría -> Marca -> Código; cálculo de ingresos, costo FIFO, utilidad bruta y %U.B.; ordenamiento de marcas por margen. | La utilidad total coincide con la suma de facturas; cambios y facturas de carga inicial quedan excluidos del margen. | 6 |
| **9. Compras · Pedidos** | Pedidos y Recepción (5) | Ciclo de compras con estados (`EN_PRODUCCION`, `EN_CAMINO`, `RECIBIDO`); pagos al proveedor y anticipos de gastos; recepción con gastos reales y prorrateo por CBM; creación automática de lotes con costo final; exportación Excel. | Al recibir el pedido, el costo de los lotes cuadra al centavo con FOB + gastos reales; stock ingresa a bodega. | 2, 3 |
| **10. Compras · Calculadora** | Calculadora de Cobertura (4) | Stock de seguridad y ciclo de pedidos; simulación mes a mes por producto; regla de sustitución de demanda en meses sin stock; ajuste manual de unidades; PDF/Excel de cotización; botón "Ingresar orden nueva". | Los cálculos replican fielmente las fórmulas de la especificación; la orden creada se envía a Pedidos activos. | 7, 9 |
| **11. Caja y Flujo** | Caja y Flujo 12 Meses (10) | Saldos manuales (efectivo, bancos HNL y USD); cálculo de deuda por pedidos y disponible para compras; flujo de 12 meses con gastos fijos y variables; PE y metas fijadas el día 1; cierre anual. | Utilidad neta cuadra con ventas y gastos; edición de gasto fijo permite "solo este mes" o "en adelante". | 6, 9 |
| **12. Resumen Ejecutivo** | Resumen (0) | Dashboard de solo lectura: Ventas, U.B., U.N.1, U.N.2, balance actual; gráfica de ventas vs PE y meta; prueba ácida, multiplicadores de inventario; pedidos en camino. | Todas las métricas concuerdan en tiempo real con sus respectivos módulos de origen. | 6, 9, 11 |
| **13. Catálogo PDF** | Catálogo (11) | Grilla previa; subida de portada personalizada; selección de paleta; exportación PDF a 6 fichas por página en el orden estricto de Productos; filtrado de artículos sin disponible. | El PDF generado respeta el orden configurado sin mostrar precios; productos sin stock quedan omitidos. | 2 |
| **14. Cierre y Salida a Producción** | Todas | Automatización de cron jobs en servidor (cierre de mes y respaldos periódicos); pruebas punta a punta; guía para carga inicial de datos por pantalla. | Ciclo completo validado con datos de prueba; pruebas de restauración de backup exitosas. | 0–13 |
