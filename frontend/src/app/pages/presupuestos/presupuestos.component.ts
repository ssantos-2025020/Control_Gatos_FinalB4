import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { AuthService } from '../../services/auth.service';
import { CategoriasService, Categoria } from '../../services/categorias.service';
import { GastosService, Gasto } from '../../services/gastos.service';
import { CurrencyService } from '../../services/currency.service';
import { FiltroFechaService } from '../../services/filtro-fecha.service';
import { crearFiltrosAnteriores } from '../../utils/filtros-record';
import { SelectorMesComponent } from '../../components/selector-mes/selector-mes.component';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { LucideIconComponent } from '../../components/lucide-icon/lucide-icon.component';
import { PRESUPUESTOS_BASE } from '../../services/mock-data';

const LIMITES_KEY = 'cg_presupuestos';
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type EstadoPresupuesto = 'Bien' | 'Precaución' | 'Alerta';

interface PresupuestoItem {
  nombre: string;
  icono: string;
  color: string;
  limiteUSD: number;
  gastadoUSD: number;
  disponibleUSD: number;
  porcentaje: number;
  estado: EstadoPresupuesto;
  barColor: string;
  superado: boolean;
}

interface HistorialItem {
  label: string;
  presupuesto: string;
  gastado: string;
  porcentaje: number;
  estado: EstadoPresupuesto;
}



@Component({
  selector: 'app-presupuestos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, BaseChartDirective, SelectorMesComponent, SidebarComponent, LucideIconComponent],
  templateUrl: './presupuestos.component.html',
  styleUrls: ['../dashboard/dashboard.component.css', './presupuestos.component.css'],
})
export class PresupuestosComponent implements OnInit, OnDestroy {
  Math = Math;
  MESES_LARGOS = MESES_LARGOS;
  private authService = inject(AuthService);
  private categoriasService = inject(CategoriasService);
  private gastosService = inject(GastosService);
  private fb = inject(FormBuilder);
  currencyService = inject(CurrencyService);
  filtroFecha = inject(FiltroFechaService);

  usuario = this.authService.getUsuario();
  cargando = signal(false);
  errorMsg = signal<string | null>(null);

  gastosTodos = signal<Gasto[]>([]);
  categorias = signal<Categoria[]>([]);
  limites = signal<{ [key: string]: number }>(this.leerLimites());

  colores: { [key: string]: string } = {
    'Alimentacion': '#1268ff',
    'Transporte': '#00b9e8',
    'Vivienda': '#7228e8',
    'Servicios Publicos': '#ff6b9d',
    'Comunicaciones': '#00e7a8',
    'Salud': '#ffa500',
    'Educacion': '#6ea8ff',
    'Entretenimiento': '#c084fc',
    'Ropa y Calzado': '#fbbf24',
    'Compras': '#00d0a8',
    'Viajes': '#ff6b9d',
    'Mascotas': '#a855f7',
    'Seguros': '#1268ff',
    'Impuestos': '#00b9e8',
    'Ahorro e Inversion': '#00e7a8',
    'Otros': '#fbbf24',
    'Comida': '#1268ff',
    'Servicios': '#7228e8',
  };
  colorPorNombre = (nombre: string): string => {
    const map: { [key: string]: string } = {
      'Alimentacion': '#1268ff',
      'Transporte': '#00b9e8',
      'Vivienda': '#7228e8',
      'Servicios Publicos': '#ff6b9d',
      'Comunicaciones': '#00e7a8',
      'Salud': '#ffa500',
      'Educacion': '#6ea8ff',
      'Entretenimiento': '#c084fc',
      'Ropa y Calzado': '#fbbf24',
      'Compras': '#00d0a8',
      'Viajes': '#ff6b9d',
      'Mascotas': '#a855f7',
      'Seguros': '#1268ff',
      'Impuestos': '#00b9e8',
      'Ahorro e Inversion': '#00e7a8',
      'Otros': '#fbbf24',
      'Comida': '#1268ff',
      'Servicios': '#7228e8',
      'Hogar': '#ffa500',
      'Educación': '#6ea8ff',
    };
    return map[nombre] ?? this.colores[nombre] ?? '#94a3b8';
  };

  // Período que se muestra en tarjetas/gráficos (Este mes / Mes anterior)
  periodo = signal<'actual' | 'anterior'>('actual');

  // Filtros de tabla
  filtroSearch = signal('');
  filtroCategoria = signal('');
  filtroEstado = signal<'todos' | EstadoPresupuesto>('todos');

  filtrosAnteriores = crearFiltrosAnteriores<{
    search: string;
    categoria: string;
    estado: 'todos' | EstadoPresupuesto;
  }>();

  // Paginación
  pagina = signal(1);
  readonly porPagina = 6;

  // Modal crear/editar
  mostrarModal = signal(false);
  limiteEditando = signal<string | null>(null);
  limiteForm!: FormGroup;
  guardando = signal(false);
  toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Modal historial
  mostrarHistorial = signal(false);

  // Modal confirmar eliminar
  mostrarConfirmacion = signal(false);
  presupuestoAEliminar = signal<PresupuestoItem | null>(null);

  get mesAnioLabel(): string {
    const { anio, mes } = this.mesVisual();
    return `${MESES_LARGOS[mes - 1]} ${anio}`;
  }

  /** Mes/anio en que se basan los cálculos según el período elegido. */
  mesVisual = computed(() => {
    if (this.periodo() === 'anterior') {
      const d = new Date(this.filtroFecha.anio(), this.filtroFecha.mes() - 2, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
    }
    return { anio: this.filtroFecha.anio(), mes: this.filtroFecha.mes() };
  });

  private gastosDeMes(anio: number, mes: number): Gasto[] {
    return this.gastosTodos().filter((g) => {
      const d = new Date(g.fecha);
      return d.getFullYear() === anio && d.getMonth() + 1 === mes;
    });
  }

  gastosMesActual = computed(() =>
    this.gastosDeMes(this.filtroFecha.anio(), this.filtroFecha.mes()));

  private sumarGastosMes(anio: number, mes: number): number {
    return this.gastosDeMes(anio, mes).reduce((s, g) => s + Number(g.monto), 0);
  }

  /** Gastado por categoría del mes visible (categorías base + resto en Otros). */
  gastosPorCategoria = computed(() => {
    const base = Object.keys(PRESUPUESTOS_BASE);
    const amounts: { [key: string]: number } = {};
    base.forEach((k) => { amounts[k] = 0; });
    this.gastosDeMes(this.mesVisual().anio, this.mesVisual().mes).forEach((g) => {
      const rawName = g.categoria?.nombre || 'Sin Categoría';
      const catName = PRESUPUESTOS_BASE[rawName] !== undefined ? rawName : 'Otros';
      amounts[catName] = (amounts[catName] ?? 0) + Number(g.monto);
    });
    return base.map((name) => ({ name, amountUSD: amounts[name] }));
  });

  limiteEfectivo = (nombre: string, gastado: number): number =>
    this.limites()[nombre] ?? PRESUPUESTOS_BASE[nombre] ?? Math.max(gastado * 1.5, 500);

  private calcularEstado(pct: number): EstadoPresupuesto {
    if (pct > 90) return 'Alerta';
    if (pct >= 60) return 'Precaución';
    return 'Bien';
  }

  private colorBarra(pct: number): string {
    if (pct > 90) return 'linear-gradient(90deg,#ff4259,#ff7a8a)';
    if (pct >= 70) return 'linear-gradient(90deg,#ffa500,#ffc46b)';
    return 'linear-gradient(90deg,#00e7a8,#35d6a5)';
  }

  presupuestos = computed<PresupuestoItem[]>(() =>
    this.gastosPorCategoria().map((c) => {
      const limite = this.limiteEfectivo(c.name, c.amountUSD);
      const porcentaje = limite > 0 ? Math.round((c.amountUSD / limite) * 1000) / 10 : 0;
      return {
        nombre: c.name,
        icono: this.getIconoCategoria(c.name),
        color: this.colorPorNombre(c.name),
        limiteUSD: limite,
        gastadoUSD: c.amountUSD,
        disponibleUSD: Math.max(0, limite - c.amountUSD),
        porcentaje,
        estado: this.calcularEstado(porcentaje),
        barColor: this.colorBarra(porcentaje),
        superado: c.amountUSD > limite,
      };
    })
  );

  presupuestosFiltrados = computed(() => {
    const q = this.filtroSearch().trim().toLowerCase();
    const cat = this.filtroCategoria();
    const estado = this.filtroEstado();
    return this.presupuestos().filter((p) => {
      if (q && !p.nombre.toLowerCase().includes(q)) return false;
      if (cat && p.nombre !== cat) return false;
      if (estado !== 'todos' && p.estado !== estado) return false;
      return true;
    });
  });

  presupuestoTotal = computed(() =>
    this.presupuestos().reduce((s, p) => s + p.limiteUSD, 0));
  gastadoTotal = computed(() =>
    this.presupuestos().reduce((s, p) => s + p.gastadoUSD, 0));
  disponibleTotal = computed(() =>
    Math.max(0, this.presupuestoTotal() - this.gastadoTotal()));

  pctTotal = computed(() =>
    this.presupuestoTotal() > 0 ? Math.round((this.gastadoTotal() / this.presupuestoTotal()) * 1000) / 10 : 0);

  pctDisponible = computed(() =>
    this.presupuestoTotal() > 0 ? Math.round((this.disponibleTotal() / this.presupuestoTotal()) * 1000) / 10 : 0);

  // Comparación vs mes anterior (porcentaje de variación del gasto).
  comparacion = computed(() => {
    const a = this.mesVisual();
    const actual = this.gastadoTotal();
    const d = new Date(a.anio, a.mes - 2, 1);
    const anterior = this.sumarGastosMes(d.getFullYear(), d.getMonth() + 1);
    if (anterior === 0) return { valor: '—', clase: 'neutral' };
    const diff = Math.round(((actual - anterior) / anterior) * 100);
    const sube = diff >= 0;
    return {
      valor: `${sube ? '↑' : '↓'} ${Math.abs(diff)}%`,
      clase: sube ? 'down' : 'up',
    };
  });



  // ===== Donut: distribución del presupuesto =====
  donutData = computed<ChartConfiguration<'doughnut'>['data']>(() => ({
    labels: this.presupuestos().map((p) => p.nombre),
    datasets: [{
      data: this.presupuestos().map((p) => this.currencyService.convertir(p.limiteUSD)),
      backgroundColor: this.presupuestos().map((p) => p.color),
      borderColor: '#0d1224',
      borderWidth: 2,
      hoverOffset: 8,
    }],
  }));

  donutOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#081d38',
        titleColor: '#bcc7e8',
        bodyColor: '#ffffff',
        borderColor: 'rgba(122,160,255,0.3)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 16,
        displayColors: true,
        boxPadding: 6,
        callbacks: {
          title: (item: any) => {
            const p = this.presupuestos()[item.dataIndex];
            return p?.nombre || 'Categoría';
          },
          label: (item: any) => {
            const p = this.presupuestos()[item.dataIndex];
            const val = this.currencyService.formatearValor(Number(item.parsed));
            const pct = p?.porcentaje ?? 0;
            const disponible = this.currencyService.formatear(p?.disponibleUSD || 0);
            return [
              `Presupuesto: ${val}`,
              `Usado: ${pct}%`,
              `Disponible: ${disponible}`,
              `Estado: ${p?.estado || 'Sin definir'}`,
            ];
          },
        },
      },
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1000,
        easing: 'easeOutQuart',
      },
    },
  }));

  // Método helper para validación segura en templates
  hasDonutData(): boolean {
    return this.donutData().datasets && this.donutData().datasets[0] && this.donutData().datasets[0].data && this.donutData().datasets[0].data.length > 0;
  }

  // ===== Gráfico de comparación: Presupuesto vs Gastado =====
  comparisonData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const top5 = this.presupuestos()
      .sort((a, b) => b.limiteUSD - a.limiteUSD)
      .slice(0, 5);

    return {
      labels: top5.map((p) => p.nombre),
      datasets: [
        {
          label: 'Presupuesto',
          data: top5.map((p) => this.currencyService.convertir(p.limiteUSD)),
          backgroundColor: '#1268ff',
          borderColor: '#1268ff',
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 28,
        },
        {
          label: 'Gastado',
          data: top5.map((p) => this.currencyService.convertir(p.gastadoUSD)),
          backgroundColor: '#00e7a8',
          borderColor: '#00e7a8',
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 28,
        },
      ],
    };
  });

  comparisonOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        align: 'center',
        labels: {
          color: '#bcc7e8',
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          padding: 15,
          font: { size: 11, family: 'Inter', weight: 'normal' },
        },
        onClick: (e: any, legendItem: any, legend: any) => {
          const index = legendItem.datasetIndex;
          const ci = legend.chart;
          if (ci.isDatasetVisible(index)) {
            ci.hide(index);
          } else {
            ci.show(index);
          }
        },
      },
      tooltip: {
        backgroundColor: '#081d38',
        titleColor: '#bcc7e8',
        bodyColor: '#ffffff',
        borderColor: 'rgba(122,160,255,0.3)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 16,
        displayColors: true,
        boxPadding: 6,
        callbacks: {
          label: (item: any) => {
            const val = this.currencyService.formatearValor(Number(item.parsed.y));
            const dataset = item.dataset;
            return `${dataset.label}: ${val}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(122,160,255,0.05)', drawBorder: false },
        ticks: { color: '#8290b5', font: { size: 10, family: 'Inter' } },
        border: { display: false },
      },
      y: {
        grid: { color: 'rgba(122,160,255,0.08)', drawBorder: false },
        ticks: { color: '#8290b5', font: { size: 10, family: 'Inter' }, callback: (v: any) => this.currencyService.formatearValor(Number(v), 0) },
        border: { display: false },
        beginAtZero: true,
      },
    },
  }));

  hasComparisonData(): boolean {
    return this.comparisonData().datasets && this.comparisonData().datasets[0] && this.comparisonData().datasets[0].data && this.comparisonData().datasets[0].data.length > 0;
  }

  // ===== Historial =====
  historial = computed<HistorialItem[]>(() => {
    const a = this.mesVisual();
    const out: HistorialItem[] = [];
    // Últimos 5 meses previos al visible.
    for (let k = 1; k <= 5; k++) {
      const d = new Date(a.anio, a.mes - 1 - k, 1);
      const anio = d.getFullYear();
      const mes = d.getMonth() + 1;
      const gastado = this.sumarGastosMes(anio, mes);
      const limite = this.presupuestoTotal();
      const pct = limite > 0 ? Math.round((gastado / limite) * 1000) / 10 : 0;
      out.push({
        label: `${MESES[mes - 1]} ${anio}`,
        presupuesto: this.currencyService.formatear(limite),
        gastado: this.currencyService.formatear(gastado),
        porcentaje: pct,
        estado: this.calcularEstado(pct),
      });
    }
    return out;
  });

  // ===== Paginación =====
  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.presupuestosFiltrados().length / this.porPagina)));
  paginas = computed(() => Array.from({ length: this.totalPaginas() }, (_, i) => i + 1));
  presupuestosPaginados = computed(() => {
    const inicio = (this.pagina() - 1) * this.porPagina;
    return this.presupuestosFiltrados().slice(inicio, inicio + this.porPagina);
  });

  public irPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas()) this.pagina.set(p);
  }
  public paginaAnterior(): void {
    if (this.pagina() > 1) this.pagina.set(this.pagina() - 1);
  }
  public paginaSiguiente(): void {
    if (this.pagina() < this.totalPaginas()) this.pagina.set(this.pagina() + 1);
  }

  // ===== Filtros =====
  onFiltroCambio(): void {
    this.filtrosAnteriores.descartar();
    this.pagina.set(1);
  }
  limpiarFiltros(): void {
    if (this.filtroSearch().trim() || this.filtroCategoria() || this.filtroEstado() !== 'todos') {
      this.filtrosAnteriores.guardar({
        search: this.filtroSearch(),
        categoria: this.filtroCategoria(),
        estado: this.filtroEstado(),
      });
    }
    this.filtroSearch.set('');
    this.filtroCategoria.set('');
    this.filtroEstado.set('todos');
    this.pagina.set(1);
  }
  restaurarFiltrosAnteriores(): void {
    this.filtrosAnteriores.restaurar((v) => {
      this.filtroSearch.set(v.search);
      this.filtroCategoria.set(v.categoria);
      this.filtroEstado.set(v.estado);
      this.pagina.set(1);
    });
  }
  cambiarPeriodo(): void {
    this.pagina.set(1);
  }

  ngOnInit(): void {
    this.limiteForm = this.fb.group({
      categoria: ['', Validators.required],
      monto: ['', [Validators.required, Validators.min(0.01), this.maxDosDecimalesValidator()]],
      mes: [this.filtroFecha.mes(), Validators.required],
      anio: [this.filtroFecha.anio(), Validators.required],
    });
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  /** Validador: el monto no debe superar 2 decimales. */
  private maxDosDecimalesValidator(): (control: { value: unknown }) => { [key: string]: boolean } | null {
    return (control: { value: unknown }) => {
      const v = control.value;
      if (v === null || v === undefined || v === '') return null;
      const s = String(v);
      const m = s.match(/\.(\d+)$/);
      if (m && m[1].length > 2) {
        return { maxDecimales: true };
      }
      return null;
    };
  }

  /** Formatea el monto con separador de miles y hasta 2 decimales (solo visual). */
  formatMontoInput(valor: string): string {
    let limpio = valor.replace(/[^\d.]/g, '');
    const partes = limpio.split('.');
    if (partes.length > 2) {
      limpio = partes[0] + '.' + partes.slice(1).join('');
    }
    if (partes[1] !== undefined && partes[1].length > 2) {
      limpio = partes[0] + '.' + partes[1].slice(0, 2);
    }
    const [entero, decimal] = limpio.split('.');
    const conMiles = entero ? entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : entero;
    return decimal !== undefined ? `${conMiles}.${decimal}` : conMiles;
  }

  onMontoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formateado = this.formatMontoInput(input.value);
    this.limiteForm.get('monto')?.setValue(formateado, { emitEvent: false });
    input.value = formateado;
  }

  /** Muestra una notificación tipo toast. */
  private mostrarToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2800);
  }

  /** Cierra el modal con la tecla Escape y evita propagación. */
  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.mostrarModal.set(false);
    }
  }

  cargarDatos(): void {
    this.cargando.set(true);
    this.errorMsg.set(null);
    this.categoriasService.getCategoriasCompletas().subscribe({
      next: (cats) => {
        this.categorias.set(cats);
        this.gastosService.getGastosCompletos().subscribe({
          next: (g) => {
            this.gastosTodos.set(g);
            this.cargando.set(false);
          },
          error: () => { this.errorMsg.set('No se pudieron cargar los gastos.'); this.cargando.set(false); },
        });
      },
      error: () => { this.errorMsg.set('No se pudieron cargar las categorías.'); this.cargando.set(false); },
    });
  }

  onMesCambiado(_: { mes: number; anio: number }): void {
    this.cargarDatos();
  }

  // ===== Modal crear / editar =====
  abrirNuevoPresupuesto(): void {
    this.limiteEditando.set(null);
    this.guardando.set(false);
    this.limiteForm.reset({
      categoria: '',
      monto: '',
      mes: this.mesVisual().mes,
      anio: this.mesVisual().anio,
    });
    this.mostrarModal.set(true);
  }

  abrirEditarPresupuesto(item: PresupuestoItem): void {
    this.limiteEditando.set(item.nombre);
    this.guardando.set(false);
    this.limiteForm.reset({
      categoria: item.nombre,
      monto: item.limiteUSD,
      mes: this.mesVisual().mes,
      anio: this.mesVisual().anio,
    });
    this.mostrarModal.set(true);
  }

  guardarLimite(): void {
    if (this.limiteForm.invalid) {
      this.limiteForm.markAllAsTouched();
      return;
    }
    if (this.guardando()) return;
    const categoria = this.limiteForm.value.categoria as string;
    const monto = Number(String(this.limiteForm.value.monto).replace(/,/g, ''));
    const actual = this.limites();
    if (monto > 0) {
      actual[categoria] = monto;
    } else {
      delete actual[categoria];
    }
    this.guardando.set(true);
    this.limites.set({ ...actual });
    this.escribirLimites(actual);
    this.mostrarModal.set(false);
    this.guardando.set(false);
    this.mostrarToast(this.limiteEditando() ? 'Presupuesto actualizado correctamente' : 'Presupuesto guardado correctamente');
  }

  // ===== Eliminar con confirmación =====
  solicitarEliminar(item: PresupuestoItem): void {
    this.presupuestoAEliminar.set(item);
    this.mostrarConfirmacion.set(true);
  }
  cancelarEliminar(): void {
    this.mostrarConfirmacion.set(false);
    this.presupuestoAEliminar.set(null);
  }
  confirmarEliminar(): void {
    const item = this.presupuestoAEliminar();
    if (item) {
      const actual = this.limites();
      delete actual[item.nombre];
      this.limites.set({ ...actual });
      this.escribirLimites(actual);
    }
    this.mostrarConfirmacion.set(false);
    this.presupuestoAEliminar.set(null);
  }

  esLimitePersonalizado = (nombre: string): boolean => !!this.limites()[nombre];

  // ===== Exportar CSV =====
  exportarCSV(): void {
    const filas: string[][] = [['Categoría', 'Presupuesto(USD)', 'Gastado(USD)', 'Disponible(USD)', 'Uso%', 'Estado']];
    this.presupuestosFiltrados().forEach((p) =>
      filas.push([p.nombre, String(p.limiteUSD), String(p.gastadoUSD), String(p.disponibleUSD), `${p.porcentaje}%`, p.estado]));
    const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'legatus-presupuestos.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  getIconoCategoria(nombre?: string): string {
    const n = (nombre || '').toLowerCase();
    if (n.includes('comida')) return 'utensils';
    if (n.includes('transporte')) return 'car';
    if (n.includes('servicio')) return 'zap';
    if (n.includes('entreten')) return 'clapperboard';
    if (n.includes('salud')) return 'heart-pulse';
    if (n.includes('educ')) return 'graduation-cap';
    if (n.includes('hogar')) return 'home';
    if (n.includes('compra')) return 'shopping-bag';
    if (n.includes('viaje')) return 'plane';
    return 'package';
  }

  private leerLimites(): { [key: string]: number } {
    try {
      const raw = localStorage.getItem(LIMITES_KEY);
      return raw ? (JSON.parse(raw) as { [key: string]: number }) : {};
    } catch {
      return {};
    }
  }

  private escribirLimites(limites: { [key: string]: number }): void {
    localStorage.setItem(LIMITES_KEY, JSON.stringify(limites));
  }
}
