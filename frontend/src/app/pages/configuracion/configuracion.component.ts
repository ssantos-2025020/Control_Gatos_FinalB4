import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CurrencyService } from '../../services/currency.service';
import { ConfigService, FormatoFecha, FormatoHora, ZONAS_HORARIAS } from '../../services/config.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { LucideIconComponent } from '../../components/lucide-icon/lucide-icon.component';

type Seccion = 'general' | 'perfil' | 'moneda';
type FormatoNumeroLocal = 'latam' | 'en';
type PosicionLocal = 'antes' | 'despues';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, LucideIconComponent],
  styleUrls: ['../dashboard/dashboard.component.css', './configuracion.component.css'],
  templateUrl: './configuracion.component.html',
})
export class ConfiguracionComponent {
  private authService = inject(AuthService);
  configService = inject(ConfigService);
  currencyService = inject(CurrencyService);

  seccion = signal<Seccion>('general');
  toast = signal<string | null>(null);
  private toastTimer: any = null;

  /* ── General ── */
  zonas = ZONAS_HORARIAS;
  nombreApp: string;
  descripcion: string;
  formatoFecha: FormatoFecha;
  formatoHora: FormatoHora;
  zonaHoraria: string;

  /* ── Perfil ── */
  usuario = this.authService.getUsuario();
  perfilNombre: string;
  perfilUsuario = this.usuario ? `@${this.usuario.email.split('@')[0] || 'usuario'}` : '@usuario';
  perfilEmail: string;
  inicial = computed(() => (this.perfilNombre || 'A').charAt(0).toUpperCase());
  perfilError = signal<string | null>(null);

  /* ── Moneda ── */
  monedas = this.buildMonedas();
  monedaId = signal<string>(this.currencyService.getMoneda());
  formatoNumero = signal<FormatoNumeroLocal>(this.currencyService.formatoNumero());
  posicion = signal<PosicionLocal>(this.currencyService.posicionSimbolo());
  simboloPreview = computed(() => this.currencyService.getSimbolo(this.monedaId()));
  previewMonto = computed(() => {
    const v = 12500.5;
    const num = v.toLocaleString(this.formatoNumero() === 'en' ? 'en-US' : 'es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const sim = this.simboloPreview();
    return this.posicion() === 'despues' ? `${num} ${sim}` : `${sim}${num}`;
  });
  previewLargo = computed(() => {
    const v = 8018.06;
    const num = v.toLocaleString(this.formatoNumero() === 'en' ? 'en-US' : 'es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const sim = this.simboloPreview();
    return this.posicion() === 'despues' ? `${num} ${sim}` : `${sim}${num}`;
  });

  constructor() {
    this.nombreApp = this.configService.nombreApp();
    this.descripcion = this.configService.descripcion();
    this.formatoFecha = this.configService.formatoFecha();
    this.formatoHora = this.configService.formatoHora();
    this.zonaHoraria = this.configService.zonaHoraria();
    this.perfilNombre = this.usuario?.nombre ?? '';
    this.perfilEmail = this.usuario?.email ?? '';
  }

  private buildMonedas() {
    const todas = this.currencyService.getTodasLasMonedas();
    const prio = ['USD', 'GTQ', 'EUR', 'MXN'];
    const primero = prio.map((c) => todas.find((m) => m.id === c)).filter((m): m is NonNullable<typeof m> => !!m);
    return [...primero, ...todas.filter((m) => !prio.includes(m.id))];
  }

  private mostrarToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2800);
  }

  /* ── Acciones General ── */
  guardarGenerales(): void {
    this.configService.setGenerales({
      nombreApp: this.nombreApp.trim() || this.configService.nombreApp(),
      descripcion: this.descripcion,
      formatoFecha: this.formatoFecha,
      formatoHora: this.formatoHora,
      zonaHoraria: this.zonaHoraria,
    });
    this.mostrarToast('Cambios guardados correctamente');
  }

  /* ── Acciones Perfil ── */
  cambiarFoto(): void {
    this.mostrarToast('La carga de foto estará disponible próximamente');
  }

  guardarPerfil(): void {
    this.perfilError.set(null);
    if (!this.perfilNombre.trim()) {
      this.perfilError.set('El nombre completo es obligatorio.');
      return;
    }
    if (this.usuario) {
      this.authService.actualizarDatos(this.perfilNombre.trim(), this.perfilEmail.trim());
      this.usuario = { ...this.usuario, nombre: this.perfilNombre.trim(), email: this.perfilEmail.trim() };
    }
    this.mostrarToast('Cambios guardados correctamente');
  }

  /* ── Acciones Moneda ── */
  guardarMoneda(): void {
    this.currencyService.setMoneda(this.monedaId());
    this.currencyService.setFormatoNumero(this.formatoNumero());
    this.currencyService.setPosicionSimbolo(this.posicion());
    this.mostrarToast('Cambios guardados correctamente');
  }

  ngOnDestroy(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }
}