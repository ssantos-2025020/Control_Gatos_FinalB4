import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '../lucide-icon/lucide-icon.component';
import { CurrencyService } from '../../services/currency.service';
import { PapeleraService, TipoPapelera, PapeleraContenido } from '../../services/papelera.service';

type Ficha = TipoPapelera;

const NOMBRE_SINGULAR: Record<Ficha, string> = {
  categorias: 'categoría',
  gastos: 'gasto',
  ingresos: 'ingreso',
  presupuestos: 'presupuesto',
};

@Component({
  selector: 'app-papelera',
  standalone: true,
  imports: [CommonModule, LucideIconComponent],
  templateUrl: './papelera.component.html',
  styleUrls: ['./papelera.component.css'],
})
export class PapeleraComponent implements OnInit {
  private papeleraService = inject(PapeleraService);
  currencyService = inject(CurrencyService);

  contenido = signal<PapeleraContenido | null>(null);
  cargando = signal(false);
  ficha = signal<Ficha>('gastos');
  toast = signal<string | null>(null);
  private toastTimer: any = null;

  totalCategorias = computed(() => this.contenido()?.categorias.length ?? 0);
  totalGastos = computed(() => this.contenido()?.gastos.length ?? 0);
  totalIngresos = computed(() => this.contenido()?.ingresos.length ?? 0);
  totalPresupuestos = computed(() => this.contenido()?.presupuestos.length ?? 0);
  totalGeneral = computed(
    () => this.totalCategorias() + this.totalGastos() + this.totalIngresos() + this.totalPresupuestos()
  );
  vacia = computed(() => this.totalGeneral() === 0);

  totalFicha = computed(() => {
    const c = this.contenido();
    if (!c) return 0;
    switch (this.ficha()) {
      case 'categorias': return c.categorias.length;
      case 'gastos': return c.gastos.length;
      case 'ingresos': return c.ingresos.length;
      case 'presupuestos': return c.presupuestos.length;
      default: return 0;
    }
  });

  totalMontoFicha = computed(() => {
    const c = this.contenido();
    if (!c) return 0;
    switch (this.ficha()) {
      case 'gastos': return c.gastos.reduce((acc, g) => acc + Number(g.monto || 0), 0);
      case 'ingresos': return c.ingresos.reduce((acc, i) => acc + Number(i.monto || 0), 0);
      case 'presupuestos': return c.presupuestos.reduce((acc, p) => acc + Number(p.monto || 0), 0);
      default: return 0;
    }
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.papeleraService.getPapelera().subscribe({
      next: (c) => {
        this.contenido.set(c);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.mostrarToast('No se pudo cargar la papelera.');
      },
    });
  }

  setFicha(ficha: Ficha): void {
    this.ficha.set(ficha);
  }

  formatearMonto(monto: number): string {
    return this.currencyService.formatearValor(Number(monto || 0));
  }

  formatearFecha(fecha: string): string {
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? fecha : d.toLocaleString();
  }

  nombreMes(mes: number): string {
    const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return nombres[mes - 1] ?? `${mes}`;
  }

  restaurar(tipo: TipoPapelera, id: string): void {
    this.papeleraService.restaurar(tipo, id).subscribe({
      next: (r) => {
        this.mostrarToast(r.message);
        this.cargar();
      },
      error: (err) => {
        this.mostrarToast(err?.error?.message ?? 'No se pudo restaurar el elemento.');
      },
    });
  }

  eliminarPermanente(tipo: TipoPapelera, id: string): void {
    const nombre = NOMBRE_SINGULAR[tipo];
    if (!confirm(`¿Eliminar definitivamente esta ${nombre} de la papelera? Esta acción no se puede deshacer.`)) {
      return;
    }
    this.papeleraService.eliminarPermanente(tipo, id).subscribe({
      next: (r) => {
        this.mostrarToast(r.message);
        this.cargar();
      },
      error: (err) => {
        this.mostrarToast(err?.error?.message ?? 'No se pudo eliminar definitivamente el elemento.');
      },
    });
  }

  vaciar(): void {
    if (!confirm('¿Vaciar la papelera? Se eliminarán definitivamente todos los elementos y no se podrán restaurar.')) {
      return;
    }
    this.papeleraService.vaciar().subscribe({
      next: (r) => {
        const total = r.categorias + r.gastos + r.ingresos + r.presupuestos;
        this.mostrarToast(`${r.message} Se eliminaron ${total} elemento(s).`);
        this.cargar();
      },
      error: () => {
        this.mostrarToast('No se pudo vaciar la papelera.');
      },
    });
  }

  private mostrarToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 3200);
  }

  ngOnDestroy(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }
}