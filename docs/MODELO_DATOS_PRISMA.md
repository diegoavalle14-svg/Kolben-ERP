// ==========================================
// Kolben ERP — Modelo de Datos Inicial Prisma
// Fuente: Kolben ERP Documentación Técnica v1.1
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
  id               Int      @id @default(1)
  vendedor         String
  contacto         String
  titularCheques   String?
  porcentajeIsv    Decimal  @default(15) @db.Decimal(5, 2)
  correoRespaldo   String?
  diaRespaldo      Int      @default(1)
  pctMesSinStock   Decimal  @default(100) @db.Decimal(5, 2) // % de días del mes en 0 para mes sin stock
}

model Banco {
  id                Int     @id @default(autoincrement())
  nombre            String
  cuentaEnmascarada String
  orden             Int
  saldoLempiras     Decimal @default(0) @db.Decimal(14, 2)
}

// ------------------------------------------
// 2. Listas y Catálogo Base
// ------------------------------------------

model Categoria {
  id        Int        @id @default(autoincrement())
  nombre    String     @unique
  orden     Int
  empaque   Int        @default(10) // 10 / 20 / 50
  productos Producto[]
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
  id                Int                @id @default(autoincrement())
  codigo            String             @unique
  categoriaId       Int
  marcaId           Int
  descripcion       String             // Una línea por dato
  cbmUnidad         Decimal            @default(0) @db.Decimal(8, 4)
  fotoPath          String?
  activo            Boolean            @default(true)
  posicion          Int
  categoria         Categoria          @relation(fields: [categoriaId], references: [id])
  marca             Marca              @relation(fields: [marcaId], references: [id])
  lotes             Lote[]
  ajustes           AjusteStock[]
  precios           PrecioCliente[]
  lineasProforma    LineaProforma[]
  lineasFactura     LineaFactura[]
  lineasPedido      LineaPedido[]
  ventasBase        VentaBase[]
  mesesSinStock     MesSinStock[]
  periodosSinStock  PeriodoSinStock[]

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
  unidades     Int      // positivo entra, negativo sale
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

model PrecioCliente { // Precio sin ISV
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
  id         Int             @id @default(autoincrement())
  numero     Int             @unique
  clienteId  Int
  fecha      DateTime
  dias       Int
  vence      DateTime
  tipo       TipoVenta       @default(CREDITO)
  aplicaIsv  Boolean         @default(false)
  estado     EstadoProforma  @default(PENDIENTE)
  creadoEn   DateTime        @default(now())
  cliente    Cliente         @relation(fields: [clienteId], references: [id])
  lineas     LineaProforma[]
  factura    Factura?
}

model LineaProforma {
  id             Int        @id @default(autoincrement())
  proformaId     Int
  productoId     Int
  cantidad       Int
  precio         Decimal    @db.Decimal(14, 2)
  precioCambiado Boolean    @default(false)
  tipo           TipoLinea  @default(NORMAL)
  proforma       Proforma   @relation(fields: [proformaId], references: [id], onDelete: Cascade)
  producto       Producto   @relation(fields: [productoId], references: [id])
}

model Factura {
  id             Int            @id @default(autoincrement())
  numero         Int            @unique // Consecutivo interno (no SAR)
  proformaId     Int?           @unique
  clienteId      Int
  fecha          DateTime
  vence          DateTime
  tipo           TipoVenta
  subtotal       Decimal        @db.Decimal(14, 2)
  isv            Decimal        @default(0) @db.Decimal(14, 2)
  total          Decimal        @db.Decimal(14, 2)
  cargaInicial   Boolean        @default(false)
  eliminada      Boolean        @default(false)
  eliminadaEn    DateTime?
  proforma       Proforma?      @relation(fields: [proformaId], references: [id])
  cliente        Cliente        @relation(fields: [clienteId], references: [id])
  lineas         LineaFactura[]
  abonos         Abono[]

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

model LoteConsumo { // Rastrea de qué lote salió cada unidad vendida
  id             Int          @id @default(autoincrement())
  lineaFacturaId Int
  loteId         Int
  cantidad       Int
  costoUnidad    Decimal      @db.Decimal(14, 4)
  lineaFactura   LineaFactura @relation(fields: [lineaFacturaId], references: [id], onDelete: Cascade)
  lote           Lote         @relation(fields: [loteId], references: [id])
}

model Abono {
  id                   Int         @id @default(autoincrement())
  facturaId            Int
  fecha                DateTime
  monto                Decimal     @db.Decimal(14, 2)
  numeroRecibo         String?
  medio                MedioAbono
  chequePendienteHasta DateTime?
  factura              Factura     @relation(fields: [facturaId], references: [id])

  @@index([facturaId])
}

// ------------------------------------------
// 6. Compras y Pedidos
// ------------------------------------------

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
  monto    Decimal        @db.Decimal(14, 2) // Puede ser negativo si hay saldo a favor
  nota     String?
  pedido   Pedido         @relation(fields: [pedidoId], references: [id])
}

model GastoRecepcion {
  id          Int      @id @default(autoincrement())
  pedidoId    Int
  concepto    String   // flete, seguro, aduana, agente, etc.
  monto       Decimal  @db.Decimal(14, 2)
  aproximado  Boolean  @default(false)
  pedido      Pedido   @relation(fields: [pedidoId], references: [id], onDelete: Cascade)
}

// ------------------------------------------
// 7. Caja y Gastos
// ------------------------------------------

model CategoriaGasto {
  id          Int               @id @default(autoincrement())
  nombre      String
  grupo       GrupoGasto
  tipo        TipoGasto
  montoFijo   Decimal?          @db.Decimal(14, 2)
  activaDesde DateTime?
  activaHasta DateTime?
  esSistema   Boolean           @default(false) // Devoluciones / Cambios automáticos
  fijosMes    GastoFijoMes[]
  movimientos MovimientoGasto[]
}

model GastoFijoMes { // Generados automáticamente por mes
  id          Int            @id @default(autoincrement())
  categoriaId Int
  anio        Int
  mes         Int
  monto       Decimal        @db.Decimal(14, 2)
  real        Boolean        @default(false) // true al cerrar mes
  categoria   CategoriaGasto @relation(fields: [categoriaId], references: [id])

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
  id                 Int      @id @default(1)
  efectivo           Decimal  @default(0) @db.Decimal(14, 2)
  cheques            Decimal  @default(0) @db.Decimal(14, 2)
  bancosUsd          Decimal  @default(0) @db.Decimal(14, 2)
  bancosUsdValorL    Decimal  @default(0) @db.Decimal(14, 2)
  actualizadoEn      DateTime @updatedAt
}

model Anio {
  anio                     Int      @id
  metaAnual                Decimal  @default(0) @db.Decimal(14, 2)
  porcentajeBrutoAnterior  Decimal? @db.Decimal(8, 6)
  cerrado                  Boolean  @default(false)
  multiplicadoresIniciales Json?    // Snapshot al inicio
}

model MesContable { // PE y meta se fijan el día 1
  id      Int     @id @default(autoincrement())
  anio    Int
  mes     Int
  peMes   Decimal @db.Decimal(14, 2)
  metaMes Decimal @db.Decimal(14, 2)

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

model PeriodoSinStock { // Abre cuando stock llega a 0, cierra cuando reingresa
  id         Int       @id @default(autoincrement())
  productoId Int
  desde      DateTime
  hasta      DateTime? // null = sigue sin stock
  producto   Producto  @relation(fields: [productoId], references: [id])

  @@index([productoId, desde])
}

model MesSinStock { // Registro del cierre de mes para códigos en cero
  id         Int      @id @default(autoincrement())
  productoId Int
  anio       Int
  mes        Int
  producto   Producto @relation(fields: [productoId], references: [id])

  @@unique([productoId, anio, mes])
}

model Historial { // Bitácora de cambios para auditoría
  id         Int      @id @default(autoincrement())
  entidad    String
  entidadId  String
  campo      String
  antes      String?
  despues    String?
  motivo     String?
  fecha      DateTime @default(now())

  @@index([entidad, entidadId])
}
