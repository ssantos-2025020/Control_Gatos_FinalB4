import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { AuthService } from '../../services/auth.service';
import { GastosService, Gasto } from '../../services/gastos.service';
import { CategoriasService, Categoria } from '../../services/categorias.service';
import { UsuariosService } from '../../services/usuarios.service';
import { CurrencyService } from '../../services/currency.service';
import { ConfigService } from '../../services/config.service';
import { FiltroFechaService } from '../../services/filtro-fecha.service';
import { crearFiltrosAnteriores } from '../../utils/filtros-record';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { LucideIconComponent } from '../../components/lucide-icon/lucide-icon.component';
import { Usuario } from '../../models/usuario.model';

interface DesgloseCategoria {
  nombre: string;
  monto: number;
  porcentaje: number;
  color: string;
}

interface DesgloseMetodo {
  nombre: string;
  monto: number;
  porcentaje: number;
  color: string;
}

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, BaseChartDirective, RouterLink, SidebarComponent, LucideIconComponent],
  templateUrl: './gastos.component.html',
  styleUrls: ['../dashboard/dashboard.component.css', './gastos.component.css'],
})
export class GastosComponent implements OnInit, OnDestroy {
  Math = Math;
  private authService = inject(AuthService);
  private gastosService = inject(GastosService);
  private categoriasService = inject(CategoriasService);
  private usuariosService = inject(UsuariosService);
  private fb = inject(FormBuilder);
  currencyService = inject(CurrencyService);
  configService = inject(ConfigService);
  filtroFecha = inject(FiltroFechaService);

  usuario = this.authService.getUsuario();

  cargando = signal(false);
  errorMsg = signal<string | null>(null);
  guardando = signal(false);
  toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  gastos = signal<Gasto[]>([]);
  categorias = signal<Categoria[]>([]);
  usuarios = signal<Usuario[]>([]);

  // Filtros
  filtroSearch = signal('');
  filtroCategoriaId = signal('');
  filtroUsuario = signal('');
  filtroFechaInicio = signal('');
  filtroFechaFin = signal('');

  filtrosAnteriores = crearFiltrosAnteriores<{
    search: string;
    categoriaId: string;
    usuario: string;
    fechaInicio: string;
    fechaFin: string;
  }>();

  // Dropdown de evolución
  evolucionModo = signal<'dia' | 'semana' | 'total'>('dia');

  // Paginación
  pagina = signal(1);
  readonly porPagina = 5;

  // Modal crear/editar
  mostrarModal = signal(false);
  gastoEditando = signal<Gasto | null>(null);
  gastoForm!: FormGroup;

  // Modal confirmar eliminar
  mostrarConfirmacion = signal(false);
  gastoAEliminar = signal<Gasto | null>(null);

  private coloresCategoria: { [key: string]: string } = {
    'Comida': '#1268ff', 'Transporte': '#00b9e8', 'Servicios': '#7228e8',
    'Entretenimiento': '#ff6b9d', 'Salud': '#00e7a8', 'Hogar': '#ffa500',
    'Compras': '#00d0a8', 'Educación': '#6ea8ff', 'Educacion': '#6ea8ff',
    'Viajes': '#c084fc', 'Otros': '#fbbf24', 'Sin categoría': '#94a3b8',
  };

  private coloresMetodo: { [key: string]: string } = {
    'Efectivo': '#00e7a8', 'Tarjeta': '#a855f7', 'Transferencia': '#1268ff',
  };

  public colorCategoria(nombre?: string): string {
    return this.coloresCategoria[nombre ?? ''] ?? '#94a3b8';
  }

  public colorMetodo(metodo?: string): string {
    return this.coloresMetodo[metodo ?? ''] ?? '#94a3b8';
  }

  public inicialUsuario(nombre?: string | null): string {
    return (nombre || '?').trim().charAt(0).toUpperCase();
  }

  // ===== Computados reactivos (sobre el set filtrado) =====
  gastosFiltrados = computed<Gasto[]>(() => {
    const search = this.filtroSearch().trim().toLowerCase();
    const cat = this.filtroCategoriaId();
    const usr = this.filtroUsuario();
    const ini = this.filtroFechaInicio();
    const fin = this.filtroFechaFin();

    return this.gastos().filter((g) => {
      if (search && !g.descripcion.toLowerCase().includes(search)) return false;
      if (cat && g.categoriaId !== cat) return false;
      if (usr && g.usuario?.nombre !== usr) return false;
      if (ini || fin) {
        const f = new Date(g.fecha).toISOString().substring(0, 10);
        if (ini && f < ini) return false;
        if (fin && f > fin) return false;
      }
      return true;
    });
  });

  /** Gastos del período/mes seleccionado, SIN filtros de tabla: alimenta tarjetas y gráficos. */
  gastosPeriodo = computed<Gasto[]>(() => {
    const mes = this.filtroFecha.mes();
    const anio = this.filtroFecha.anio();
    return this.gastos().filter((g) => {
      const d = new Date(g.fecha);
      return !isNaN(d.getTime()) && d.getMonth() + 1 === mes && d.getFullYear() === anio;
    });
  });

  totalGastadoPeriodoUSD = computed(() => this.gastosPeriodo().reduce((s, g) => s + Number(g.monto), 0));

  totalGastadoPeriodo = computed(() => this.currencyService.formatear(this.totalGastadoPeriodoUSD()));

  totalGastadoUSD = computed(() =>
    this.gastosFiltrados().reduce((s, g) => s + Number(g.monto), 0));

  totalGastado = computed(() => this.currencyService.formatear(this.totalGastadoUSD()));

  cantidadTransacciones = computed(() => {
    const n = this.gastosFiltrados().length;
    return `${n} ${n === 1 ? 'gasto' : 'gastos'}`;
  });

  diasEnRango = computed(() => new Date(this.filtroFecha.anio(), this.filtroFecha.mes(), 0).getDate());

  promedioGasto = computed(() =>
    this.currencyService.formatear(this.totalGastadoPeriodoUSD() / this.diasEnRango()));

  ultimoGasto = computed(() => {
    const gastos = this.gastosPeriodo();
    return gastos.length ? [...gastos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0] : null;
  });

  // ===== Comparación con el período anterior =====
  comparacionPct = computed<number | null>(() => {
    const prev = this.mesAnteriorDe(this.filtroFecha.anio(), this.filtroFecha.mes());
    const previo = this.gastos().reduce((s, g) => {
      const d = new Date(g.fecha);
      return !isNaN(d.getTime()) && d.getFullYear() === prev.anio && d.getMonth() + 1 === prev.mes ? s + Number(g.monto) : s;
    }, 0);
    const actual = this.totalGastadoPeriodoUSD();
    if (!previo) return null;
    return ((actual - previo) / previo) * 100;
  });

  comparacionTexto = computed(() => {
    const p = this.comparacionPct();
    if (p === null || p === undefined) return { valor: '—', clase: 'neutral', icono: 'arrow-right' };
    const n = Math.round(Math.abs(p));
    return p >= 0
      ? { valor: `↑ ${n}%`, clase: 'up', icono: 'arrow-up-right' }
      : { valor: `↓ ${n}%`, clase: 'down', icono: 'arrow-down-right' };
  });

  desglose = computed<DesgloseCategoria[]>(() => {
    const map: { [k: string]: number } = {};
    this.gastosPeriodo().forEach((g) => {
      const nombre = g.categoria?.nombre || 'Sin categoría';
      map[nombre] = (map[nombre] ?? 0) + Number(g.monto);
    });
    const total = this.totalGastadoPeriodoUSD();
    return Object.entries(map)
      .map(([nombre, monto]) => ({
        nombre,
        monto,
        porcentaje: total > 0 ? Math.round((monto / total) * 100) : 0,
        color: this.coloresCategoria[nombre] ?? '#94a3b8',
      }))
      .sort((a, b) => b.monto - a.monto);
  });

  // ===== CHART.JS: Evolución de gastos (por día / semana / total) =====
  evolucionDatos = computed(() => {
    const mapa = new Map<string, number>();
    this.gastosPeriodo().forEach((g) => {
      const fecha = new Date(g.fecha).toISOString().substring(0, 10);
      mapa.set(fecha, (mapa.get(fecha) ?? 0) + Number(g.monto));
    });
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  evolucionSerie = computed(() => {
    const modo = this.evolucionModo();
    const datos = this.evolucionDatos();
    if (modo === 'total') {
      const total = datos.reduce((s, [, v]) => s + v, 0);
      return [{ fecha: this.evolucionDatos().length ? this.evolucionDatos()[0][0] : '', monto: total, label: 'Total' }];
    }
    if (modo === 'semana') {
      const sem: { [k: string]: number } = {};
      datos.forEach(([fecha, v]) => {
        const d = new Date(fecha + 'T00:00');
        const inicio = new Date(d);
        inicio.setDate(inicio.getDate() - inicio.getDay() + 1);
        const key = inicio.toISOString().substring(0, 10);
        sem[key] = (sem[key] ?? 0) + v;
      });
      return Object.entries(sem)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, monto]) => ({ fecha, monto, label: `Semana del ${fecha.slice(8)}/${fecha.slice(5, 7)}` }));
    }
    return datos.map(([fecha, monto]) => ({ fecha, monto, label: fecha }))
      .filter((d) => new Date(d.fecha).getMonth() + 1 === this.filtroFecha.mes());
  });

  evolucionChartType = computed<'line' | 'bar'>(() => {
    return this.evolucionModo() === 'total' ? 'bar' : 'line';
  });

  evolucionLineData = computed<any>(() => {
    const serie = this.evolucionSerie();
    const modo = this.evolucionModo();
    const labelDia = (fecha: string) => this.configService.formatearFecha(fecha);

    // En modo total: gráfica de barras simple
    if (modo === 'total') {
      const totalMonto = serie.reduce((sum, e) => sum + e.monto, 0);
      return {
        labels: ['Total del mes'],
        datasets: [
          {
            type: 'bar',
            label: 'Total',
            data: [this.currencyService.convertir(totalMonto)],
            backgroundColor: '#1268ff',
            borderColor: '#1268ff',
            borderWidth: 1,
            borderRadius: 8,
            barThickness: 60,
          },
        ],
      };
    }

    // Modo día/semana: gráfica de líneas con tendencia y promedio
    const promedioMovil = serie.map((e, i) => {
      if (serie.length < 3) return e.monto;
      const start = Math.max(0, i - 2);
      const end = Math.min(serie.length - 1, i + 2);
      const slice = serie.slice(start, end + 1);
      return slice.reduce((sum, item) => sum + item.monto, 0) / slice.length;
    });

    const promedioGeneral = serie.reduce((sum, e) => sum + e.monto, 0) / serie.length || 0;
    const lineaPromedio = new Array(serie.length).fill(promedioGeneral);

    return {
      labels: serie.map((e) => (modo === 'semana' ? e.label : labelDia(e.fecha))),
      datasets: [
        {
          type: 'line',
          label: 'Gastos',
          data: serie.map((e) => this.currencyService.convertir(e.monto)),
          borderColor: '#1268ff',
          backgroundColor: (ctx: any) => {
            const chart = ctx.chart;
            if (!chart.chartArea) return 'rgba(18,104,255,0.1)';
            const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
            g.addColorStop(0, 'rgba(18,104,255,0.35)');
            g.addColorStop(1, 'rgba(18,104,255,0.05)');
            return g;
          },
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 2,
          pointHoverRadius: 6,
          pointBackgroundColor: '#1268ff',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          order: 1,
        },
        {
          type: 'line',
          label: 'Tendencia',
          data: promedioMovil.map((v) => this.currencyService.convertir(v)),
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#f59e0b',
          order: 2,
        },
        {
          type: 'line',
          label: 'Promedio',
          data: lineaPromedio.map((v) => this.currencyService.convertir(v)),
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderDash: [10, 5],
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          order: 3,
        },
      ],
    };
  });

  evolucionLineOptions = computed<any>(() => {
    const modo = this.evolucionModo();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: modo !== 'total',
          position: 'top',
          align: 'end',
          labels: {
            color: '#bcc7e8',
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            padding: 15,
            font: { size: 11, family: 'Inter', weight: 'normal' },
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
          boxPadding: 8,
          callbacks: {
            title: (items: any) => items[0]?.label || '',
            label: (item: any) => {
              const val = this.currencyService.formatearValor(Number(item.parsed.y ?? item.parsed));
              const dataset = item.dataset;
              let label = dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += val;
              return label;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(122,160,255,0.05)', drawBorder: false },
          ticks: { color: '#8290b5', font: { size: 10, family: 'Inter' }, maxTicksLimit: 12 },
          border: { display: false }
        },
        y: {
          grid: { color: 'rgba(122,160,255,0.08)', drawBorder: false },
          ticks: { color: '#8290b5', font: { size: 10, family: 'Inter' }, callback: (v: any) => this.currencyService.formatearValor(Number(v), 0) },
          border: { display: false },
          beginAtZero: true,
        },
      },
    };
  });

  // ===== CHART.JS: Donut gastos por categoría =====
  donutGastosData = computed<ChartConfiguration<'doughnut'>['data']>(() => ({
    labels: this.desglose().map((d) => d.nombre),
    datasets: [{
      data: this.desglose().map((d) => this.currencyService.convertir(d.monto)),
      backgroundColor: this.desglose().map((d) => d.color),
      borderColor: '#071a33',
      borderWidth: 2,
      hoverBorderColor: '#1e293b',
      hoverOffset: 10,
      hoverBorderWidth: 3,
    }],
  }));

  donutGastosOptions = computed<ChartOptions<'doughnut'>>(() => ({
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
            const d = this.desglose()[item.dataIndex];
            return d?.nombre || 'Categoría';
          },
          label: (item: any) => {
            const d = this.desglose()[item.dataIndex];
            const val = this.currencyService.formatearValor(Number(item.parsed));
            const pct = d?.porcentaje ?? 0;
            return [
              `Gastado: ${val}`,
              `Porcentaje: ${pct}%`,
              `Color: ${d?.color || '#94a3b8'}`,
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

  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.gastosFiltrados().length / this.porPagina)));

  paginas = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, i) => i + 1));

  gastosPaginados = computed(() => {
    const inicio = (this.pagina() - 1) * this.porPagina;
    return this.gastosFiltrados().slice(inicio, inicio + this.porPagina);
  });

  public irPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas()) this.pagina.set(p);
  }

  // ===== Métodos de pago =====
  desgloseMetodos = computed<DesgloseMetodo[]>(() => {
    const map: { [k: string]: number } = {};
    this.gastosPeriodo().forEach((g) => {
      const nombre = g.metodo ?? 'Efectivo';
      map[nombre] = (map[nombre] ?? 0) + Number(g.monto);
    });
    const total = this.totalGastadoPeriodoUSD();
    const orden: { [k: string]: number } = { 'Efectivo': 0, 'Tarjeta': 1, 'Transferencia': 2 };
    return Object.entries(map)
      .map(([nombre, monto]) => ({
        nombre,
        monto,
        porcentaje: total > 0 ? Math.round((monto / total) * 1000) / 10 : 0,
        color: this.coloresMetodo[nombre] ?? '#94a3b8',
      }))
      .sort((a, b) => (orden[a.nombre] ?? 9) - (orden[b.nombre] ?? 9));
  });

  donutMetodosData = computed<ChartConfiguration<'doughnut'>['data']>(() => ({
    labels: this.desgloseMetodos().map((d) => d.nombre),
    datasets: [{
      data: this.desgloseMetodos().map((d) => this.currencyService.convertir(d.monto)),
      backgroundColor: this.desgloseMetodos().map((d) => d.color),
      borderColor: '#0d1224',
      borderWidth: 2,
      hoverBorderColor: '#1e293b',
      hoverOffset: 10,
      hoverBorderWidth: 3,
    }],
  }));

  donutMetodosOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f1630',
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
            const d = this.desgloseMetodos()[item.dataIndex];
            return d?.nombre || 'Método';
          },
          label: (item: any) => {
            const d = this.desgloseMetodos()[item.dataIndex];
            const val = this.currencyService.formatearValor(Number(item.parsed));
            const pct = d?.porcentaje ?? 0;
            return [
              `Monto: ${val}`,
              `Porcentaje: ${pct}%`,
              `Color: ${d?.color || '#94a3b8'}`,
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

  ngOnInit(): void {
    this.gastoForm = this.fb.group({
      descripcion: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      monto: ['', [Validators.required, Validators.min(0.01), this.maxDosDecimalesValidator()]],
      fecha: [this.filtroFecha.hoyIso(), [Validators.required, this.noFechaFuturaValidator()]],
      categoriaId: ['', [Validators.required]],
      metodo: ['Efectivo'],
      usuarioId: [''],
    });
    this.filtroFechaInicio.set(this.mesInicioIso());
    this.filtroFechaFin.set(this.mesFinIso());
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  private mesInicioIso(): string {
    const m = this.filtroFecha.mes();
    const a = this.filtroFecha.anio();
    return `${a}-${String(m).padStart(2, '0')}-01`;
  }

  private mesFinIso(): string {
    const m = this.filtroFecha.mes();
    const a = this.filtroFecha.anio();
    return `${a}-${String(m).padStart(2, '0')}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
  }

  private mesAnteriorDe(y: number, m: number): { anio: number; mes: number } {
    return { anio: m === 1 ? y - 1 : y, mes: m === 1 ? 12 : m - 1 };
  }

  public cargarDatos(): void {
    this.cargando.set(true);
    this.errorMsg.set(null);

    this.categoriasService.getCategoriasCompletas().subscribe({
      next: (cats) => this.categorias.set(cats),
      error: () => this.errorMsg.set('No se pudieron cargar las categorías.'),
    });

    this.usuariosService.getUsuariosCompletos().subscribe({
      next: (list) => this.usuarios.set(list),
      error: () => { /* el dropdown queda con solo "Todos" */ },
    });

    this.gastosService.getGastosCompletos().subscribe({
      next: (list) => {
        this.gastos.set(list);
        this.pagina.set(1);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.errorMsg.set('No se pudieron cargar los gastos.');
        console.error(err);
      },
    });
  }

  public limpiarFiltros(): void {
    if (
      this.filtroSearch().trim() || this.filtroCategoriaId() || this.filtroUsuario() ||
      this.filtroFechaInicio() !== this.mesInicioIso() || this.filtroFechaFin() !== this.mesFinIso()
    ) {
      this.filtrosAnteriores.guardar({
        search: this.filtroSearch(),
        categoriaId: this.filtroCategoriaId(),
        usuario: this.filtroUsuario(),
        fechaInicio: this.filtroFechaInicio(),
        fechaFin: this.filtroFechaFin(),
      });
    }
    this.filtroSearch.set('');
    this.filtroCategoriaId.set('');
    this.filtroUsuario.set('');
    this.filtroFechaInicio.set(this.mesInicioIso());
    this.filtroFechaFin.set(this.mesFinIso());
    this.pagina.set(1);
  }

  public restaurarFiltrosAnteriores(): void {
    this.filtrosAnteriores.restaurar((v) => {
      this.filtroSearch.set(v.search);
      this.filtroCategoriaId.set(v.categoriaId);
      this.filtroUsuario.set(v.usuario);
      this.filtroFechaInicio.set(v.fechaInicio);
      this.filtroFechaFin.set(v.fechaFin);
      this.pagina.set(1);
    });
  }

  public resetRango(): void {
    this.filtrosAnteriores.descartar();
    this.filtroFechaInicio.set(this.mesInicioIso());
    this.filtroFechaFin.set(this.mesFinIso());
    this.pagina.set(1);
  }

  public onFiltroCambio(): void {
    this.filtrosAnteriores.descartar();
    this.pagina.set(1);
  }

  // ===== Modal crear / editar =====
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

  /** Validador: no permitir fechas futuras (el proyecto no maneja gastos programados). */
  private noFechaFuturaValidator(): (control: { value: string | null }) => { [key: string]: boolean } | null {
    return (control: { value: string | null }) => {
      const v = control.value;
      if (!v) return null;
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fecha = new Date(v);
      const errores: { [key: string]: boolean } = {};
      if (isNaN(fecha.getTime())) {
        errores['fechaInvalida'] = true;
        return errores;
      }
      if (fecha.getTime() > hoy.getTime()) {
        errores['fechaFutura'] = true;
        return errores;
      }
      return null;
    };
  }

  /** Formatea el monto con separador de miles y hasta 2 decimales (solo visual). */
  formatMontoInput(valor: string): string {
    // Conserva solo dígitos y un punto decimal
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
    this.gastoForm.get('monto')?.setValue(formateado, { emitEvent: false });
    input.value = formateado;
  }

  /** Fecha máxima permitida (hoy) para el atributo max del input date. */
  fechaMaxima(): string {
    return this.filtroFecha.hoyIso();
  }

  /** Obtiene el color de la categoría seleccionada (para el preview de color). */
  colorCategoriaSeleccionada(): string {
    const id = this.gastoForm?.get('categoriaId')?.value as string;
    if (!id) return '#94a3b8';
    const cat = this.categorias().find((c) => c.id === id);
    return cat?.color || this.colorCategoria(cat?.nombre) || '#94a3b8';
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
      this.cerrarModal();
    }
  }

  public abrirNuevoModal(): void {
    this.gastoEditando.set(null);
    this.guardando.set(false);
    this.gastoForm.reset({
      descripcion: '',
      monto: '',
      fecha: this.filtroFecha.hoyIso(),
      categoriaId: '',
      metodo: 'Efectivo',
      usuarioId: '',
    });
    this.mostrarModal.set(true);
  }

  public abrirEditarModal(gasto: Gasto): void {
    this.gastoEditando.set(gasto);
    this.guardando.set(false);
    this.gastoForm.setValue({
      descripcion: gasto.descripcion,
      monto: this.formatMontoInput(String(gasto.monto)),
      fecha: new Date(gasto.fecha).toISOString().substring(0, 10),
      categoriaId: gasto.categoriaId,
      metodo: gasto.metodo ?? 'Efectivo',
      usuarioId: gasto.usuario?.id ?? '',
    });
    this.mostrarModal.set(true);
  }

  public cerrarModal(): void {
    this.mostrarModal.set(false);
    this.gastoEditando.set(null);
  }

  public guardarGasto(): void {
    if (this.gastoForm.invalid) {
      this.gastoForm.markAllAsTouched();
      return;
    }
    if (this.guardando()) return;

    const v = this.gastoForm.value;
    const input = {
      descripcion: v.descripcion,
      monto: Number(String(v.monto).replace(/,/g, '')),
      fecha: v.fecha,
      categoriaId: v.categoriaId,
      metodo: v.metodo,
    };

    const request$ = this.gastoEditando()
      ? this.gastosService.updateGasto(this.gastoEditando()!.id, input)
      : this.gastosService.createGasto(input);

    this.guardando.set(true);
    request$.subscribe({
      next: () => {
        this.cerrarModal();
        this.guardando.set(false);
        this.mostrarToast(this.gastoEditando() ? 'Cambios guardados correctamente' : 'Gasto registrado correctamente');
        this.cargarDatos();
      },
      error: (err) => {
        this.guardando.set(false);
        alert(err?.error?.message ?? 'Ocurrió un error al guardar el gasto.');
      },
    });
  }

  // ===== Eliminar con confirmación =====
  public solicitarEliminar(gasto: Gasto): void {
    this.gastoAEliminar.set(gasto);
    this.mostrarConfirmacion.set(true);
  }

  public cancelarEliminar(): void {
    this.mostrarConfirmacion.set(false);
    this.gastoAEliminar.set(null);
  }

  public confirmarEliminar(): void {
    const gasto = this.gastoAEliminar();
    if (!gasto) return;
    this.cargando.set(true);

    this.gastosService.deleteGasto(gasto.id).subscribe({
      next: () => {
        this.mostrarConfirmacion.set(false);
        this.gastoAEliminar.set(null);
        this.cargarDatos();
      },
      error: (err) => {
        this.cargando.set(false);
        this.mostrarConfirmacion.set(false);
        alert(err?.error?.message ?? 'No se pudo eliminar el gasto.');
      },
    });
  }

  public paginaAnterior(): void {
    if (this.pagina() > 1) this.pagina.set(this.pagina() - 1);
  }

  public paginaSiguiente(): void {
    if (this.pagina() < this.totalPaginas()) this.pagina.set(this.pagina() + 1);
  }

  public exportarCSV(): void {
    const filas: string[][] = [['Descripción', 'Categoría', 'Fecha', 'Monto(USD)', 'Usuario']];
    this.gastosFiltrados().forEach((g) =>
      filas.push([g.descripcion, g.categoria?.nombre || 'Sin categoría', g.fecha, String(g.monto), g.usuario?.nombre || '']));
    const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'legatus-gastos.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

}
