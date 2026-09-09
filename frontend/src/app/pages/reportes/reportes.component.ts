import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { GastosService, Gasto } from '../../services/gastos.service';
import { IngresosService, Ingreso } from '../../services/ingresos.service';
import { CategoriasService, Categoria } from '../../services/categorias.service';
import { CurrencyService } from '../../services/currency.service';
import { ConfigService } from '../../services/config.service';
import { FiltroFechaService } from '../../services/filtro-fecha.service';
import { PRESUPUESTOS_BASE } from '../../services/mock-data';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { LucideIconComponent } from '../../components/lucide-icon/lucide-icon.component';
import { NotaInformativaComponent } from '../../components/nota-informativa/nota-informativa.component';

type PeriodoKey = 'mes' | 'mesAnterior' | '3m' | '6m' | 'anio';
type GranularidadKey = 'dia' | 'semana' | 'total';
type VentanaKey = '3m' | '6m' | 'anio';
type ExportType = 'pdf' | 'csv';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const PERIODO_OPCIONES: { id: PeriodoKey; label: string }[] = [
  { id: 'mes', label: 'Este mes' },
  { id: 'mesAnterior', label: 'Mes anterior' },
  { id: '3m', label: 'Últimos 3 meses' },
  { id: '6m', label: 'Últimos 6 meses' },
  { id: 'anio', label: 'Este año' },
];

const GRANULARIDAD_OPCIONES: { id: GranularidadKey; label: string }[] = [
  { id: 'dia', label: 'Por día' },
  { id: 'semana', label: 'Por semana' },
  { id: 'total', label: 'Total' },
];

const VENTANA_OPCIONES: { id: VentanaKey; label: string }[] = [
  { id: '3m', label: 'Últimos 3 meses' },
  { id: '6m', label: 'Últimos 6 meses' },
  { id: 'anio', label: 'Este año' },
];

const METODOS: string[] = ['Efectivo', 'Tarjeta', 'Transferencia'];

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, RouterLink, BaseChartDirective, SidebarComponent, LucideIconComponent, NotaInformativaComponent],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.css',
})
export class ReportesComponent implements OnInit {
  private gastosService = inject(GastosService);
  private ingresosService = inject(IngresosService);
  private categoriasService = inject(CategoriasService);
  currencyService = inject(CurrencyService);
  configService = inject(ConfigService);
  filtroFecha = inject(FiltroFechaService);
  private router = inject(Router);

  readonly PERIODO_OPCIONES = PERIODO_OPCIONES;
  readonly GRANULARIDAD_OPCIONES = GRANULARIDAD_OPCIONES;
  readonly VENTANA_OPCIONES = VENTANA_OPCIONES;
  readonly METODOS = METODOS;
  readonly MathAbs = Math.abs;

  cargando = signal(false);
  errorMsg = signal<string | null>(null);

  gastosHistorial = signal<Gasto[]>([]);
  ingresosHistorial = signal<Ingreso[]>([]);
  categorias = signal<Categoria[]>([]);

  periodo = signal<PeriodoKey>('mes');
  granularidad = signal<GranularidadKey>('dia');
  ventana = signal<VentanaKey>('3m');

  filtroCategoria = signal('');
  filtroUsuario = signal('');
  filtroMetodo = signal('');

  mostrarFiltros = signal(false);
  exportMenu = signal(false);

  toggleFiltros(): void {
    this.mostrarFiltros.set(!this.mostrarFiltros());
  }

  toggleExportMenu(): void {
    this.exportMenu.set(!this.exportMenu());
  }

  /* ─── Períodos y rangos ─── */
  periodoLabel = computed(() => PERIODO_OPCIONES.find((o) => o.id === this.periodo())?.label ?? 'Este mes');

  private mesAnteriorDe(anio: number, mes: number): { anio: number; mes: number } {
    const d = new Date(anio, mes - 2, 1);
    return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
  }

  private rangoDe(periodo: PeriodoKey): { inicio: Date; fin: Date } {
    const y = this.filtroFecha.anio();
    const m = this.filtroFecha.mes();
    switch (periodo) {
      case 'mes':
        return { inicio: new Date(y, m - 1, 1, 0, 0, 0, 0), fin: new Date(y, m, 0, 23, 59, 59, 999) };
      case 'mesAnterior': {
        const a = this.mesAnteriorDe(y, m);
        return { inicio: new Date(a.anio, a.mes - 1, 1, 0, 0, 0, 0), fin: new Date(a.anio, a.mes, 0, 23, 59, 59, 999) };
      }
      case '3m': {
        const d = new Date(y, m - 1 - 2, 1);
        return { inicio: new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0), fin: new Date(y, m, 0, 23, 59, 59, 999) };
      }
      case '6m': {
        const d = new Date(y, m - 1 - 5, 1);
        return { inicio: new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0), fin: new Date(y, m, 0, 23, 59, 59, 999) };
      }
      case 'anio':
        return { inicio: new Date(y, 0, 1, 0, 0, 0, 0), fin: new Date(y, 11, 31, 23, 59, 59, 999) };
    }
  }

  private rangoAnterior(periodo: PeriodoKey): { inicio: Date; fin: Date } {
    const { inicio, fin } = this.rangoDe(periodo);
    const span = (fin.getTime() - inicio.getTime()) + 1;
    return { inicio: new Date(inicio.getTime() - span), fin: new Date(inicio.getTime() - 1) };
  }

  rangoActual = computed(() => this.rangoDe(this.periodo()));
  rangoPrev = computed(() => this.rangoAnterior(this.periodo()));

  numDiasRango = computed(() => {
    const { inicio, fin } = this.rangoActual();
    return Math.floor((fin.getTime() - inicio.getTime()) / 86400000) + 1;
  });

  etiquetaRango(periodo: PeriodoKey): string {
    const { inicio, fin } = this.rangoDe(periodo);
    if (periodo === 'mes' || periodo === 'mesAnterior') {
      return `${MESES_CORTOS[inicio.getMonth()]} ${inicio.getFullYear()}`;
    }
    return `${MESES_CORTOS[inicio.getMonth()]} ${inicio.getFullYear()} – ${MESES_CORTOS[fin.getMonth()]} ${fin.getFullYear()}`;
  }

  periodoAnteriorNombre(): string {
    switch (this.periodo()) {
      case 'mes': return 'el mes anterior';
      case 'mesAnterior': return 'el mes anterior';
      case '3m': return 'los 3 meses anteriores';
      case '6m': return 'los 6 meses anteriores';
      case 'anio': return 'el año anterior';
    }
  }

  private inRango(fechaIso: string, rango: { inicio: Date; fin: Date }): boolean {
    const t = new Date(fechaIso).getTime();
    return t >= rango.inicio.getTime() && t <= rango.fin.getTime();
  }

  /* ─── Datos del período (tarjetas y resumen: SIEMPRE período completo) ─── */
  gastosPeriodo = computed(() => this.gastosHistorial().filter((g) => this.inRango(g.fecha, this.rangoActual())));
  ingresosPeriodo = computed(() => this.ingresosHistorial().filter((i) => this.inRango(i.fecha, this.rangoActual())));
  gastosPrevPeriodo = computed(() => this.gastosHistorial().filter((g) => this.inRango(g.fecha, this.rangoPrev())));
  ingresosPrevPeriodo = computed(() => this.ingresosHistorial().filter((i) => this.inRango(i.fecha, this.rangoPrev())));

  totalGastosPeriodoUSD = computed(() => this.gastosPeriodo().reduce((s, g) => s + Number(g.monto), 0));
  totalIngresosPeriodoUSD = computed(() => this.ingresosPeriodo().reduce((s, i) => s + Number(i.monto), 0));
  balancePeriodoUSD = computed(() => this.totalIngresosPeriodoUSD() - this.totalGastosPeriodoUSD());

  totalGastosPeriodo = computed(() => this.currencyService.formatear(this.totalGastosPeriodoUSD()));
  totalIngresosPeriodo = computed(() => this.currencyService.formatear(this.totalIngresosPeriodoUSD()));
  balancePeriodo = computed(() => this.currencyService.formatear(this.balancePeriodoUSD()));

  gastosPrevUSD = computed(() => this.gastosPrevPeriodo().reduce((s, g) => s + Number(g.monto), 0));
  ingresosPrevUSD = computed(() => this.ingresosPrevPeriodo().reduce((s, i) => s + Number(i.monto), 0));
  balancePrevUSD = computed(() => this.ingresosPrevUSD() - this.gastosPrevUSD());

  tasaAhorro = computed(() => {
    const ingresos = this.totalIngresosPeriodoUSD();
    if (ingresos === 0) return 0;
    return Math.max(0, Math.min(100, (this.balancePeriodoUSD() / ingresos) * 100));
  });

  tasaAhorroStr = computed(() => this.tasaAhorro().toFixed(2).replace('.', ','));

  private pctCambio(actual: number, prev: number): number | null {
    if (prev === 0) return actual === 0 ? 0 : null;
    return Math.round(((actual - prev) / Math.abs(prev)) * 100);
  }

  cambioIngresos = computed(() => this.pctCambio(this.totalIngresosPeriodoUSD(), this.ingresosPrevUSD()));
  cambioGastos = computed(() => this.pctCambio(this.totalGastosPeriodoUSD(), this.gastosPrevUSD()));
  cambioBalance = computed(() => this.pctCambio(this.balancePeriodoUSD(), this.balancePrevUSD()));

  gastoPromedioDiario = computed(() => {
    const dias = this.numDiasRango();
    const prom = dias > 0 ? this.totalGastosPeriodoUSD() / dias : 0;
    return this.currencyService.formatear(prom);
  });

  /* ─── Filtros del panel (refinan gráficos y listas) ─── */
  usuarios = computed(() => {
    const set = new Set<string>();
    this.gastosHistorial().forEach((g) => { const n = g.usuario?.nombre || g.usuario?.usuario || ''; if (n) set.add(n); });
    this.ingresosHistorial().forEach((i) => { const n = i.usuario?.nombre || i.usuario?.usuario || ''; if (n) set.add(n); });
    return [...set];
  });

  filtrosActivos = computed(() => !!(this.filtroCategoria() || this.filtroUsuario() || this.filtroMetodo()));
  filtrosActivosCount = computed(() =>
    [this.filtroCategoria(), this.filtroUsuario(), this.filtroMetodo()].filter((v) => v).length
  );

  limpiarFiltros(): void {
    this.filtroCategoria.set('');
    this.filtroUsuario.set('');
    this.filtroMetodo.set('');
  }

  onPeriodoCambio(event: Event): void {
    this.periodo.set((event.target as HTMLSelectElement).value as PeriodoKey);
  }

  onGranularidad(event: Event): void {
    this.granularidad.set((event.target as HTMLSelectElement).value as GranularidadKey);
  }

  onVentana(event: Event): void {
    this.ventana.set((event.target as HTMLSelectElement).value as VentanaKey);
  }

  onFiltroCategoria(event: Event): void {
    this.filtroCategoria.set((event.target as HTMLSelectElement).value);
  }

  onFiltroUsuario(event: Event): void {
    this.filtroUsuario.set((event.target as HTMLSelectElement).value);
  }

  onFiltroMetodo(event: Event): void {
    this.filtroMetodo.set((event.target as HTMLSelectElement).value);
  }

  private categoriaNombre(m: Gasto | Ingreso): string {
    return (m as Gasto).categoria?.nombre ?? (m as Ingreso).categoria ?? '';
  }

  private coincideFiltros(m: Gasto | Ingreso): boolean {
    if (this.filtroCategoria()) {
      const c = this.categoriaNombre(m).toLowerCase();
      if (!c.includes(this.filtroCategoria().toLowerCase())) return false;
    }
    if (this.filtroUsuario()) {
      const u = (m.usuario?.nombre || m.usuario?.usuario || '').toLowerCase();
      if (u !== this.filtroUsuario().toLowerCase()) return false;
    }
    if (this.filtroMetodo()) {
      if ((m.metodo || '') !== this.filtroMetodo()) return false;
    }
    return true;
  }

  gastosVisibles = computed(() => this.gastosPeriodo().filter((g) => this.coincideFiltros(g)));
  ingresosVisibles = computed(() => this.ingresosPeriodo().filter((i) => this.coincideFiltros(i)));

  totalGastosVisibles = computed(() => this.gastosVisibles().reduce((s, g) => s + Number(g.monto), 0));
  totalIngresosVisibles = computed(() => this.ingresosVisibles().reduce((s, i) => s + Number(i.monto), 0));
  donutCenterTotal = computed(() => this.currencyService.formatear(this.totalGastosVisibles()));

  /* ─── Colores de categorías (esquema compartido del sistema) ─── */
  colorCategoria(nombre: string): string {
    return this.categoriasService.colorDeCategoria(nombre);
  }

  getIconoCategoria(nombre?: string): string {
    const n = (nombre || '').toLowerCase();
    if (n.includes('comida')) return 'utensils';
    if (n.includes('transporte')) return 'car';
    if (n.includes('servicio')) return 'zap';
    if (n.includes('entreten')) return 'clapperboard';
    if (n.includes('salud')) return 'heart-pulse';
    if (n.includes('hogar')) return 'home';
    if (n.includes('compras')) return 'shopping-bag';
    if (n.includes('educ')) return 'graduation-cap';
    if (n.includes('viaje')) return 'plane';
    return 'package';
  }

  withAlpha(hex: string, alpha: number): string {
    const h = (hex || '#000000').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  formatearFecha(fecha: string): string {
    return this.configService.formatearFecha(fecha);
  }

  /* ─── Dona: gastos por categoría ─── */
  private agruparPorCategoria(lista: Gasto[]): { name: string; amountUSD: number; amountFormatted: string; percentage: number; color: string }[] {
    const base = new Set(Object.keys(PRESUPUESTOS_BASE).map((k) => k.toLowerCase()));
    const map: { [k: string]: { name: string; amountUSD: number; color: string } } = {};
    lista.forEach((g) => {
      const nom = this.categoriaNombre(g).trim() || 'Otros';
      const final = base.has(nom.toLowerCase()) ? nom : 'Otros';
      if (!map[final]) map[final] = { name: final, amountUSD: 0, color: this.colorCategoria(final) };
      map[final].amountUSD += Number(g.monto);
    });
    const total = lista.reduce((s, g) => s + Number(g.monto), 0) || 1;
    return Object.values(map)
      .map((i) => ({
        ...i,
        amountFormatted: this.currencyService.formatear(i.amountUSD),
        percentage: Math.round((i.amountUSD / total) * 100),
      }))
      .sort((a, b) => b.amountUSD - a.amountUSD);
  }

  gastosPorCategoria = computed(() => this.agruparPorCategoria(this.gastosVisibles()));

  donutChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const cats = this.gastosPorCategoria();
    return {
      labels: cats.map((c) => c.name),
      datasets: [{
        data: cats.map((c) => this.currencyService.convertir(c.amountUSD)),
        backgroundColor: cats.map((c) => c.color),
        borderColor: '#071a33',
        borderWidth: 2,
        hoverOffset: 8,
      }],
    };
  });

  donutChartOptions = computed<ChartConfiguration<'doughnut'>['options']>(() => ({
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
          title: (items: any[]) => {
            const cat = this.gastosPorCategoria()[items?.[0]?.dataIndex];
            return cat?.name || 'Categoría';
          },
          label: (item: any) => {
            const val = item.parsed;
            const cat = this.gastosPorCategoria()[item.dataIndex];
            const pct = cat?.percentage ?? 0;
            const formatted = this.currencyService.formatearValor(Number(val));
            return [
              `Gastado: ${formatted}`,
              `Porcentaje: ${pct}%`,
              `Color: ${cat?.color || '#94a3b8'}`,
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

  // Métodos helper para validación segura en templates
  hasMixedChartData(): boolean {
    return this.mixedChartData().datasets && this.mixedChartData().datasets[0] && this.mixedChartData().datasets[0].data && this.mixedChartData().datasets[0].data.length > 0;
  }

  hasDonutChartData(): boolean {
    return this.donutChartData().datasets && this.donutChartData().datasets[0] && this.donutChartData().datasets[0].data && this.donutChartData().datasets[0].data.length > 0;
  }

  hasComparacionChartData(): boolean {
    return this.comparacionChartData().datasets && this.comparacionChartData().datasets[0] && this.comparacionChartData().datasets[0].data && this.comparacionChartData().datasets[0].data.length > 0;
  }

  /* ─── Gráfico mixto: Ingresos vs Gastos ─── */
  private buildBuckets(gastos: Gasto[], ingresos: Ingreso[], gran: GranularidadKey): { labels: string[]; gastos: number[]; ingresos: number[]; balance: number[] } {
    const { inicio, fin } = this.rangoActual();
    const labels: string[] = [];
    const gastosArr: number[] = [];
    const ingresosArr: number[] = [];
    const balanceArr: number[] = [];

    const idDe = (f: Date): string => {
      if (gran === 'dia') return `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`;
      if (gran === 'total') return `${f.getFullYear()}-${f.getMonth()}`;
      const monday = new Date(f);
      monday.setDate(f.getDate() - ((f.getDay() + 6) % 7));
      return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
    };
    const labelDe = (f: Date): string => {
      if (gran === 'total') return MESES_CORTOS[f.getMonth()];
      return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}`;
    };
    const idDeItem = (iso: string): string => idDe(new Date(iso));

    let lastId: string | null = null;
    for (let d = new Date(inicio.getTime()); d.getTime() <= fin.getTime(); d.setDate(d.getDate() + 1)) {
      const id = idDe(d);
      if (lastId === id) continue;
      lastId = id;
      const sumG = gastos.filter((m) => idDeItem(m.fecha) === id).reduce((s, m) => s + Number(m.monto), 0);
      const sumI = ingresos.filter((m) => idDeItem(m.fecha) === id).reduce((s, m) => s + Number(m.monto), 0);
      labels.push(labelDe(d));
      gastosArr.push(sumG);
      ingresosArr.push(sumI);
      balanceArr.push(sumI - sumG);
    }
    return { labels, gastos: gastosArr, ingresos: ingresosArr, balance: balanceArr };
  }

  mixedChartData = computed<any>(() => {
    const b = this.buildBuckets(this.gastosVisibles(), this.ingresosVisibles(), this.granularidad());
    const gran = this.granularidad();
    const esTotal = gran === 'total';

    return {
      labels: b.labels,
      datasets: [
        {
          type: esTotal ? 'bar' : 'line',
          label: 'Ingresos',
          data: b.ingresos.map((v) => this.currencyService.convertir(v)),
          borderColor: '#00e7a8',
          backgroundColor: esTotal ? 'rgba(0,231,168,0.8)' : (ctx: any) => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(0,231,168,0.05)';
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(0,231,168,0.16)');
            gradient.addColorStop(1, 'rgba(0,231,168,0.02)');
            return gradient;
          },
          fill: true,
          tension: 0.4,
          borderWidth: esTotal ? 0 : 3,
          pointRadius: esTotal ? 0 : 4,
          pointHoverRadius: esTotal ? 0 : 6,
          pointBackgroundColor: '#00e7a8',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderRadius: esTotal ? 8 : 0,
          borderSkipped: false,
          maxBarThickness: esTotal ? 40 : 20,
          order: 1,
        },
        {
          type: esTotal ? 'bar' : 'line',
          label: 'Gastos',
          data: b.gastos.map((v) => this.currencyService.convertir(v)),
          borderColor: '#ff4259',
          backgroundColor: esTotal ? 'rgba(255,66,89,0.8)' : (ctx: any) => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(255,66,89,0.05)';
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(255,66,89,0.14)');
            gradient.addColorStop(1, 'rgba(255,66,89,0.02)');
            return gradient;
          },
          fill: true,
          tension: 0.4,
          borderWidth: esTotal ? 0 : 3,
          pointRadius: esTotal ? 0 : 4,
          pointHoverRadius: esTotal ? 0 : 6,
          pointBackgroundColor: '#ff4259',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderRadius: esTotal ? 8 : 0,
          borderSkipped: false,
          maxBarThickness: esTotal ? 40 : 20,
          order: 2,
        },
        {
          type: esTotal ? 'bar' : 'line',
          label: 'Balance',
          data: b.balance.map((v) => this.currencyService.convertir(v)),
          borderColor: '#1268ff',
          yAxisID: 'y1',
          backgroundColor: esTotal ? (ctx: any) => {
            const value = ctx.raw;
            if (value >= 0) {
              return 'rgba(18,104,255,0.8)';
            } else {
              return 'rgba(255,66,89,0.8)';
            }
          } : (ctx: any) => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(18,104,255,0.05)';
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(18,104,255,0.16)');
            gradient.addColorStop(1, 'rgba(18,104,255,0.02)');
            return gradient;
          },
          hoverBackgroundColor: esTotal ? (ctx: any) => {
            const value = ctx.raw;
            if (value >= 0) {
              return '#1268ff';
            } else {
              return '#ff4259';
            }
          } : undefined,
          fill: true,
          tension: 0.3,
          borderWidth: esTotal ? 0 : 3,
          pointRadius: esTotal ? 0 : 4,
          pointHoverRadius: esTotal ? 0 : 6,
          pointBackgroundColor: '#1268ff',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderRadius: esTotal ? 8 : 0,
          borderSkipped: false,
          maxBarThickness: esTotal ? 40 : 20,
          order: 0,
        },
      ],
    };
  });

  mixedChartOptions = computed<any>(() => {
    const gran = this.granularidad();
    const esTotal = gran === 'total';

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: '#bcc7e8',
            usePointStyle: true,
            pointStyle: esTotal ? 'rectRounded' : 'circle',
            boxWidth: esTotal ? 12 : 10,
            boxHeight: esTotal ? 12 : 10,
            padding: 20,
            font: { size: 12, family: 'Inter', weight: '500' },
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
            title: (items: any[]) => {
              if (!items[0]?.label) return '';
              if (gran === 'total') return `Mes: ${items[0].label}`;
              if (gran === 'semana') return `Semana: ${items[0].label}`;
              return `Fecha: ${items[0].label}`;
            },
            label: (item: any) => {
              const valor = this.currencyService.formatearValor(Number(item.parsed.y ?? item.parsed));
              const dataset = item.dataset;
              if (dataset.label === 'Balance') {
                const balance = Number(item.parsed.y ?? item.parsed);
                const esPositivo = balance >= 0;
                return `${dataset.label}: ${valor} ${esPositivo ? '✓' : '✗'}`;
              }
              return `${dataset.label}: ${valor}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: esTotal ? 'rgba(122,160,255,0.08)' : 'rgba(122,160,255,0.05)',
            drawBorder: false
          },
          ticks: {
            color: '#8290b5',
            font: { size: esTotal ? 12 : 11, family: 'Inter', weight: esTotal ? '600' : 'normal' },
            maxRotation: esTotal ? 0 : 45,
            minRotation: 0
          },
          border: { display: false }
        },
        y: {
          grid: {
            color: 'rgba(122,160,255,0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#8290b5',
            font: { size: 10, family: 'Inter' },
            callback: (val: any) => this.currencyService.formatearValor(Number(val), 0)
          },
          border: { display: false },
          beginAtZero: true,
        },
        y1: {
          position: 'right',
          grid: {
            drawOnChartArea: false,
          },
          ticks: {
            color: '#8290b5',
            font: { size: 10, family: 'Inter' },
            callback: (val: any) => this.currencyService.formatearValor(Number(val), 0)
          },
          border: { display: false },
          beginAtZero: true,
        },
      },
    };
  });

  /* ─── Gastos por mes (comparación): dos meses consecutivos por categoría ─── */
  private mapPorCategoria(lista: Gasto[]): Map<string, number> {
    const base = new Set(Object.keys(PRESUPUESTOS_BASE).map((k) => k.toLowerCase()));
    const map = new Map<string, number>();
    lista.forEach((g) => {
      const nom = this.categoriaNombre(g).trim() || 'Otros';
      const final = base.has(nom.toLowerCase()) ? nom : 'Otros';
      map.set(final, (map.get(final) || 0) + Number(g.monto));
    });
    return map;
  }

  comparacionChartData = computed<any>(() => {
    const ventana = this.ventana();
    const { inicio, fin } = this.rangoActual();
    const { inicio: inicioPrev, fin: finPrev } = this.rangoPrev();

    // Filtrar gastos según la ventana seleccionada
    const currentList = this.gastosHistorial().filter((g) => {
      const t = new Date(g.fecha).getTime();
      return t >= inicio.getTime() && t <= fin.getTime();
    });

    const prevList = this.gastosHistorial().filter((g) => {
      const t = new Date(g.fecha).getTime();
      return t >= inicioPrev.getTime() && t <= finPrev.getTime();
    });

    const currMap = this.mapPorCategoria(currentList);
    const prevMap = this.mapPorCategoria(prevList);

    // Combinar categorías de ambos períodos
    const totales = new Map<string, number>();
    prevMap.forEach((v, k) => totales.set(k, (totales.get(k) || 0) + v));
    currMap.forEach((v, k) => totales.set(k, (totales.get(k) || 0) + v));

    // Top 5 categorías por gasto total
    const nombres = [...totales.keys()]
      .sort((a, b) => (totales.get(b) || 0) - (totales.get(a) || 0))
      .slice(0, 5);

    // Etiquetas descriptivas según la ventana
    const etiquetaActual = this.etiquetaRango(this.periodo());
    const etiquetaPrev = this.periodoAnteriorNombre();

    return {
      labels: nombres,
      datasets: [
        {
          label: `Período anterior (${etiquetaPrev})`,
          data: nombres.map((n) => this.currencyService.convertir(prevMap.get(n) || 0)),
          backgroundColor: '#94a3b8',
          hoverBackgroundColor: '#7c8db0',
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 14,
        },
        {
          label: `Período actual (${etiquetaActual})`,
          data: nombres.map((n) => this.currencyService.convertir(currMap.get(n) || 0)),
          backgroundColor: nombres.map((n) => this.categoriasService.colorDeCategoria(n)),
          hoverBackgroundColor: nombres.map((n) => this.categoriasService.colorDeCategoria(n)),
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 14,
        },
      ],
    };
  });

  comparacionChartOptions = computed<any>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: '#bcc7e8', usePointStyle: true, pointStyle: 'circle', boxWidth: 8, font: { size: 11, family: 'Inter' } },
      },
      tooltip: {
        backgroundColor: '#081d38',
        titleColor: '#bcc7e8',
        bodyColor: '#ffffff',
        borderColor: 'rgba(122,160,255,0.2)',
        borderWidth: 1,
        cornerRadius: 10,
        padding: 12,
        callbacks: {
          label: (item: any) =>
            `${item.dataset.label}: ${this.currencyService.formatearValor(Number(item.parsed.x ?? item.parsed))}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(122,160,255,0.07)' },
        ticks: { color: '#8290b5', font: { size: 10, family: 'Inter' }, callback: (val: any) => this.currencyService.formatearValor(Number(val), 0) },
        border: { display: false },
        beginAtZero: true,
      },
      y: {
        grid: { display: false },
        ticks: { color: '#bcc7e8', font: { size: 11, family: 'Inter', weight: '500' }, crossAlign: 'far' as const },
        border: { display: false },
      },
    },
  }));

  /* ─── Top 5 mayores gastos ─── */
  topMayoresGastos = computed(() =>
    [...this.gastosVisibles()]
      .sort((a, b) => Number(b.monto) - Number(a.monto))
      .slice(0, 5)
      .map((g) => ({
        descripcion: g.descripcion,
        categoria: this.categoriaNombre(g) || 'Sin categoría',
        categoriaColor: this.colorCategoria(this.categoriaNombre(g)),
        fecha: this.formatearFecha(g.fecha),
        monto: this.currencyService.formatear(Number(g.monto)),
        icono: this.getIconoCategoria(this.categoriaNombre(g)),
      }))
  );

  /* ─── Resumen del período ─── */
  diaConMasGastos = computed(() => {
    const map = new Map<string, number>();
    this.gastosPeriodo().forEach((g) => {
      const k = this.formatearFecha(g.fecha);
      map.set(k, (map.get(k) || 0) + Number(g.monto));
    });
    let mejor: { fecha: string; monto: number; montoF: string } | null = null;
    map.forEach((monto, fecha) => {
      if (!mejor || monto > mejor.monto) mejor = { fecha, monto, montoF: this.currencyService.formatear(monto) };
    });
    return mejor ?? { fecha: '—', monto: 0, montoF: '—' };
  });

  categoriaTop = computed(() => {
    const top = this.agruparPorCategoria(this.gastosPeriodo())[0];
    return top ? { name: top.name, color: top.color, montoF: top.amountFormatted } : { name: '—', color: '#94a3b8', montoF: '—' };
  });

  mensajeProgreso = computed(() => {
    const actual = this.totalGastosPeriodoUSD();
    const prev = this.gastosPrevUSD();
    if (actual === 0 && prev === 0) {
      return { tipo: 'ok' as const, icono: 'check-circle', texto: 'Aún no hay gastos registrados en este período. Empieza a registrar tus movimientos para ver tu progreso.' };
    }
    const diff = this.pctCambio(actual, prev);
    if (diff !== null && diff <= 0) {
      return {
        tipo: 'ok' as const,
        icono: 'trending-up',
        texto: `¡Vas bien! 🎉 Has gastado ${Math.abs(diff)}% menos que ${this.periodoAnteriorNombre()}.`,
      };
    }
    if (diff !== null && diff <= 20) {
      return {
        tipo: 'warn' as const,
        icono: 'lightbulb',
        texto: `Has gastado ${diff}% más que ${this.periodoAnteriorNombre()}. Mantén el ritmo para no superar tu presupuesto.`,
      };
    }
    return {
      tipo: 'bad' as const,
      icono: 'triangle-alert',
      texto: `Atención: has gastado ${diff ?? 0}% más que ${this.periodoAnteriorNombre()}. Revisa tus gastos para volver al equilibrio.`,
    };
  });

  /* ─── Navegación a Gastos ─── */
  verTodosLosGastos(): void {
    const y = this.filtroFecha.anio();
    const m = this.filtroFecha.mes();
    if (this.periodo() === 'mes') {
      this.filtroFecha.setMesAnio(m, y);
    } else if (this.periodo() === 'mesAnterior') {
      const a = this.mesAnteriorDe(y, m);
      this.filtroFecha.setMesAnio(a.mes, a.anio);
    }
    this.router.navigate(['/gastos']);
  }

  /* ─── Exportación ─── */
  exportar(tipo: ExportType): void {
    this.exportMenu.set(false);
    const filas: string[][] = [['Tipo', 'Fecha', 'Descripción', 'Categoría', 'Usuario', 'Método', 'Monto(USD)']];
    this.gastosPeriodo().forEach((g) =>
      filas.push(['Gasto', this.formatearFecha(g.fecha), g.descripcion, this.categoriaNombre(g) || 'Sin categoría', g.usuario?.nombre || g.usuario?.usuario || '', g.metodo || '', String(g.monto)])
    );
    this.ingresosPeriodo().forEach((i) =>
      filas.push(['Ingreso', this.formatearFecha(i.fecha), i.descripcion, i.categoria || '', i.usuario?.nombre || i.usuario?.usuario || '', i.metodo || '', String(i.monto)])
    );
    if (tipo === 'csv') this.exportarCSV(filas);
    else this.exportarPDF(filas);
  }

  private exportarCSV(filas: string[][]): void {
    const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    this.descargar(`legatus-reporte-${this.etiquetaRango(this.periodo()).replace(/ /g, '-').toLowerCase()}.csv`, csv, 'text/csv;charset=utf-8;');
  }

  private exportarPDF(filas: string[][]): void {
    const y = this.filtroFecha.anio();
    const m = this.filtroFecha.mes();
    const partes: { texto: string; size: number; bold: boolean }[] = [];
    partes.push({ texto: 'Legatus - Reporte financiero', size: 16, bold: true });
    partes.push({ texto: `Periodo: ${this.periodoLabel()} (${this.etiquetaRango(this.periodo())})  |  Mes base: ${MESES_CORTOS[m - 1]} ${y}`, size: 9, bold: false });
    partes.push({ texto: ' ', size: 9, bold: false });
    partes.push({ texto: 'Resumen del periodo', size: 12, bold: true });
    partes.push({ texto: `Ingresos totales  : ${this.totalIngresosPeriodo()}`, size: 10, bold: false });
    partes.push({ texto: `Gastos totales     : ${this.totalGastosPeriodo()}`, size: 10, bold: false });
    partes.push({ texto: `Balance neto       : ${this.balancePeriodo()}`, size: 10, bold: false });
    partes.push({ texto: `Ahorro              : ${this.tasaAhorroStr()}% del total de ingresos`, size: 10, bold: false });
    partes.push({ texto: ' ', size: 9, bold: false });
    partes.push({ texto: 'Top 5 mayores gastos', size: 12, bold: true });
    this.topMayoresGastos().forEach((t, idx) => {
      partes.push({ texto: `${idx + 1}. ${t.descripcion} (${t.categoria})  ${t.monto}`, size: 10, bold: false });
    });
    partes.push({ texto: ' ', size: 9, bold: false });
    partes.push({ texto: `Movimientos del periodo (${filas.length - 1})`, size: 12, bold: true });
    filas.slice(1, 40).forEach((f) => {
      partes.push({ texto: `${f[1]}  ${f[0]}  ${f[2]}  ${f[3]}  $${f[6]}`, size: 8, bold: false });
    });
    if (filas.length > 40) partes.push({ texto: '...', size: 8, bold: false });

    const cuerpo: string[] = [];
    let yPdf = 748;
    partes.forEach((p) => {
      yPdf -= p.bold ? 22 : (p.size >= 12 ? 18 : 15);
      cuerpo.push(`BT /F${p.bold ? 2 : 1} ${p.size} Tf 50 ${yPdf} Td (${this.pdfEscape(p.texto)}) Tj ET`);
    });

    const len = cuerpo.join('\n').length;
    const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
    const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
    const obj3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n';
    const obj4 = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
    const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n';
    const obj6 = `6 0 obj\n<< /Length ${len} >>\nstream\n${cuerpo.join('\n')}\nendstream\nendobj\n`;

    const bodies = [obj1, obj2, obj3, obj4, obj5, obj6];
    const header = '%PDF-1.4\n';
    let pos = header.length;
    const offsets: number[] = [];
    bodies.forEach((b) => { offsets.push(pos); pos += b.length; });
    const startxref = pos;
    let xref = `xref\n0 7\n0000000000 65535 f \n`;
    offsets.forEach((o) => { xref += `${String(o).padStart(10, '0')} 00000 n \n`; });
    const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;

    this.descargar(`legatus-reporte-${this.etiquetaRango(this.periodo()).replace(/ /g, '-').toLowerCase()}.pdf`, header + bodies.join('') + xref + trailer, 'application/pdf');
  }

  private pdfEscape(t: string): string {
    return t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/[\\()]/g, (ch) => (ch === '(' ? '\\(' : ch === ')' ? '\\)' : '\\\\'));
  }

  private descargar(nombre: string, contenido: string, mime: string): void {
    const blob = new Blob([contenido], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ─── Carga de datos ─── */
  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando.set(true);
    this.errorMsg.set(null);
    forkJoin({
      gastos: this.gastosService.getGastosCompletos(),
      ingresos: this.ingresosService.getIngresosCompletos(),
      categorias: this.categoriasService.getCategoriasCompletas(),
    }).subscribe({
      next: ({ gastos, ingresos, categorias }) => {
        this.gastosHistorial.set(gastos);
        this.ingresosHistorial.set(ingresos);
        this.categorias.set(categorias);
        this.cargando.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudieron cargar los reportes.');
        this.cargando.set(false);
      },
    });
  }
}