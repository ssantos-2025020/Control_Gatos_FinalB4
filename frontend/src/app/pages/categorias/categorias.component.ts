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
import { ConfigService } from '../../services/config.service';
import { FiltroFechaService } from '../../services/filtro-fecha.service';
import { crearFiltrosAnteriores } from '../../utils/filtros-record';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { LucideIconComponent } from '../../components/lucide-icon/lucide-icon.component';

const PREFS_KEY = 'cg_categorias_visual';
const COLORES = ['#1268ff', '#00b9e8', '#00e7a8', '#7228e8', '#ff6b9d', '#00d0a8', '#ffa500', '#fbbf24', '#6ea8ff', '#c084fc', '#ff8a9a'];
const ICONOS = ['tag', 'utensils', 'car', 'zap', 'wifi', 'heart-pulse', 'graduation-cap', 'clapperboard', 'shirt', 'shopping-bag', 'plane', 'paw-print', 'home', 'wallet', 'piggy-bank'];
const ICON_LABELS: Record<string, string> = {
  tag: 'Etiqueta',
  utensils: 'Comida',
  car: 'Transporte',
  zap: 'Servicios',
  wifi: 'Internet',
  'heart-pulse': 'Salud',
  'graduation-cap': 'Educación',
  clapperboard: 'Entretenimiento',
  shirt: 'Ropa',
  'shopping-bag': 'Compras',
  plane: 'Viajes',
  'paw-print': 'Mascotas',
  home: 'Hogar',
  wallet: 'Billetera',
  'piggy-bank': 'Ahorro',
};

interface CatPref {
  color: string;
  icono: string;
  descripcion: string;
  estado?: 'Activa' | 'Inactiva';
}

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, BaseChartDirective, RouterLink, SidebarComponent, LucideIconComponent],
  templateUrl: './categorias.component.html',
  styleUrl: './categorias.component.css',
})
export class CategoriasComponent implements OnInit, OnDestroy {
  Math = Math;
  private authService = inject(AuthService);
  private categoriasService = inject(CategoriasService);
  private gastosService = inject(GastosService);
  private fb = inject(FormBuilder);
  filtroFecha = inject(FiltroFechaService);
  currencyService = inject(CurrencyService);
  configService = inject(ConfigService);

  usuarioActual = this.authService.getUsuario();

  categorias = signal<Categoria[]>([]);
  gastos = signal<Gasto[]>([]);
  prefs = signal<{ [id: string]: CatPref }>(this.leerPrefs());

  cargando = signal(false);
  guardando = signal(false);
  errorMsg = signal<string | null>(null);
  formErrorMsg = signal<string | null>(null);
  toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  categoriaForm!: FormGroup;
  categoriaEditando = signal<Categoria | null>(null);

  get esCreacion(): boolean {
    return !this.categoriaEditando();
  }

  colorSeleccionado = signal(COLORES[0]);
  iconoSeleccionado = signal('tag');
  iconoElegido = signal(false);
  iconoMenuAbierto = signal(false);
  descripcion = signal('');

  filtroBusqueda = signal('');
  filtroEstado = signal<'Todas' | 'Activa' | 'Inactiva'>('Todas');
  filtroCategoriaId = signal('');
  pagina = signal(1);
  readonly porPagina = 10;

  filtrosAnteriores = crearFiltrosAnteriores<{
    busqueda: string;
    categoriaId: string;
    estado: 'Todas' | 'Activa' | 'Inactiva';
  }>();

  readonly coloresPaleta = COLORES;
  readonly iconosDisponibles = ICONOS;

  gastosPeriodo = computed(() => {
    const mes = this.filtroFecha.mes();
    const anio = this.filtroFecha.anio();
    return this.gastos().filter((g) => {
      const d = new Date(g.fecha);
      return !isNaN(d.getTime()) && d.getMonth() + 1 === mes && d.getFullYear() === anio;
    });
  });

  totalGastosPeriodo = computed(() => this.gastosPeriodo().reduce((s, g) => s + Number(g.monto), 0));
  totalGastosPeriodoFormateado = computed(() => this.currencyService.formatear(this.totalGastosPeriodo()));
  mesAnio = computed(() => this.filtroFecha.getLabelMes());

  gastosPorCategoria = computed(() => {
    const map: { [key: string]: { monto: number; nombre: string } } = {};
    this.gastosPeriodo().forEach((g) => {
      const nombre = g.categoria?.nombre || 'Sin categoría';
      map[nombre] = { nombre, monto: (map[nombre]?.monto ?? 0) + Number(g.monto) };
    });
    const total = this.totalGastosPeriodo() || 1;
    const list = Object.values(map)
      .map((x) => ({ ...x, formateado: this.currencyService.formatear(x.monto), pct: Math.round((x.monto / total) * 100) }))
      .sort((a, b) => b.monto - a.monto);
    const presentes = new Set(list.map((x) => x.nombre));
    this.categorias().forEach((c) => {
      if (!presentes.has(c.nombre)) {
        list.push({ nombre: c.nombre, monto: 0, formateado: this.currencyService.formatear(0), pct: 0 });
      }
    });
    return list;
  });

  masUtilizada = computed(() => {
    const top = this.gastosPorCategoria()[0];
    return { nombre: top?.nombre ?? '—', pct: top?.pct ?? 0 };
  });

  estadoDe = (c: Categoria): 'Activa' | 'Inactiva' => this.prefs()[c.id]?.estado ?? 'Activa';

  totalCategorias = computed(() => this.categorias().length);

  categoriasActivas = computed(() => this.categorias().filter((c) => this.estadoDe(c) === 'Activa').length);

  pctActivas = computed(() => (this.totalCategorias() ? Math.round((this.categoriasActivas() / this.totalCategorias()) * 100) : 0));

  ultimaCategoria = computed(() => {
    const cats = [...this.categorias()].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
    return cats.length ? cats[cats.length - 1] : null;
  });

  filas = computed(() => {
    const total = this.totalGastosPeriodo() || 1;
    return this.categorias().map((c, i) => {
      const pref = this.prefs()[c.id];
      const gasto = this.gastosPeriodo().filter((g) => g.categoriaId === c.id).reduce((s, g) => s + Number(g.monto), 0);
      return {
        categoria: c,
        color: pref?.color ?? c.color ?? COLORES[i % COLORES.length],
        icono: pref?.icono ?? c.icono ?? 'tag',
        descripcion: pref?.descripcion ?? (c.descripcion ?? ''),
        gastoUSD: gasto,
        gasto: this.currencyService.formatear(gasto),
        pct: total > 0 ? Math.round((gasto / total) * 100) : 0,
        estado: this.estadoDe(c),
      };
    });
  });

  private coincideFiltros(f: { categoria: Categoria; estado: string }): boolean {
    const q = this.filtroBusqueda().trim().toLowerCase();
    if (q && !f.categoria.nombre.toLowerCase().includes(q)) return false;
    const est = this.filtroEstado();
    if (est !== 'Todas' && f.estado !== est) return false;
    const catId = this.filtroCategoriaId();
    if (catId && f.categoria.id !== catId) return false;
    return true;
  }

  filasFiltradas = computed(() => this.filas().filter((f) => this.coincideFiltros(f)));

  /** Nombres de categoría que cumplen TODOS los filtros de tabla activos. Sin filtros activos, todas. */
  categoriasEnFiltro = computed<Set<string>>(() => {
    const q = this.filtroBusqueda().trim();
    if (!q && this.filtroEstado() === 'Todas' && !this.filtroCategoriaId()) {
      return new Set(this.categorias().map((c) => c.nombre));
    }
    return new Set(this.filas().filter((f) => this.coincideFiltros(f)).map((f) => f.categoria.nombre));
  });

  filasPaginadas = computed(() => {
    const inicio = (this.pagina() - 1) * this.porPagina;
    return this.filasFiltradas().slice(inicio, inicio + this.porPagina);
  });

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.filasFiltradas().length / this.porPagina)));

  filaInicio = computed(() => (this.filasFiltradas().length === 0 ? 0 : (this.pagina() - 1) * this.porPagina + 1));

  filaFin = computed(() => Math.min(this.pagina() * this.porPagina, this.filasFiltradas().length));

  colorDe = (nombre: string): string => {
    const c = this.categorias().find((cat) => cat.nombre === nombre);
    const idx = c ? this.categorias().indexOf(c) : 0;
    return this.prefs()[c?.id ?? '']?.color ?? c?.color ?? COLORES[idx % COLORES.length];
  };

  opacidadDe = (nombre: string): number => (this.categoriasEnFiltro().has(nombre) ? 1 : 0.35);

  private hexToRgba(hex: string, alpha: number): string {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  donutData = computed<ChartConfiguration<'doughnut'>['data']>(() => ({
    labels: this.gastosPorCategoria().map((x) => x.nombre),
    datasets: [{
      data: this.gastosPorCategoria().map((x) => this.currencyService.convertir(x.monto)),
      backgroundColor: this.gastosPorCategoria().map((x) => this.hexToRgba(this.colorDe(x.nombre), this.opacidadDe(x.nombre))),
      borderColor: '#071a33',
      borderWidth: 2,
      hoverOffset: 8,
    }],
  }));

  donutOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '64%',
    animation: { duration: 350, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#081d38',
        titleColor: '#bcc7e8',
        bodyColor: '#ffffff',
        borderColor: 'rgba(122,160,255,0.2)',
        borderWidth: 1,
        cornerRadius: 10,
        padding: 12,
        callbacks: {
          label: (item: any) => {
            const x = this.gastosPorCategoria()[item.dataIndex];
            return `${this.currencyService.formatearValor(Number(item.parsed))} (${x.pct}%)`;
          },
        },
      },
    },
  }));

  iconoLabel = computed(() => (this.iconoElegido() ? this.filtrarNombreIcono(this.iconoSeleccionado()) : 'Selecciona un ícono'));

  ngOnInit(): void {
    this.categoriaForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(60)]],
    });
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  /** Muestra una notificación tipo toast. */
  private mostrarToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2800);
  }

  public cargarDatos(): void {
    this.cargando.set(true);
    this.errorMsg.set(null);
    this.categoriasService.getCategoriasCompletas().subscribe({
      next: (list) => {
        this.categorias.set(list);
        this.gastosService.getGastosCompletos().subscribe({
          next: (g) => {
            this.gastos.set(g);
            this.cargando.set(false);
          },
          error: () => { this.cargando.set(false); },
        });
      },
      error: (err) => {
        this.cargando.set(false);
        this.errorMsg.set('No se pudieron cargar las categorías.');
        console.error(err);
      },
    });
  }

  public onFiltroCambio(): void {
    this.filtrosAnteriores.descartar();
    this.pagina.set(1);
  }

  public limpiarFiltros(): void {
    if (this.filtroBusqueda().trim() || this.filtroCategoriaId() || this.filtroEstado() !== 'Todas') {
      this.filtrosAnteriores.guardar({
        busqueda: this.filtroBusqueda(),
        categoriaId: this.filtroCategoriaId(),
        estado: this.filtroEstado(),
      });
    }
    this.filtroBusqueda.set('');
    this.filtroEstado.set('Todas');
    this.filtroCategoriaId.set('');
    this.pagina.set(1);
  }

  public restaurarFiltrosAnteriores(): void {
    this.filtrosAnteriores.restaurar((v) => {
      this.filtroBusqueda.set(v.busqueda);
      this.filtroCategoriaId.set(v.categoriaId);
      this.filtroEstado.set(v.estado);
      this.pagina.set(1);
    });
  }

  public paginaAnterior(): void {
    if (this.pagina() > 1) this.pagina.set(this.pagina() - 1);
  }

  public paginaSiguiente(): void {
    if (this.pagina() < this.totalPaginas()) this.pagina.set(this.pagina() + 1);
  }

  public abrirNuevoModal(): void {
    this.resetForm();
    this.scrollAlFormulario();
  }

  public abrirEditarModal(categoria: Categoria): void {
    this.categoriaEditando.set(categoria);
    this.formErrorMsg.set(null);
    const pref = this.prefs()[categoria.id];
    this.categoriaForm.reset({ nombre: categoria.nombre });
    this.colorSeleccionado.set(pref?.color ?? categoria.color ?? COLORES[this.categorias().indexOf(categoria) % COLORES.length]);
    this.iconoSeleccionado.set(pref?.icono ?? categoria.icono ?? 'tag');
    this.iconoElegido.set(!!(pref?.icono ?? categoria.icono));
    this.iconoMenuAbierto.set(false);
    this.descripcion.set(pref?.descripcion ?? categoria.descripcion ?? '');
    this.scrollAlFormulario();
  }

  public cancelarEdicion(): void {
    this.resetForm();
  }

  public elegirIcono(icono: string): void {
    this.iconoSeleccionado.set(icono);
    this.iconoElegido.set(true);
    this.iconoMenuAbierto.set(false);
  }

  public filtrarNombreIcono(icono: string): string {
    const lbl = ICON_LABELS[icono];
    if (lbl) return lbl;
    return icono ? icono.charAt(0).toUpperCase() + icono.slice(1) : 'Selecciona un ícono';
  }

  private resetForm(): void {
    this.categoriaEditando.set(null);
    this.formErrorMsg.set(null);
    this.categoriaForm.reset({ nombre: '' });
    this.colorSeleccionado.set(this.getColorLibre());
    this.iconoSeleccionado.set('tag');
    this.iconoElegido.set(false);
    this.iconoMenuAbierto.set(false);
    this.descripcion.set('');
  }

  private scrollAlFormulario(): void {
    requestAnimationFrame(() => {
      document.getElementById('panel-formulario')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        const inp = document.getElementById('campo-nombre') as HTMLInputElement | null;
        if (inp) inp.focus();
      }, 400);
    });
  }

  private getColorLibre(): string {
    const usados = this.categorias().map((c) => this.prefs()[c.id]?.color).filter(Boolean);
    return COLORES.find((c) => !usados.includes(c)) ?? COLORES[this.categorias().length % COLORES.length];
  }

  public guardarCategoria(): void {
    if (this.categoriaForm.invalid) {
      this.categoriaForm.markAllAsTouched();
      return;
    }

    const nombre = (this.categoriaForm.value.nombre as string).trim();
    const editando = this.categoriaEditando();
    const duplicado = this.categorias().some(
      (c) => c.id !== editando?.id && c.nombre.trim().toLowerCase() === nombre.toLowerCase()
    );
    if (duplicado) {
      this.formErrorMsg.set('Ya existe una categoría con ese nombre.');
      return;
    }

    this.guardando.set(true);

    const onSuccess = (id: string) => {
      const prefsActuales = this.prefs();
      prefsActuales[id] = {
        color: this.colorSeleccionado(),
        icono: this.iconoSeleccionado(),
        descripcion: this.descripcion().trim(),
        estado: prefsActuales[id]?.estado ?? 'Activa',
      };
      this.prefs.set({ ...prefsActuales });
      this.escribirPrefs(this.prefs());
      this.guardando.set(false);
      this.categoriaEditando.set(null);
      this.iconoElegido.set(false);
      this.mostrarToast(editando ? 'Cambios guardados correctamente' : 'Categoría creada correctamente');
      this.cargarDatos();
    };

    if (editando) {
      this.categoriasService.updateCategoria(editando.id, nombre).subscribe({
        next: () => onSuccess(editando.id),
        error: (err) => {
          this.guardando.set(false);
          this.formErrorMsg.set(err?.error?.message ?? 'Ocurrió un error al actualizar la categoría.');
        },
      });
      return;
    }

    this.categoriasService.createCategoria(nombre).subscribe({
      next: (cat) => onSuccess(cat.id),
      error: (err) => {
        this.guardando.set(false);
        this.formErrorMsg.set(err?.error?.message ?? 'Ocurrió un error al crear la categoría.');
      },
    });
  }

  public eliminarCategoria(categoria: Categoria): void {
    if (!confirm(`¿Estás seguro de eliminar la categoría "${categoria.nombre}"? Los gastos ya registrados con ella no se eliminarán y quedarán en la categoría "Otros".`)) {
      return;
    }

    this.cargando.set(true);

    const finalizar = () => {
      this.cargando.set(false);
      const prefsNuevas = { ...this.prefs() };
      delete prefsNuevas[categoria.id];
      this.prefs.set(prefsNuevas);
      this.escribirPrefs(prefsNuevas);

      const otros = this.categorias().find((c) => c.nombre === 'Otros');
      this.gastos.set(
        this.gastos().map((g) =>
          g.categoriaId === categoria.id
            ? { ...g, categoriaId: otros?.id ?? g.categoriaId, categoria: otros ?? g.categoria }
            : g
        )
      );
      this.categorias.update((list) => list.filter((c) => c.id !== categoria.id));
      this.pagina.set(1);
    };

    this.categoriasService.deleteCategoria(categoria.id).subscribe({
      next: () => finalizar(),
      error: (err) => {
        this.cargando.set(false);
        alert(err?.error?.message ?? 'No se pudo eliminar la categoría.');
      },
    });
  }

  get nombreInvalido(): boolean {
    const c = this.categoriaForm.get('nombre');
    return !!c && c.invalid && c.touched;
  }

  get colorActual(): string {
    return this.colorSeleccionado();
  }

  private leerPrefs(): { [id: string]: CatPref } {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? (JSON.parse(raw) as { [id: string]: CatPref }) : {};
    } catch {
      return {};
    }
  }

  private escribirPrefs(prefs: { [id: string]: CatPref }): void {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }
}