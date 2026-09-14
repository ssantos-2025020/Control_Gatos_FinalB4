import { query } from './database.service';

const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia'];

const DESCRIPCIONES_GASTOS = [
  'Compra supermercado',
  'Gasolina',
  'Cena restaurante',
  'Transporte público',
  'Internet',
  'Luz',
  'Agua',
  'Teléfono',
  'Medicamentos',
  'Ropa',
  'Cine',
  'Libros',
  'Hogar',
  'Mascota veterinaria',
  'Seguro',
  'Impuestos',
  'Ahorro',
  'Café',
  'Comida oficina',
  'Uber',
];

const DESCRIPCIONES_INGRESOS = [
  'Sueldo mensual',
  'Bonificación',
  'Venta artículos',
  'Servicios freelance',
  'Intereses',
];

/**
 * Genera datos de prueba para los últimos 4 meses (incluyendo el actual)
 */
export async function seedTestData(): Promise<void> {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;

  // Actualizar gastos existentes que no tienen método
  await updateExistingGastosWithMetodo();

  // Generar datos para 4 meses: actual y 3 anteriores
  for (let i = 0; i < 4; i++) {
    const mes = mesActual - i;
    const anio = mes <= 0 ? anioActual - 1 : anioActual;
    const mesAjustado = mes <= 0 ? mes + 12 : mes;

    await seedGastosParaMes(anio, mesAjustado);
    await seedIngresosParaMes(anio, mesAjustado);
  }

  console.log('Datos de prueba generados exitosamente para los últimos 4 meses');
}

async function updateExistingGastosWithMetodo(): Promise<void> {
  const gastosSinMetodo = await query<{ id: string }>(
    'SELECT id FROM gastos WHERE metodo IS NULL OR metodo = \'\''
  );

  if (gastosSinMetodo.length === 0) {
    console.log('Todos los gastos ya tienen método asignado');
    return;
  }

  for (const gasto of gastosSinMetodo) {
    const metodo = METODOS_PAGO[Math.floor(Math.random() * METODOS_PAGO.length)];
    await query(
      'UPDATE gastos SET metodo = $1 WHERE id = $2',
      [metodo, gasto.id]
    );
  }

  console.log(`Actualizados ${gastosSinMetodo.length} gastos con método de pago`);
}

async function seedGastosParaMes(anio: number, mes: number): Promise<void> {
  // Obtener categorías existentes
  const categorias = await query<{ id: string; nombre: string }>(
    'SELECT id, nombre FROM categorias ORDER BY nombre'
  );

  if (categorias.length === 0) {
    console.log('No hay categorías, saltando seed de gastos');
    return;
  }

  const admin = await query<{ id: string }>(
    'SELECT id FROM usuarios ORDER BY "createdAt" ASC LIMIT 1'
  );
  if (admin.length === 0) {
    console.log('No hay usuarios, saltando seed de gastos');
    return;
  }
  const usuarioId = admin[0].id;

  // Verificar si ya hay datos para este mes
  const existentes = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM gastos 
     WHERE EXTRACT(YEAR FROM fecha) = $1 AND EXTRACT(MONTH FROM fecha) = $2`,
    [anio, mes]
  );

  if (parseInt(existentes[0]?.count || '0') > 0) {
    console.log(`Ya existen gastos para ${mes}/${anio}, saltando`);
    return;
  }

  // Generar entre 15-25 gastos por mes
  const numGastos = 15 + Math.floor(Math.random() * 11);
  const diasEnMes = new Date(anio, mes, 0).getDate();

  for (let i = 0; i < numGastos; i++) {
    const dia = 1 + Math.floor(Math.random() * diasEnMes);
    const categoria = categorias[Math.floor(Math.random() * categorias.length)];
    const metodo = METODOS_PAGO[Math.floor(Math.random() * METODOS_PAGO.length)];
    const descripcion = DESCRIPCIONES_GASTOS[Math.floor(Math.random() * DESCRIPCIONES_GASTOS.length)];
    
    // Monto entre 5 y 500
    const monto = 5 + Math.random() * 495;
    
    const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

    await query(
      `INSERT INTO gastos (id, descripcion, monto, fecha, "categoriaId", "usuarioId", "metodo", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2::numeric, $3::date, $4, $5, $6, now(), now())`,
      [descripcion, monto.toFixed(2), fecha, categoria.id, usuarioId, metodo]
    );
  }

  console.log(`Generados ${numGastos} gastos para ${mes}/${anio}`);
}

async function seedIngresosParaMes(anio: number, mes: number): Promise<void> {
  // Verificar si ya hay datos para este mes
  const existentes = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ingresos 
     WHERE EXTRACT(YEAR FROM fecha) = $1 AND EXTRACT(MONTH FROM fecha) = $2`,
    [anio, mes]
  );

  if (parseInt(existentes[0]?.count || '0') > 0) {
    console.log(`Ya existen ingresos para ${mes}/${anio}, saltando`);
    return;
  }

  // Generar entre 3-6 ingresos por mes
  const numIngresos = 3 + Math.floor(Math.random() * 4);
  const diasEnMes = new Date(anio, mes, 0).getDate();

  for (let i = 0; i < numIngresos; i++) {
    const dia = 1 + Math.floor(Math.random() * diasEnMes);
    const categoria = 'Sueldo'; // Categoría por defecto para ingresos
    const metodo = METODOS_PAGO[Math.floor(Math.random() * METODOS_PAGO.length)];
    const descripcion = DESCRIPCIONES_INGRESOS[Math.floor(Math.random() * DESCRIPCIONES_INGRESOS.length)];
    
    // Monto entre 500 y 5000
    const monto = 500 + Math.random() * 4500;
    
    const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

    // Verificar usuario
    const admin = await query<{ id: string }>(
      'SELECT id FROM usuarios ORDER BY "createdAt" ASC LIMIT 1'
    );
    if (admin.length === 0) {
      console.log('No hay usuarios, saltando seed de ingresos');
      return;
    }
    const usuarioId = admin[0].id;

    await query(
      `INSERT INTO ingresos (id, descripcion, monto, fecha, categoria, metodo, "usuarioId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2::numeric, $3::date, $4, $5, $6, now(), now())`,
      [descripcion, monto.toFixed(2), fecha, categoria, metodo, usuarioId]
    );
  }

  console.log(`Generados ${numIngresos} ingresos para ${mes}/${anio}`);
}
