import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { GastosService, Gasto } from '../../services/gastos.service';
import { IngresosService, Ingreso } from '../../services/ingresos.service';
import { CurrencyService } from '../../services/currency.service';
import { ConfigService } from '../../services/config.service';
import { FiltroFechaService } from '../../services/filtro-fecha.service';
import { SelectorMesComponent } from '../../components/selector-mes/selector-mes.component';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { LucideIconComponent } from '../../components/lucide-icon/lucide-icon.component';

interface Movimiento {
  id: string;
  tipo: 'gasto' | 'ingreso';
  descripcion: string;
  categoria: string;
  fecha: string;
  monto: number;
  icono: string;
}

@Component({
  selector: 'app-movimientos',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectorMesComponent, SidebarComponent, LucideIconComponent],
  templateUrl: './movimientos.component.html',
  styleUrl: '../dashboard/dashboard.component.css',
})
export class MovimientosComponent implements OnInit {
  private authService = inject(AuthService);
  private gastosService = inject(GastosService);
  private ingresosService = inject(IngresosService);
  currencyService = inject(CurrencyService);
  configService = inject(ConfigService);
  filtroFecha = inject(FiltroFechaService);

  usuario = this.authService.getUsuario();
  cargando = signal(false);
  errorMsg = signal<string | null>(null);

  movimientos = signal<Movimiento[]>([]);

  filtroTipo = signal<'todos' | 'gasto' | 'ingreso'>('todos');
  busqueda = signal('');
  pagina = signal(1);
  readonly porPagina = 10;

  totalIngresosUSD = computed(() =>
    this.movimientos().filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0));
  totalGastosUSD = computed(() =>
    this.movimientos().filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0));
  totalIngresos = computed(() => this.currencyService.formatear(this.totalIngresosUSD()));
  totalGastos = computed(() => this.currencyService.formatear(this.totalGastosUSD()));

  movimientosFiltrados = computed(() => {
    const tipo = this.filtroTipo();
    const q = this.busqueda().trim().toLowerCase();
    return this.movimientos().filter((m) => {
      if (tipo !== 'todos' && m.tipo !== tipo) return false;
      if (q && !(`${m.descripcion} ${m.categoria}`.toLowerCase().includes(q))) return false;
      return true;
    });
  });

  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.movimientosFiltrados().length / this.porPagina)));

  movimientosPaginados = computed(() => {
    const inicio = (this.pagina() - 1) * this.porPagina;
    return this.movimientosFiltrados().slice(inicio, inicio + this.porPagina);
  });

  hayMovimientos = computed(() => this.movimientosFiltrados().length > 0);

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando.set(true);
    this.errorMsg.set(null);
    const y = this.filtroFecha.anio();
    const m = this.filtroFecha.mes();
    const rango = this.getRangoMes(y, m);

    let gastosList: Movimiento[] = [];
    let ingresosList: Movimiento[] = [];

    this.gastosService.getGastos({
      startDate: rango.start.toISOString(),
      endDate: rango.end.toISOString(),
    }).subscribe({
      next: (g) => {
        gastosList = g.map((x) => ({
          id: x.id, tipo: 'gasto', descripcion: x.descripcion,
          categoria: x.categoria?.nombre || 'Sin categoría',
          fecha: x.fecha, monto: Number(x.monto), icono: this.getIconoCategoria(x.categoria?.nombre),
        }));
        this.ingresosService.getIngresos({
          startDate: rango.start.toISOString(),
          endDate: rango.end.toISOString(),
        }).subscribe({
          next: (i) => {
            ingresosList = i.map((x) => ({
              id: x.id, tipo: 'ingreso', descripcion: x.descripcion,
              categoria: 'Ingreso', fecha: x.fecha, monto: Number(x.monto), icono: 'trending-up',
            }));
            const todos = [...gastosList, ...ingresosList]
              .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
            this.movimientos.set(todos);
            this.pagina.set(1);
            this.cargando.set(false);
          },
          error: () => { this.errorMsg.set('No se pudieron cargar los ingresos.'); this.cargando.set(false); },
        });
      },
      error: () => { this.errorMsg.set('No se pudieron cargar los gastos.'); this.cargando.set(false); },
    });
  }

  onMesCambiado(_: { mes: number; anio: number }): void {
    this.cargarDatos();
  }

  onFiltroTipoChange(tipo: 'todos' | 'gasto' | 'ingreso'): void {
    this.filtroTipo.set(tipo);
    this.pagina.set(1);
  }

  onBusquedaChange(value: string): void {
    this.busqueda.set(value);
    this.pagina.set(1);
  }

  paginaAnterior(): void {
    if (this.pagina() > 1) this.pagina.set(this.pagina() - 1);
  }

  paginaSiguiente(): void {
    if (this.pagina() < this.totalPaginas()) this.pagina.set(this.pagina() + 1);
  }

  getRangoMes(anio: number, mes: number): { start: Date; end: Date } {
    return {
      start: new Date(anio, mes - 1, 1, 0, 0, 0, 0),
      end: new Date(anio, mes, 0, 23, 59, 59, 999),
    };
  }

  getIconoCategoria(nombre?: string): string {
    const n = (nombre || '').toLowerCase();
    if (n.includes('comida') || n.includes('food')) return 'utensils';
    if (n.includes('transporte') || n.includes('transit')) return 'car';
    if (n.includes('servicio')) return 'zap';
    if (n.includes('entreten')) return 'clapperboard';
    if (n.includes('salud')) return 'heart-pulse';
    if (n.includes('educ')) return 'graduation-cap';
    if (n.includes('ropa')) return 'shirt';
    return 'tag';
  }

  formatearFecha(fecha: string): string {
    return this.configService.formatearFecha(fecha);
  }
}