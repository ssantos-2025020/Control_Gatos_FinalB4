import { Component, OnInit, signal, computed, inject, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
import { LucideIconComponent } from '../../components/lucide-icon/lucide-icon.component';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { AuthService } from '../../services/auth.service';
import { GastosService, Gasto } from '../../services/gastos.service';
import { IngresosService, Ingreso } from '../../services/ingresos.service';
import { CategoriasService, Categoria } from '../../services/categorias.service';
import { CurrencyService } from '../../services/currency.service';
import { ConfigService } from '../../services/config.service';
import { FiltroFechaService } from '../../services/filtro-fecha.service';
import { AlertaPresupuestoComponent } from '../../components/alerta-presupuesto/alerta-presupuesto.component';
import { SelectorMesComponent } from '../../components/selector-mes/selector-mes.component';
import { PRESUPUESTOS_BASE, PRESUPUESTO_TOTAL_BASE } from '../../services/mock-data';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, RouterLinkActive, BaseChartDirective, LucideIconComponent, SidebarComponent, AlertaPresupuestoComponent, SelectorMesComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  Math = Math;
  private authService = inject(AuthService);
  private gastosService = inject(GastosService);
  private ingresosService = inject(IngresosService);
  private categoriasService = inject(CategoriasService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  currencyService = inject(CurrencyService);
  configService = inject(ConfigService);
  filtroFecha = inject(FiltroFechaService);

  usuario = this.authService.getUsuario();
  cargando = signal(false);
  errorMsg = signal<string | null>(null);

  gastos = signal<Gasto[]>([]);
  ingresos = signal<Ingreso[]>([]);
  categorias = signal<Categoria[]>([]);

  mostrarGastoModal = signal(false);
  mostrarTodosPresupuestos = signal(false);
  mostrarTodosMovimientos = signal(false);
  filtroGranularidad = signal<'dia' | 'semana' | 'mes'>('dia');
  filtroPeriodoCategorias = signal<'mes' | 'mesAnterior' | 'tresMeses'>('mes');
  gastoForm!: FormGroup;

  private getMesActual(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  getLabelMes(): string {
    return this.filtroFecha.getLabelMes();
  }

  onMesCambiado(event: { mes: number; anio: number }): void {
    this.cargarDatos();
  }

  private getRangoMes(y: number, m: number): { start: Date; end: Date } {
    return {
      start: new Date(y, m - 1, 1),
      end: new Date(y, m, 0, 23, 59, 59, 999),
    };
  }

  gastosDelMes = signal<Gasto[]>([]);
  ingresosDelMes = signal<Ingreso[]>([]);
  gastosMesAnterior = signal<Gasto[]>([]);
  ingresosMesAnterior = signal<Ingreso[]>([]);
  gastosPenultimo = signal<Gasto[]>([]);
  ingresosPenultimo = signal<Ingreso[]>([]);

  totalGastadoUSD = computed(() => this.gastosDelMes().reduce((s, g) => s + Number(g.monto), 0));
  totalIngresosUSD = computed(() => this.ingresosDelMes().reduce((s, i) => s + Number(i.monto), 0));
  balanceUSD = computed(() => this.totalIngresosUSD() - this.totalGastadoUSD());

  totalGastado = computed(() => this.currencyService.formatear(this.totalGastadoUSD()));
  totalIngresos = computed(() => this.currencyService.formatear(this.totalIngresosUSD()));
  balance = computed(() => this.currencyService.formatear(this.balanceUSD()));
  saldoDisponible = computed(() => this.currencyService.formatear(this.balanceUSD()));

  cantidadGastosMes = computed(() => this.gastosDelMes().length);
  cantidadIngresosMes = computed(() => this.ingresosDelMes().length);

  porcentajeCambioGastos = computed(() => {
    const actual = this.totalGastadoUSD();
    const anterior = this.gastosMesAnterior().reduce((s, g) => s + Number(g.monto), 0);
    if (anterior === 0) return actual > 0 ? 100 : 0;
    return Math.round(((actual - anterior) / anterior) * 100);
  });

  porcentajeCambioIngresos = computed(() => {
    const actual = this.totalIngresosUSD();
    const anterior = this.ingresosMesAnterior().reduce((s, i) => s + Number(i.monto), 0);
    if (anterior === 0) return actual > 0 ? 100 : 0;
    return Math.round(((actual - anterior) / anterior) * 100);
  });

  porcentajeCambioBalance = computed(() => {
    const actual = this.balanceUSD();
    const anteriorIngresos = this.ingresosMesAnterior().reduce((s, i) => s + Number(i.monto), 0);
    const anteriorGastos = this.gastosMesAnterior().reduce((s, g) => s + Number(g.monto), 0);
    const anterior = anteriorIngresos - anteriorGastos;
    if (anterior === 0) return actual > 0 ? 100 : actual < 0 ? -100 : 0;
    return Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
  });

  gastosPeriodoCategorias = computed(() => {
    const p = this.filtroPeriodoCategorias();
    if (p === 'mesAnterior') return this.gastosMesAnterior();
    if (p === 'tresMeses') return [...this.gastosDelMes(), ...this.gastosMesAnterior(), ...this.gastosPenultimo()];
    return this.gastosDelMes();
  });

  totalGastadoPeriodoUSD = computed(() =>
    this.gastosPeriodoCategorias().reduce((s, g) => s + Number(g.monto), 0));
  totalGastadoPeriodo = computed(() => this.currencyService.formatear(this.totalGastadoPeriodoUSD()));

  private agruparGastosPorCategoria(list: Gasto[]) {
    const map: { [key: string]: { name: string; amountUSD: number; color: string } } = {};
    const colores: { [key: string]: string } = {
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
    const paleta = ['#1268ff', '#00b9e8', '#7228e8', '#ff6b9d', '#00e7a8', '#ffa500', '#6ea8ff', '#c084fc', '#00d0a8', '#fbbf24', '#a855f7'];

    list.forEach((g) => {
      const rawName = g.categoria?.nombre || 'Sin Categoría';
      // Las categorías sin presupuesto base se pliegan dentro de "Otros"
      // para mantener la correspondencia con la vista de presupuestos.
      const catName = PRESUPUESTOS_BASE[rawName] !== undefined ? rawName : 'Otros';
      const catColor = g.categoria?.color || colores[catName] || paleta[Object.keys(map).length % paleta.length];
      if (!map[catName]) {
        map[catName] = { name: catName, amountUSD: 0, color: colores[catName] ?? catColor };
      }
      map[catName].amountUSD += Number(g.monto);
    });

    const total = list.reduce((s, g) => s + Number(g.monto), 0) || 1;

    return Object.values(map)
      .map((item) => ({
        ...item,
        amountFormatted: this.currencyService.formatear(item.amountUSD),
        percentage: Math.round((item.amountUSD / total) * 100),
      }))
      .sort((a, b) => b.amountUSD - a.amountUSD);
  }

  gastosPorCategoria = computed(() => this.agruparGastosPorCategoria(this.gastosDelMes()));
  gastosPorCategoriaPeriodo = computed(() => this.agruparGastosPorCategoria(this.gastosPeriodoCategorias()));

  // ===== CHART.JS: Line chart (Evolución de gastos - por día / semana) =====
  lineChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const gastos = this.gastosDelMes();
    const y = this.filtroFecha.anio();
    const m = this.filtroFecha.mes();
    const diasEnMes = new Date(y, m, 0).getDate();
    const granularidad = this.filtroGranularidad();

    // Cuando granularidad es 'mes', usamos el bar chart en su lugar
    if (granularidad === 'mes') {
      return { labels: [], datasets: [{ data: [] }] };
    }

    let labels: string[] = [];
    let acumulados: number[] = [];
    let promedioMovil: number[] = [];

    if (granularidad === 'semana') {
      const semanasLabels: string[] = [];
      const semanasMontos: number[] = [];
      for (let d = 1; d <= diasEnMes; d += 7) {
        const fin = Math.min(d + 6, diasEnMes);
        semanasLabels.push(`Sem ${Math.ceil(d/7)}`);
        semanasMontos.push(0);
      }
      gastos.forEach((g) => {
        const dia = new Date(g.fecha).getDate();
        const idx = Math.min(Math.floor((dia - 1) / 7), semanasMontos.length - 1);
        if (idx >= 0) semanasMontos[idx] += Number(g.monto);
      });
      labels = semanasLabels;
      acumulados = semanasMontos;

      // Promedio móvil de 2 semanas
      for (let i = 0; i < acumulados.length; i++) {
        if (i === 0) {
          promedioMovil.push(acumulados[i]);
        } else {
          promedioMovil.push((acumulados[i] + acumulados[i-1]) / 2);
        }
      }
    } else {
      const gastosPorDia: number[] = new Array(diasEnMes).fill(0);
      gastos.forEach((g) => {
        const d = new Date(g.fecha).getDate() - 1;
        if (d >= 0 && d < diasEnMes) gastosPorDia[d] += Number(g.monto);
      });
      labels = Array.from({ length: diasEnMes }, (_, i) => String(i + 1));
      acumulados = gastosPorDia;

      // Promedio móvil de 3 días
      for (let i = 0; i < acumulados.length; i++) {
        if (i < 2) {
          promedioMovil.push(acumulados[i]);
        } else {
          promedioMovil.push((acumulados[i] + acumulados[i-1] + acumulados[i-2]) / 3);
        }
      }
    }

    const converted = acumulados.map(v => this.currencyService.convertir(v));
    const promedioConverted = promedioMovil.map(v => this.currencyService.convertir(v));

    // Calcular promedio general para línea de referencia
    const promedioGeneral = converted.reduce((a, b) => a + b, 0) / converted.length || 0;
    const lineaPromedio = new Array(converted.length).fill(promedioGeneral);

    return {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Gastos diarios',
          data: converted,
          borderColor: '#3b82f6',
          backgroundColor: (ctx: any) => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(59,130,246,0.1)';
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(59,130,246,0.4)');
            gradient.addColorStop(1, 'rgba(59,130,246,0.05)');
            return gradient;
          },
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 2,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          order: 1,
        },
        {
          type: 'line',
          label: 'Tendencia (promedio móvil)',
          data: promedioConverted,
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
          label: 'Promedio del mes',
          data: lineaPromedio,
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

  // ===== CHART.JS: Bar chart (Evolución de gastos - Total) =====
  barChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const gastos = this.gastosDelMes();
    const y = this.filtroFecha.anio();
    const m = this.filtroFecha.mes();
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const total = gastos.reduce((s, g) => s + Number(g.monto), 0);

    // Si no hay gastos, mostrar una barra vacía con el mensaje apropiado
    if (total === 0) {
      return {
        labels: [`${meses[m - 1]} ${y}`],
        datasets: [{
          label: 'Total',
          data: [0],
          backgroundColor: ['rgba(148,163,184,0.3)'],
          borderColor: '#94a3b8',
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 48,
          barPercentage: 0.3,
        }],
      };
    }

    return {
      labels: [`${meses[m - 1]} ${y}`],
      datasets: [{
        label: 'Total',
        data: [this.currencyService.convertir(total)],
        backgroundColor: ['rgba(59,130,246,0.85)'],
        borderColor: '#3b82f6',
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 48,
        barPercentage: 0.3,
      }],
    };
  });

  private evolucionOptions(): any {
    const y = this.filtroFecha.anio();
    const m = this.filtroFecha.mes();
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const g = this.filtroGranularidad();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: '#94a3b8',
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            padding: 15,
            font: { size: 11, family: 'Inter' },
          },
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#94a3b8',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 10,
          padding: 12,
          displayColors: true,
          callbacks: {
            title: (items: any) => {
              const label = items?.[0]?.label;
              if (g === 'semana') return `Semana ${label ?? `${meses[m - 1]} ${y}`} ${meses[m - 1]} ${y}`;
              if (g === 'mes') return `${label ?? `${meses[m - 1]} ${y}`} · Total`;
              return `Día ${label ?? ''} ${meses[m - 1]} ${y}`;
            },
            label: (item: any) => {
              const val = item.parsed?.y ?? item.parsed ?? 0;
              const dataset = item.dataset;
              let label = String(dataset.label || '');
              if (label) {
                label += ': ';
              }
              label += this.currencyService.formatearValor(Number(val) || 0);
              return label;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
          ticks: { color: '#475569', font: { size: 10, family: 'Inter' }, maxTicksLimit: 12, padding: 8 },
          border: { display: false },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
          ticks: {
            color: '#475569',
            font: { size: 10, family: 'Inter' },
            padding: 8,
            callback: (val: any) => this.currencyService.formatearValor(Number(val), 0),
          },
          border: { display: false },
          beginAtZero: true,
        },
      },
    };
  }

  lineChartOptions = computed<any>(() => this.evolucionOptions());

  // ===== CHART.JS: Donut (Gastos por categoría) =====
  donutChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const cats = this.gastosPorCategoriaPeriodo();
    return {
      labels: cats.map(c => c.name),
      datasets: [{
        data: cats.map(c => this.currencyService.convertir(c.amountUSD)),
        backgroundColor: cats.map(c => c.color),
        borderColor: '#111827',
        borderWidth: 2,
        hoverBorderColor: '#1e293b',
        hoverOffset: 10,
        hoverBorderWidth: 3,
      }],
    };
  });

  donutChartOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#94a3b8',
        bodyColor: '#f1f5f9',
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 16,
        displayColors: true,
        boxPadding: 6,
        callbacks: {
          title: (item: any) => {
            const cat = this.gastosPorCategoriaPeriodo()[item.dataIndex];
            return cat?.name || 'Categoría';
          },
          label: (item: any) => {
            const val = item.parsed;
            const total = this.totalGastadoPeriodoUSD();
            const cat = this.gastosPorCategoriaPeriodo()[item.dataIndex];
            const pct = total > 0 ? Math.round((cat?.amountUSD / total) * 100) : 0;
            const formatted = this.currencyService.formatearValor(Number(val));
            return [
              `Gastado: ${formatted}`,
              `Porcentaje: ${pct}%`,
              `Presupuesto: ${this.currencyService.formatear(cat?.amountUSD * 1.5 || 0)}`,
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
  hasBarChartData(): boolean {
    const data = this.barChartData();
    return data.datasets && data.datasets[0] && data.datasets[0].data && data.datasets[0].data.length > 0;
  }

  hasLineChartData(): boolean {
    const data = this.lineChartData();
    return data.datasets && data.datasets[0] && data.datasets[0].data && data.datasets[0].data.length > 0;
  }

  hasDonutChartData(): boolean {
    const data = this.donutChartData();
    return data.datasets && data.datasets[0] && data.datasets[0].data && data.datasets[0].data.length > 0;
  }

  getBarChartDataLength(): number {
    return this.hasBarChartData() ? this.barChartData().datasets[0].data.length : 0;
  }

  getLineChartDataLength(): number {
    return this.hasLineChartData() ? this.lineChartData().datasets[0].data.length : 0;
  }

  hasChartDataForGranularidad(): boolean {
    const gran = this.filtroGranularidad();
    if (gran === 'mes') {
      return this.hasBarChartData();
    }
    return this.hasLineChartData();
  }

  // ===== Otros computed =====
  movimientosRecientes = computed(() => {
    const gastos = this.gastosDelMes().map((g) => ({
      tipo: 'gasto' as const,
      descripcion: g.descripcion,
      categoria: g.categoria?.nombre || 'Sin categoría',
      fecha: g.fecha,
      monto: Number(g.monto),
      icono: this.getIconoCategoria(g.categoria?.nombre),
    }));

    const ingresosList = this.ingresosDelMes().map((i) => ({
      tipo: 'ingreso' as const,
      descripcion: i.descripcion,
      categoria: 'Ingreso',
      fecha: i.fecha,
      monto: Number(i.monto),
      icono: 'banknote',
    }));

    return [...gastos, ...ingresosList]
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 5);
  });

  mayorGasto = computed(() => {
    const list = this.gastosDelMes();
    if (list.length === 0) return null;
    return list.reduce((max, g) => Number(g.monto) > Number(max.monto) ? g : max, list[0]);
  });

  diaMasGastos = computed(() => {
    const gastos = this.gastosDelMes();
    if (gastos.length === 0) return null;
    const y = this.filtroFecha.anio();
    const m = this.filtroFecha.mes();
    const diasEnMes = new Date(y, m, 0).getDate();
    const gastosPorDia: number[] = new Array(diasEnMes).fill(0);
    gastos.forEach((g) => {
      const d = new Date(g.fecha).getDate() - 1;
      if (d >= 0 && d < diasEnMes) gastosPorDia[d] += Number(g.monto);
    });
    let maxIdx = 0;
    gastosPorDia.forEach((v, i) => { if (v > gastosPorDia[maxIdx]) maxIdx = i; });
    const monto = gastosPorDia[maxIdx];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return { fecha: `${maxIdx + 1} ${meses[m - 1]}`, monto: this.currencyService.formatear(monto) };
  });

  resumenMensaje = computed(() => {
    const actual = this.totalGastadoUSD();
    const anterior = this.gastosMesAnterior().reduce((s, g) => s + Number(g.monto), 0);
    if (anterior === 0) return { positivo: actual === 0, texto: actual > 0 ? 'Es su primer mes registrado' : 'Sin gastos este mes', pct: 0 };
    const diff = Math.round(((actual - anterior) / anterior) * 100);
    if (actual <= anterior) {
      return { positivo: true, texto: `Has gastado ${Math.abs(diff)}% menos que el mes anterior`, pct: Math.abs(diff) };
    }
    return { positivo: false, texto: `Has gastado ${diff}% más que el mes anterior`, pct: diff };
  });

  presupuestos = computed(() => {
    const cats = this.gastosPorCategoria();
    const presupuestosBase = PRESUPUESTOS_BASE;
    const colores = ['#1268ff', '#00e7a8', '#7228e8', '#ffa500', '#ff4259', '#00b9e8', '#fbbf24', '#ff6b9d'];

    return cats.map((c, i) => {
      const limite = presupuestosBase[c.name] || Math.max(c.amountUSD * 1.5, 500);
      const porcentaje = Math.round((c.amountUSD / limite) * 1000) / 10;
      return {
        nombre: c.name,
        icono: this.getIconoCategoria(c.name),
        gastado: c.amountFormatted,
        gastadoNum: c.amountUSD,
        limite: this.currencyService.formatear(limite),
        limiteNum: limite,
        porcentaje,
        color: c?.color || colores[i % colores.length],
        alerta: porcentaje >= 80,
      };
    });
  });

  presupuestoTotales = computed(() => {
    const items = this.presupuestos();
    const usado = items.reduce((s, p) => s + p.gastadoNum, 0);
    const limite = Math.max(items.reduce((s, p) => s + p.limiteNum, 0), PRESUPUESTO_TOTAL_BASE);
    const pct = limite > 0 ? Math.round((usado / limite) * 1000) / 10 : 0;
    return { usado, limite, pct };
  });

  presupuestoTotalLimite = computed(() =>
    this.currencyService.formatear(this.presupuestoTotales().limite));

  presupuestosVisibles = computed(() => this.presupuestos().slice(0, 5));

  todosLosMovimientos = computed(() => {
    const gastos = this.gastosDelMes().map((g) => ({
      tipo: 'gasto' as const,
      descripcion: g.descripcion,
      categoria: g.categoria?.nombre || 'Sin categoría',
      fecha: g.fecha,
      monto: Number(g.monto),
      icono: this.getIconoCategoria(g.categoria?.nombre),
    }));
    const ingresosList = this.ingresosDelMes().map((i) => ({
      tipo: 'ingreso' as const,
      descripcion: i.descripcion,
      categoria: 'Ingreso',
      fecha: i.fecha,
      monto: Number(i.monto),
      icono: 'banknote',
    }));
    return [...gastos, ...ingresosList].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  });

  presupuestoCritico = computed(() => {
    const pres = this.presupuestos().filter(p => p.alerta);
    if (pres.length === 0) return null;
    return pres.reduce((max, p) => p.porcentaje > max.porcentaje ? p : max, pres[0]);
  });

  ngOnInit(): void {
    this.gastoForm = this.fb.group({
      descripcion: ['', [Validators.required, Validators.maxLength(100)]],
      monto: ['', [Validators.required, Validators.min(0.01)]],
      fecha: [this.filtroFecha.hoyIso(), [Validators.required]],
      categoriaId: ['', [Validators.required]],
    });
    this.cargarDatos();
  }

  public cargarDatos(): void {
    this.cargando.set(true);
    this.errorMsg.set(null);

    const y = this.filtroFecha.anio();
    const m = this.filtroFecha.mes();
    const { anio: yAnt, mes: mAnt } = this.mesAnteriorDe(y, m);
    const { anio: yAnt2, mes: mAnt2 } = this.mesAnteriorDe(yAnt, mAnt);
    const rangoActual = this.getRangoMes(y, m);
    const rangoAnterior = this.getRangoMes(yAnt, mAnt);
    const rangoPenultimo = this.getRangoMes(yAnt2, mAnt2);

    let gastosLoaded = false;
    let ingresosLoaded = false;

    const checkDone = () => {
      if (!gastosLoaded || !ingresosLoaded) return;
      const filtrar = (item: { fecha: string }, rango: { start: Date; end: Date }) => {
        const f = new Date(item.fecha);
        return f >= rango.start && f <= rango.end;
      };
      this.gastosDelMes.set(this.gastos().filter((g) => filtrar(g, rangoActual)));
      this.gastosMesAnterior.set(this.gastos().filter((g) => filtrar(g, rangoAnterior)));
      this.gastosPenultimo.set(this.gastos().filter((g) => filtrar(g, rangoPenultimo)));
      this.ingresosDelMes.set(this.ingresos().filter((i) => filtrar(i, rangoActual)));
      this.ingresosMesAnterior.set(this.ingresos().filter((i) => filtrar(i, rangoAnterior)));
      this.cargando.set(false);
    };

    this.categoriasService.getCategoriasCompletas().subscribe({
      next: (cats) => this.categorias.set(cats),
      error: () => this.categorias.set([]),
    });

    this.gastosService.getGastosCompletos().subscribe({
      next: (g) => { this.gastos.set(g); gastosLoaded = true; checkDone(); },
      error: (err) => {
        this.cargando.set(false);
        this.errorMsg.set('No se pudieron cargar los gastos.');
        console.error(err);
      },
    });

    this.ingresosService.getIngresosCompletos().subscribe({
      next: (i) => { this.ingresos.set(i); ingresosLoaded = true; checkDone(); },
      error: (err) => {
        this.cargando.set(false);
        this.errorMsg.set('No se pudieron cargar los ingresos.');
        console.error(err);
      },
    });
  }

  private mesAnteriorDe(y: number, m: number): { anio: number; mes: number } {
    return { anio: m === 1 ? y - 1 : y, mes: m === 1 ? 12 : m - 1 };
  }

  public abrirNuevoGastoModal(): void {
    this.gastoForm.reset({
      descripcion: '',
      monto: '',
      fecha: this.filtroFecha.hoyIso(),
      categoriaId: this.categorias().length > 0 ? this.categorias()[0].id : '',
    });
    this.mostrarGastoModal.set(true);
  }

  public cerrarGastoModal(): void {
    this.mostrarGastoModal.set(false);
  }

  public guardarGasto(): void {
    if (this.gastoForm.invalid) {
      this.gastoForm.markAllAsTouched();
      return;
    }
    const fv = this.gastoForm.value;
    this.gastosService.createGasto({
      descripcion: fv.descripcion,
      monto: Number(fv.monto),
      fecha: fv.fecha,
      categoriaId: fv.categoriaId,
    }).subscribe({
      next: () => { this.cerrarGastoModal(); this.cargarDatos(); },
      error: (err) => { alert(err?.error?.message ?? 'Error al guardar.'); },
    });
  }

  public getIconoCategoria(nombre?: string): string {
    const icons: { [key: string]: string } = {
      'Comida': 'utensils',
      'Alimentacion': 'utensils',
      'Transporte': 'car',
      'Servicios': 'zap',
      'Hogar': 'home',
      'Vivienda': 'home',
      'Salud': 'heart-pulse',
      'Educación': 'graduation-cap',
      'Educacion': 'graduation-cap',
      'Entretenimiento': 'clapperboard',
      'Compras': 'shopping-bag',
      'Viajes': 'plane',
      'Otros': 'package',
      'Sueldo': 'wallet',
      'Bonificación': 'gift',
      'Ventas': 'shopping-bag',
    };
    return icons[nombre || ''] || 'package';
  }

  public irAPresupuestos(): void { this.router.navigate(['/presupuestos']); }
  public setFiltroGranularidad(f: 'dia' | 'semana' | 'mes'): void { this.filtroGranularidad.set(f); }
  public setFiltroPeriodoCategorias(f: 'mes' | 'mesAnterior' | 'tresMeses'): void { this.filtroPeriodoCategorias.set(f); }

  public scrollA(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  ngOnDestroy(): void {
    // Cleanup any subscriptions if needed in the future
  }
}
