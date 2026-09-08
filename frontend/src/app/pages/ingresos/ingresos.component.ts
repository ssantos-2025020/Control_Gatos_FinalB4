import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { LucideIconComponent } from '../../components/lucide-icon/lucide-icon.component';
import { IngresosService, Ingreso } from '../../services/ingresos.service';
import { UsuariosService } from '../../services/usuarios.service';
import { CurrencyService } from '../../services/currency.service';
import { ConfigService } from '../../services/config.service';
import { FiltroFechaService } from '../../services/filtro-fecha.service';
import { crearFiltrosAnteriores } from '../../utils/filtros-record';
import { CATEGORIAS_INGRESO } from '../../services/mock-data';
import { Usuario } from '../../models/usuario.model';

interface ComparacionTexto {
  valor: string;
  clase: string;
  icono: string;
}

@Component({
  selector: 'app-ingresos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, SidebarComponent, LucideIconComponent],
  templateUrl: './ingresos.component.html',
  styleUrls: ['../dashboard/dashboard.component.css', './ingresos.component.css'],
})
export class IngresosComponent implements OnInit, OnDestroy {
  Math = Math;
  catIngresos = CATEGORIAS_INGRESO;

  guardando = signal(false);
  toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private authService = inject(AuthService);
  private ingresosService = inject(IngresosService);
  private usuariosService = inject(UsuariosService);
  private fb = inject(FormBuilder);
  currencyService = inject(CurrencyService);
  configService = inject(ConfigService);
  filtroFecha = inject(FiltroFechaService);

  usuario = this.authService.getUsuario();

  cargando = signal(false);
  errorMsg = signal<string | null>(null);

  ingresos = signal<Ingreso[]>([]);
  usuarios = signal<Usuario[]>([]);

  // Filtros
  filtroSearch = signal('');
  filtroCategoria = signal('');
  filtroFechaInicio = signal('');
  filtroFechaFin = signal('');

  // Paginación
  pagina = signal(1);
  readonly porPagina = 5;

  filtrosAnteriores = crearFiltrosAnteriores<{
    search: string;
    categoria: string;
    fechaInicio: string;
    fechaFin: string;
  }>();

  // Modal crear / editar
  mostrarModal = signal(false);
  ingresoEditando = signal<Ingreso | null>(null);
  ingresoForm!: FormGroup;

  // Modal confirmar eliminar
  mostrarConfirmacion = signal(false);
  ingresoAEliminar = signal<Ingreso | null>(null);

  private colorPorNombre = (n?: string | null): string =>
    this.catIngresos.find((c) => c.nombre === n)?.color ?? '';

  public colorCategoria(n?: string | null): string {
    return this.colorPorNombre(n) || '#00e7a8';
  }

  public iconoCategoria(n?: string | null): string {
    return this.catIngresos.find((c) => c.nombre === n)?.icono || 'banknote';
  }

  public colorMetodo(m?: string | null): string {
    const paleta: { [k: string]: string } = {
      Efectivo: '#00e7a8',
      'Tarjeta': '#a855f7',
      Transferencia: '#1268ff',
    };
    return paleta[m ?? ''] ?? '#94a3b8';
  }

  public inicialUsuario(nombre?: string | null): string {
    return (nombre || '?').trim().charAt(0).toUpperCase();
  }

  // ===== Rango del mes de referencia (Mayo 2026) =====
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

  // ===== Filtrado combinado =====
  /** Filtros no basados en fecha (búsqueda + categoría). */
  private filtroBasico = computed<Ingreso[]>(() => {
    const search = this.filtroSearch().trim().toLowerCase();
    const cat = this.filtroCategoria();
    return this.ingresos().filter((i) => {
      if (search) {
        const coincide = i.descripcion.toLowerCase().includes(search)
          || (i.usuario?.nombre ?? '').toLowerCase().includes(search)
          || (i.categoria ?? '').toLowerCase().includes(search);
        if (!coincide) return false;
      }
      if (cat && (i.categoria ?? '') !== cat) return false;
      return true;
    });
  });

  ingresosFiltrados = computed<Ingreso[]>(() => {
    const ini = this.filtroFechaInicio();
    const fin = this.filtroFechaFin();
    const base = this.filtroBasico();
    const fechaDia = (iso: string) => new Date(iso).toISOString().substring(0, 10);
    return base.filter((i) => {
      const f = fechaDia(i.fecha);
      if (ini && f < ini) return false;
      if (fin && f > fin) return false;
      return true;
    });
  });

  /** Ingresos del período/mes seleccionado, SIN filtros de tabla: alimentan las tarjetas de resumen. */
  ingresosPeriodo = computed<Ingreso[]>(() => {
    const mes = this.filtroFecha.mes();
    const anio = this.filtroFecha.anio();
    return this.ingresos().filter((i) => {
      const d = new Date(i.fecha);
      return !isNaN(d.getTime()) && d.getMonth() + 1 === mes && d.getFullYear() === anio;
    });
  });

  totalIngresosPeriodoUSD = computed(() => this.ingresosPeriodo().reduce((s, i) => s + Number(i.monto), 0));

  totalIngresosPeriodo = computed(() => this.currencyService.formatear(this.totalIngresosPeriodoUSD()));

  // ===== Estadísticas =====
  totalIngresosUSD = computed(() =>
    this.ingresosFiltrados().reduce((s, i) => s + Number(i.monto), 0));

  totalIngresos = computed(() => this.currencyService.formatear(this.totalIngresosUSD()));

  cantidadIngresos = computed(() => this.ingresosFiltrados().length);

  diasEnRango = computed(() => new Date(this.filtroFecha.anio(), this.filtroFecha.mes(), 0).getDate());

  promedioDiario = computed(() =>
    this.currencyService.formatear(this.totalIngresosPeriodoUSD() / this.diasEnRango()));

  ultimoIngreso = computed<Ingreso | null>(() => {
    const list = this.ingresosPeriodo();
    return list.length
      ? [...list].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0]
      : null;
  });

  // ===== Comparación con el mes anterior =====
  comparacionPct = computed<number | null>(() => {
    const prev = this.mesAnteriorDe(this.filtroFecha.anio(), this.filtroFecha.mes());
    const previo = this.ingresos().reduce((s, i) => {
      const d = new Date(i.fecha);
      return !isNaN(d.getTime()) && d.getFullYear() === prev.anio && d.getMonth() + 1 === prev.mes ? s + Number(i.monto) : s;
    }, 0);
    const actual = this.totalIngresosPeriodoUSD();
    if (!previo) return null;
    return ((actual - previo) / previo) * 100;
  });

  comparacionTexto = computed<ComparacionTexto>(() => {
    const p = this.comparacionPct();
    if (p === null || p === undefined) {
      return { valor: '—', clase: 'neutral', icono: 'arrow-right' };
    }
    const n = Math.round(Math.abs(p));
    return p >= 0
      ? { valor: `↑ ${n}%`, clase: 'up', icono: 'arrow-up-right' }
      : { valor: `↓ ${n}%`, clase: 'down', icono: 'arrow-down-right' };
  });

  // ===== Paginación =====
  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.ingresosFiltrados().length / this.porPagina)));

  paginas = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, i) => i + 1));

  ingresosPaginados = computed(() => {
    const inicio = (this.pagina() - 1) * this.porPagina;
    return this.ingresosFiltrados().slice(inicio, inicio + this.porPagina);
  });

  ngOnInit(): void {
    this.ingresoForm = this.fb.group({
      descripcion: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      monto: ['', [Validators.required, Validators.min(0.01), this.maxDosDecimalesValidator()]],
      fecha: [this.filtroFecha.hoyIso(), [Validators.required]],
      categoria: [''],
      metodo: ['Transferencia'],
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
    this.ingresoForm.get('monto')?.setValue(formateado, { emitEvent: false });
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
      this.cerrarModal();
    }
  }

  public cargarDatos(): void {
    this.cargando.set(true);
    this.errorMsg.set(null);

    this.usuariosService.getUsuariosCompletos().subscribe({
      next: (list) => this.usuarios.set(list),
      error: () => { /* el dropdown queda con solo "Todos" */ },
    });

    this.ingresosService.getIngresosCompletos().subscribe({
      next: (list) => {
        this.ingresos.set(list);
        this.pagina.set(1);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.errorMsg.set('No se pudieron cargar los ingresos.');
        console.error(err);
      },
    });
  }

  // ===== Filtros =====
  public limpiarFiltros(): void {
    if (
      this.filtroSearch().trim() || this.filtroCategoria() ||
      this.filtroFechaInicio() !== this.mesInicioIso() || this.filtroFechaFin() !== this.mesFinIso()
    ) {
      this.filtrosAnteriores.guardar({
        search: this.filtroSearch(),
        categoria: this.filtroCategoria(),
        fechaInicio: this.filtroFechaInicio(),
        fechaFin: this.filtroFechaFin(),
      });
    }
    this.filtroSearch.set('');
    this.filtroCategoria.set('');
    this.filtroFechaInicio.set(this.mesInicioIso());
    this.filtroFechaFin.set(this.mesFinIso());
    this.pagina.set(1);
  }

  public restaurarFiltrosAnteriores(): void {
    this.filtrosAnteriores.restaurar((v) => {
      this.filtroSearch.set(v.search);
      this.filtroCategoria.set(v.categoria);
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

  // ===== Paginación =====
  public irPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas()) this.pagina.set(p);
  }

  public paginaAnterior(): void {
    if (this.pagina() > 1) this.pagina.set(this.pagina() - 1);
  }

  public paginaSiguiente(): void {
    if (this.pagina() < this.totalPaginas()) this.pagina.set(this.pagina() + 1);
  }

  // ===== Modal crear / editar =====
  public abrirNuevoModal(): void {
    this.ingresoEditando.set(null);
    this.guardando.set(false);
    this.ingresoForm.reset({
      descripcion: '',
      monto: '',
      fecha: this.filtroFecha.hoyIso(),
      categoria: '',
      metodo: 'Transferencia',
      usuarioId: '',
    });
    this.mostrarModal.set(true);
  }

  public abrirEditarModal(ingreso: Ingreso): void {
    this.ingresoEditando.set(ingreso);
    this.guardando.set(false);
    this.ingresoForm.setValue({
      descripcion: ingreso.descripcion,
      monto: this.formatMontoInput(String(ingreso.monto)),
      fecha: new Date(ingreso.fecha).toISOString().substring(0, 10),
      categoria: ingreso.categoria ?? '',
      metodo: ingreso.metodo ?? 'Transferencia',
      usuarioId: ingreso.usuario?.id ?? '',
    });
    this.mostrarModal.set(true);
  }

  public cerrarModal(): void {
    this.mostrarModal.set(false);
    this.ingresoEditando.set(null);
  }

  public guardarIngreso(): void {
    if (this.ingresoForm.invalid) {
      this.ingresoForm.markAllAsTouched();
      return;
    }
    if (this.guardando()) return;

    const v = this.ingresoForm.value;
    const input = {
      descripcion: v.descripcion,
      monto: Number(String(v.monto).replace(/,/g, '')),
      fecha: v.fecha,
    };
    const categoria = v.categoria || 'Otros';

    const request$ = this.ingresoEditando()
      ? this.ingresosService.updateIngreso(this.ingresoEditando()!.id, input)
      : this.ingresosService.createIngreso(input);

    this.guardando.set(true);
    request$.subscribe({
      next: () => {
        this.cerrarModal();
        this.guardando.set(false);
        this.mostrarToast(this.ingresoEditando() ? 'Cambios guardados correctamente' : 'Ingreso registrado correctamente');
        this.cargarDatos();
      },
      error: (err) => {
        this.guardando.set(false);
        alert(err?.error?.message ?? 'Ocurrió un error al guardar el ingreso.');
      },
    });
  }

  // ===== Eliminar con confirmación =====
  public solicitarEliminar(ingreso: Ingreso): void {
    this.ingresoAEliminar.set(ingreso);
    this.mostrarConfirmacion.set(true);
  }

  public cancelarEliminar(): void {
    this.mostrarConfirmacion.set(false);
    this.ingresoAEliminar.set(null);
  }

  public confirmarEliminar(): void {
    const ingreso = this.ingresoAEliminar();
    if (!ingreso) return;
    this.cargando.set(true);

    this.ingresosService.deleteIngreso(ingreso.id).subscribe({
      next: () => {
        this.mostrarConfirmacion.set(false);
        this.ingresoAEliminar.set(null);
        this.cargarDatos();
      },
      error: (err) => {
        this.cargando.set(false);
        this.mostrarConfirmacion.set(false);
        alert(err?.error?.message ?? 'No se pudo eliminar el ingreso.');
      },
    });
  }
}