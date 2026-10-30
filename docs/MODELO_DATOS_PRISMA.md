// ==========================================
// Kolben ERP — Modelo de Datos Prisma (v1.2)
// Fuente: Especificación Funcional v1.1 (28/10/2026)
// ==========================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ------------------------------------------
// Enums
// ------------------------------------------

enum TipoVenta {
  CREDITO
  CONTADO
}

enum EstadoProforma {
  PENDIENTE
  INGRESADA
  ELIMINADA
}

enum TipoLinea {
  NORMAL
  CAMBIO
}

enum EstadoPedido {
  EN_PRODUCCION
  EN_CAMINO
  RECIBIDO
}

enum TipoPagoPedido {
  PROVEEDOR
  GASTOS
}

enum MedioAbono {
  EFECTIVO
  TRANSFERENCIA
  CHEQUE
  DEVOLUCION
  CARGA_INICIAL
}

enum GrupoGasto {
  NEGOCIO
  PERSONAL
}

enum TipoGasto {
  FIJO
  VARIABLE
}

// ------------------------------------------
// 1. Acceso y Configuración
// ------------------------------------------

model Usuario {
  id           Int      @id @default(autoincrement())
  usuario      String   @unique
  passwordHash String
  creadoEn     DateTime @default(now())
}

model Configuracion { // Registro único (id = 1)
  id             Int      @id @default(1)
  vendedor       String
  contacto       String
  titularCheques String?
  porcentajeIsv  Decimal  @default(15) @db.Decimal(5, 2)
  correoRespaldo String?
  diaRespaldo    Int      @default(1)
  portadaPath    String?  // Portada del catálogo PDF
  paletaCatalogo String   @default("SISTEMA_KOLBEN")
}

model Banco { // Bancos autorizados que aparecen en la proforma
  id                Int    @id @default(autoincrement())
  nombre            String
  cuentaEnmascarada String
  orden             Int
}

// ------------------------------------------
// 2. Listas y Catálogo Base
// ------------------------------------------

model Categoria {
  id            Int        @id @default(autoincrement())
  nombre        String     @unique
  orden         Int
  empaque       Int        @default(10) // 10 / 20 / 50
  multiplicador Decimal    @default(2.0) @db.Decimal(6, 3)
  productos     Producto[]
}

model Marca {
  id        Int        @id @default(autoincrement())
  nombre    String     @unique
  logoPath  String?
  orden     Int
  productos Producto[]
}

model Zona {
  id       Int      @id @default(autoincrement())
  nombre   String   @unique
  orden    Int
  ciudades Ciudad[]
}

model Ciudad {
  id       Int       @id @default(autoincrement())
  nombre   String
  orden    Int
  zonaId   Int
  zona     Zona      @relation(fields: [zonaId], references: [id])
  clientes Cliente[]
}

// ------------------------------------------
// 3. Productos e Inventario FIFO
// ------------------------------------------

model Producto {
  id                  Int                   @id @default(autoincrement())
  codigo              String                @unique
  categoriaId         Int
  marcaId             Int
  descripcion         String                // Una línea por dato
  cbmUnidad           Decimal               @default(0) @db.Decimal(8, 4)
  fotoPath            String?
  activo              Boolean               @default(true)
  posicion            Int
  categoria           Categoria             @relation(fields: [categoriaId], references: [id])
  marca               Marca                 @relation(fields: [marcaId], references: [id])
  lotes               Lote[]
  ajustes             AjusteStock[]
  precios             PrecioCliente[]
  lineasProforma      LineaProforma[]
  lineasFactura       LineaFactura[]
  lineasPedido        LineaPedido[]
  ventasBase          VentaBase[]
  mesesSinStock       MesSinStock[]
  periodosSinStock    PeriodoSinStock[]
  borradorCalculadora BorradorCalculadora?

  @@index([categoriaId, marcaId, posicion])
}

model Lote { // FIFO: Se descuenta del más viejo con quedan > 0
  id            Int           @id @default(autoincrement())
  productoId    Int
  pedidoId      Int?          // null = Lote Inicial
  esInicial     Boolean       @default(false)
  fechaRecibido DateTime
  cantidad      Int
  quedan        Int
  fobUnidad     Decimal       @db.Decimal(14, 4)
  aduanaUnidad  Decimal       @db.Decimal(14, 4)
  costoUnidad   Decimal       @db.Decimal(14, 4)
  producto      Producto      @relation(fields: [productoId], references: [id])
  pedido        Pedido?       @relation(fields: [pedidoId], references: [id])
  consumos      LoteConsumo[]

  @@index([productoId, fechaRecibido])
}

model AjusteStock {
  id           Int      @id @default(autoincrement())
  productoId   Int
  fecha        DateTime @default(now())
  unidades     Int      // positivo entra (al más nuevo), negativo sale (del más viejo)
  motivo       String
  stockAntes   Int
  stockDespues Int
  producto     Producto @relation(fields: [productoId], references: [id])
}

// ------------------------------------------
// 4. Clientes y Precios
// ------------------------------------------

model Cliente {
  id          Int             @id @default(autoincrement())
  codigo      String          @unique
  nombre      String
  ciudadId    Int
  direccion   String?
  contacto    String?
  diasCredito Int             @default(0)
  aplicaIsv   Boolean         @default(false)
  activo      Boolean         @default(true)
  ciudad      Ciudad          @relation(fields: [ciudadId], references: [id])
  precios     PrecioCliente[]
  proformas   Proforma[]
  facturas    Factura[]
}

model PrecioCliente { // Precio sin ISV; cada cambio va a Historial
  id         Int      @id @default(autoincrement())
  clienteId  Int
  productoId Int
  precio     Decimal  @db.Decimal(14, 2)
  fecha      DateTime @default(now())
  cliente    Cliente  @relation(fields: [clienteId], references: [id])
  producto   Producto @relation(fields: [productoId], references: [id])

  @@unique([clienteId, productoId])
}

// ------------------------------------------
// 5. Proformas, Facturas y Cobranza
// ------------------------------------------

model Proforma {
  id        Int             @id @default(autoincrement())
  numero    Int             @unique
  clienteId Int
  fecha     DateTime
  dias      Int
  vence     DateTime
  tipo      TipoVenta       @default(CREDITO)
  aplicaIsv Boolean         @default(false)
  estado    EstadoProforma  @default(PENDIENTE)
  creadoEn  DateTime        @default(now())
  cliente   Cliente         @relation(fields: [clienteId], references: [id])
  lineas    LineaProforma[]
  factura   Factura?
}

model LineaProforma {
  id             Int       @id @default(autoincrement())
  proformaId     Int
  productoId     Int
  cantidad       Int
  precio         Decimal   @db.Decimal(14, 2)
  precioCambiado Boolean   @default(false)
  tipo           TipoLinea @default(NORMAL)
  proforma       Proforma  @relation(fields: [proformaId], references: [id], onDelete: Cascade)
  producto       Producto  @relation(fields: [productoId], references: [id])
}

model Factura {
  id           Int            @id @default(autoincrement())
  numero       Int            @unique // Consecutivo interno (no SAR)
  proformaId   Int?           @unique
  clienteId    Int
  fecha        DateTime
  vence        DateTime
  tipo         TipoVenta
  subtotal     Decimal        @db.Decimal(14, 2)
  isv          Decimal        @default(0) @db.Decimal(14, 2)
  total        Decimal        @db.Decimal(14, 2)
  cargaInicial Boolean        @default(false)
  eliminada    Boolean        @default(false)
  eliminadaEn  DateTime?
  proforma     Proforma?      @relation(fields: [proformaId], references: [id])
  cliente      Cliente        @relation(fields: [clienteId], references: [id])
  lineas       LineaFactura[]
  abonos       Abono[]

  @@index([clienteId, fecha])
  @@index([fecha])
}

model LineaFactura {
  id               Int           @id @default(autoincrement())
  facturaId        Int
  productoId       Int
  descripcion      String        // Snapshot de descripción al facturar
  cantidadOriginal Int
  cantidad         Int           // Se decrementa si se edita por devolución
  precio           Decimal       @db.Decimal(14, 2)
  tipo             TipoLinea     @default(NORMAL)
  costoFifo        Decimal       @default(0) @db.Decimal(14, 4)
  factura          Factura       @relation(fields: [facturaId], references: [id], onDelete: Cascade)
  producto         Producto      @relation(fields: [productoId], references: [id])
  consumos         LoteConsumo[]
}

model LoteConsumo { // Salida por lote: de qué lote salió cada unidad vendida
  id             Int          @id @default(autoincrement())
  lineaFacturaId Int
  loteId         Int
  cantidad       Int
  costoUnidad    Decimal      @db.Decimal(14, 4)
  fobUnidad      Decimal      @default(0) @db.Decimal(14, 4)
  lineaFactura   LineaFactura @relation(fields: [lineaFacturaId], references: [id], onDelete: Cascade)
  lote           Lote         @relation(fields: [loteId], references: [id])
}

model Abono {
  id                   Int        @id @default(autoincrement())
  facturaId            Int
  fecha                DateTime
  monto                Decimal    @db.Decimal(14, 2)
  numeroRecibo         String?
  medio                MedioAbono
  chequePendienteHasta DateTime?
  factura              Factura    @relation(fields: [facturaId], references: [id])

  @@index([facturaId])
}

// ------------------------------------------
// 6. Compras, Calculadora y Pedidos
// ------------------------------------------

model ParametrosCompra { // Registro único (id = 1) de la Calculadora
  id                   Int     @id @default(1)
  mesesCiclo           Int[]   @default([3, 9]) // Ej: marzo (3) y septiembre (9)
  porcentajeStockExtra Decimal @default(15) @db.Decimal(5, 2)
}

model BorradorCalculadora { // Lo que el usuario escribe en la Calculadora hasta ingresar la orden
  id           Int      @id @default(autoincrement())
  productoId   Int      @unique
  ajuste       Int      @default(0)
  fobUnidad    Decimal  @db.Decimal(14, 4)
  escritoAMano Boolean  @default(false)
  producto     Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)
}

model Pedido {
  id               Int              @id @default(autoincrement())
  numero           Int              @unique
  estado           EstadoPedido     @default(EN_PRODUCCION)
  fechaColocado    DateTime
  llegadaAprox     DateTime?
  porcentajeAduana Decimal          @db.Decimal(5, 2)
  fobEstimado      Decimal          @db.Decimal(14, 2)
  fobReal          Decimal?         @db.Decimal(14, 2)
  proveedorPagado  Boolean          @default(false)
  cbmPackingList   Decimal?         @db.Decimal(10, 4)
  recibidoEn       DateTime?
  lineas           LineaPedido[]
  pagos            PagoPedido[]
  gastos           GastoRecepcion[]
  lotes            Lote[]
}

model LineaPedido {
  id         Int      @id @default(autoincrement())
  pedidoId   Int
  productoId Int
  cantidad   Int
  fobUnidad  Decimal  @db.Decimal(14, 4)
  cbmUnidad  Decimal  @db.Decimal(8, 4)
  pedido     Pedido   @relation(fields: [pedidoId], references: [id], onDelete: Cascade)
  producto   Producto @relation(fields: [productoId], references: [id])
}

model PagoPedido {
  id       Int            @id @default(autoincrement())
  pedidoId Int
  fecha    DateTime
  tipo     TipoPagoPedido
  monto    Decimal        @db.Decimal(14, 2) // Puede ser negativo (crédito)
  nota     String?
  pedido   Pedido         @relation(fields: [pedidoId], references: [id])
}

model GastoRecepcion {
  id         Int      @id @default(autoincrement())
  pedidoId   Int
  concepto   String   // flete, seguro, aduana, agente, almacenaje...
  monto      Decimal  @db.Decimal(14, 2)
  aproximado Boolean  @default(false)
  pedido     Pedido   @relation(fields: [pedidoId], references: [id], onDelete: Cascade)
}

// ------------------------------------------
// 7. Caja, Cuentas de Banco y Gastos
// ------------------------------------------

model CuentaBanco { // Cuentas de banco en lempiras de Caja
  id            Int     @id @default(autoincrement())
  nombre        String
  saldoLempiras Decimal @default(0) @db.Decimal(14, 2)
  orden         Int     @default(1)
}

model CategoriaGasto {
  id                 Int                @id @default(autoincrement())
  nombre             String
  grupo              GrupoGasto
  tipo               TipoGasto
  presupuestoMensual Decimal?           @db.Decimal(14, 2) // Para variables en meses futuros
  montoFijo          Decimal?           @db.Decimal(14, 2)
  activaDesde        DateTime?
  activaHasta        DateTime?
  esSistema          Boolean            @default(false)    // Devoluciones/cambios
  fijosMes           GastoFijoMes[]
  montosVigentes     MontoFijoVigente[]
  movimientos        MovimientoGasto[]
}

model MontoFijoVigente { // Cambios de un gasto fijo "en adelante"
  id          Int            @id @default(autoincrement())
  categoriaId Int
  desdeAnio   Int
  desdeMes    Int
  monto       Decimal        @db.Decimal(14, 2)
  creadoEn    DateTime       @default(now())
  categoria   CategoriaGasto @relation(fields: [categoriaId], references: [id], onDelete: Cascade)

  @@index([categoriaId, desdeAnio, desdeMes])
}

model GastoFijoMes { // Monto fijo de un mes específico ("solo este mes" o fijado al cerrar mes)
  id          Int            @id @default(autoincrement())
  categoriaId Int
  anio        Int
  mes         Int
  monto       Decimal        @db.Decimal(14, 2)
  real        Boolean        @default(false)
  categoria   CategoriaGasto @relation(fields: [categoriaId], references: [id], onDelete: Cascade)

  @@unique([categoriaId, anio, mes])
}

model MovimientoGasto { // Gastos variables
  id          Int            @id @default(autoincrement())
  categoriaId Int
  fecha       DateTime
  monto       Decimal        @db.Decimal(14, 2)
  nota        String?
  categoria   CategoriaGasto @relation(fields: [categoriaId], references: [id])
}

model SaldoCaja { // Registro único (id = 1)
  id              Int      @id @default(1)
  efectivo        Decimal  @default(0) @db.Decimal(14, 2)
  cheques         Decimal  @default(0) @db.Decimal(14, 2)
  bancosUsd       Decimal  @default(0) @db.Decimal(14, 2)
  bancosUsdValorL Decimal  @default(0) @db.Decimal(14, 2)
  actualizadoEn   DateTime @updatedAt
}

model Anio {
  anio                     Int       @id
  metaAnual                Decimal   @default(0) @db.Decimal(14, 2)
  porcentajeBrutoAnterior  Decimal?  @db.Decimal(8, 6)
  cerrado                  Boolean   @default(false)
  cerradoEn                DateTime?
  multiplicadoresIniciales Json?     // Snapshot al inicio por categoría
}

model MesContable { // Cierre de mes: PE y meta se fijan el día 1 (y al cerrar el arranque)
  id       Int      @id @default(autoincrement())
  anio     Int
  mes      Int
  peMes    Decimal  @db.Decimal(14, 2)
  metaMes  Decimal  @db.Decimal(14, 2)
  fijadoEn DateTime @default(now())

  @@unique([anio, mes])
}

// ------------------------------------------
// 8. Demanda, Sin Stock y Auditoría
// ------------------------------------------

model VentaBase { // Año base histórico (2026)
  id         Int      @id @default(autoincrement())
  productoId Int
  anio       Int
  mes        Int
  unidades   Int
  producto   Producto @relation(fields: [productoId], references: [id])

  @@unique([productoId, anio, mes])
}

model MesSinStock { // Se registra cuando el stock llega a 0 en cualquier momento del mes, o el día 1 si empieza en 0
  id         Int      @id @default(autoincrement())
  productoId Int
  anio       Int
  mes        Int
  producto   Producto @relation(fields: [productoId], references: [id])

  @@unique([productoId, anio, mes])
}

model PeriodoSinStock { // Historial de fechas en que estuvo en 0
  id         Int       @id @default(autoincrement())
  productoId Int
  desde      DateTime
  hasta      DateTime?
  producto   Producto  @relation(fields: [productoId], references: [id])

  @@index([productoId, desde])
}

model Historial { // Bitácora de cambios para auditoría
  id        Int      @id @default(autoincrement())
  entidad   String
  entidadId String
  campo     String
  antes     String?
  despues   String?
  motivo    String?
  fecha     DateTime @default(now())

  @@index([entidad, entidadId])
}
