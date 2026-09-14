import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CurrencyService } from '../../services/currency.service';
import { ConfigService, FormatoFecha, FormatoHora, ZONAS_HORARIAS } from '../../services/config.service';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { LucideIconComponent } from '../../components/lucide-icon/lucide-icon.component';
import { PapeleraComponent } from '../../components/papelera/papelera.component';

type Seccion = 'general' | 'perfil' | 'moneda' | 'papelera';
type FormatoNumeroLocal = 'latam' | 'en';
type PosicionLocal = 'antes' | 'despues';

const MAX_FOTO_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, LucideIconComponent, PapeleraComponent],
  styleUrls: ['../dashboard/dashboard.component.css', './configuracion.component.css'],
  templateUrl: './configuracion.component.html',
})
export class ConfiguracionComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  configService = inject(ConfigService);
  currencyService = inject(CurrencyService);

  seccion = signal<Seccion>('general');
  toast = signal<string | null>(null);
  private toastTimer: any = null;

  ngOnInit(): void {
    const sec = this.route.snapshot.queryParamMap.get('seccion');
    if (sec === 'papelera') {
      this.seccion.set('papelera');
    }
  }

  /* ── General ── */
  zonas = ZONAS_HORARIAS;
  nombreApp: string;
  descripcion: string;
  formatoFecha: FormatoFecha;
  formatoHora: FormatoHora;
  zonaHoraria: string;

  /* ── Perfil ── */
  usuario = this.authService.usuarioSesion;
  perfilNombre: string;
  perfilEmail: string;
  perfilUsuario = computed(() => {
    const u = this.usuario();
    return u?.email ? `@${u.email.split('@')[0] || 'usuario'}` : '@usuario';
  });
  inicial = computed(() => (this.usuario()?.nombre || 'A').charAt(0).toUpperCase());
  perfilError = signal<string | null>(null);
  subiendoFoto = signal(false);

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
    this.perfilNombre = this.usuario()?.nombre ?? '';
    this.perfilEmail = this.usuario()?.email ?? '';
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
  /** Abre el selector de archivos para cambiar la foto de perfil. */
  cambiarFoto(): void {
    (document.getElementById('foto-input') as HTMLInputElement | null)?.click();
  }

  /**
   * Procesa el archivo de imagen elegido: valida tipo y tamaño, lo redimensiona
   * en el navegador (máx. 256px, JPEG) y lo envía al servidor. Al guardar se
   * cierra la sesión automáticamente para que la nueva foto se refresque en
   * toda la app al volver a iniciar sesión.
   */
  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.perfilError.set('Selecciona un archivo de imagen (JPG, PNG, WebP o GIF).');
      return;
    }

    if (file.size > MAX_FOTO_BYTES) {
      this.perfilError.set('La imagen no puede superar los 5 MB.');
      return;
    }

    this.subiendoFoto.set(true);
    this.perfilError.set(null);

    const reader = new FileReader();
    reader.onload = () => {
      this.redimensionarImagen(String(reader.result))
        .then((dataUrl) => this.guardarFoto(dataUrl))
        .catch((err: Error) => {
          this.subiendoFoto.set(false);
          this.perfilError.set(err.message || 'No se pudo procesar la imagen.');
        });
    };
    reader.onerror = () => {
      this.subiendoFoto.set(false);
      this.perfilError.set('No se pudo leer el archivo.');
    };
    reader.readAsDataURL(file);
  }

  private redimensionarImagen(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 256;
        const escala = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      img.src = dataUrl;
    });
  }

  private guardarFoto(dataUrl: string): void {
    this.authService.cambiarFotoLocal(dataUrl);
    this.subiendoFoto.set(false);
    this.mostrarToast('Foto actualizada. Se mostrará solo hasta que cierres sesión.');
  }

  recuperarContrasena(): void {
    this.mostrarToast('Esta función estará disponible próximamente');
  }

  guardarPerfil(): void {
    this.perfilError.set(null);
    if (!this.perfilNombre.trim()) {
      this.perfilError.set('El nombre completo es obligatorio.');
      return;
    }
    if (this.usuario()) {
      this.authService.actualizarDatos(this.perfilNombre.trim(), this.perfilEmail.trim());
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